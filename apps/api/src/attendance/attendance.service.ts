import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import {
  AttendanceStatus,
  Prisma,
  PunchDirection,
  PunchSource,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  commKeyHash,
  commKeyMatches,
  parseAttlog,
  parseDeviceCommandResult,
  punchKey,
  type AttlogLine,
} from './attlog';
import {
  addDays,
  dateOnlyUtc,
  eachDate,
  httpDateHeader,
  isoDate,
  businessDateFor,
  isoFromDateOnly,
  localStamp,
  todayIso,
  wallToUtc,
  weekdayIndex,
  zonedParts,
  type ShiftClock,
} from './clock';
import {
  canRebuild,
  directionFromStatus,
  summarizeDay,
  type DayStatusName,
  type PunchDirectionName,
} from './day-math';
import type {
  AssignmentDto,
  CommKeyDto,
  CorrectionDto,
  DecisionDto,
  DeviceDto,
  EnrollmentDto,
  HolidayDto,
  OverrideDto,
  PolicyDto,
  ShiftDto,
} from './dto/attendance.dto';

const GENERAL = 'GENERAL';

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Date must be YYYY-MM-DD.');
  }
  return value;
}

function assertTime(value: string | undefined) {
  if (value == null || value === '') return null;
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new BadRequestException('Time must be HH:mm.');
  }
  return value;
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function clockLabel(instant: Date | null, timeZone: string) {
  if (!instant) return null;
  const parts = zonedParts(instant, timeZone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

@Injectable()
export class AttendanceService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notifications?: NotificationsService,
  ) {}

  async onModuleInit() {
    const punches = await this.prisma.attendancePunch.findMany({
      where: { employeeId: { not: null } },
      select: { employeeId: true, businessDate: true, createdAt: true },
    });
    const latest = new Map<string, Date>();
    for (const punch of punches) {
      if (!punch.employeeId) continue;
      const key = `${punch.employeeId}|${isoFromDateOnly(punch.businessDate)}`;
      const current = latest.get(key);
      if (!current || punch.createdAt > current) latest.set(key, punch.createdAt);
    }
    for (const [key, createdAt] of latest) {
      const [employeeId, date] = key.split('|');
      const day = await this.prisma.attendanceDay.findFirst({
        where: { employeeId, attendanceDate: dateOnlyUtc(date) },
      });
      if (!day || day.rebuiltAt < createdAt) {
        await this.rebuild(employeeId, date);
      }
    }
  }

  async ensureDefaultAssignment(tenantId: string, employeeId: string) {
    const open = await this.prisma.shiftAssignment.findFirst({
      where: { employeeId, effectiveTo: null },
    });
    if (open) return;
    const shift = await this.prisma.shift.findUnique({
      where: { tenantId_code: { tenantId, code: GENERAL } },
    });
    if (!shift) return;
    const policy = await this.policy(tenantId);
    await this.prisma.shiftAssignment.create({
      data: {
        tenantId,
        employeeId,
        shiftId: shift.id,
        effectiveFrom: dateOnlyUtc(todayIso(policy.timeZone)),
      },
    });
  }

  async myMonth(userId: string, year: number, month: number) {
    const employee = await this.employeeByUser(userId);
    const policy = await this.policy(employee.tenantId);
    await this.materialize(employee.id, employee.tenantId, year, month, policy.timeZone);
    const shift = await this.shiftFor(employee.id, todayIso(policy.timeZone));
    const days = await this.daysFor(employee.tenantId, [employee.id], year, month, policy.timeZone);
    const corrections = await this.prisma.attendanceCorrection.findMany({
      where: { tenantId: employee.tenantId, employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      timeZone: policy.timeZone,
      webPunchEnabled: policy.webPunchEnabled,
      shift: shift
        ? {
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakMinutes: shift.breakMinutes,
          }
        : null,
      days: await this.withCalendar(
        days,
        year,
        month,
        policy.timeZone,
        employee.tenantId,
        employee.locationId,
      ),
      corrections: corrections.map((item) => this.correctionView(item)),
    };
  }

  async punchWeb(userId: string, direction: 'IN' | 'OUT') {
    const employee = await this.employeeByUser(userId);
    const policy = await this.policy(employee.tenantId);
    if (!policy.webPunchEnabled) {
      throw new ForbiddenException('Web punch is turned off.');
    }
    const now = new Date();
    const rawTimestamp = localStamp(policy.timeZone, now);
    const punchedAt = wallToUtc(rawTimestamp.slice(0, 10), rawTimestamp.slice(11), policy.timeZone);
    const shift = await this.shiftFor(employee.id, rawTimestamp.slice(0, 10));
    const businessDate = businessDateFor(punchedAt, policy.timeZone, shift);
    if (await this.isLocked(employee.tenantId, businessDate)) {
      throw new ConflictException('This month is locked.');
    }
    const statusCode = direction === 'IN' ? 0 : 1;
    const inserted = await this.insertPunch({
      tenantId: employee.tenantId,
      employeeId: employee.id,
      deviceId: null,
      serial: 'web',
      pin: employee.employeeCode,
      rawTimestamp,
      punchedAt,
      businessDate,
      statusCode,
      verifyMode: 0,
      direction,
      source: 'web',
      workCode: '',
      rawLine: '',
    });
    const day = await this.rebuild(employee.id, businessDate);
    return { duplicate: !inserted, day };
  }

  async requestCorrection(userId: string, dto: CorrectionDto) {
    const employee = await this.employeeByUser(userId);
    const date = assertDate(dto.date);
    const checkIn = assertTime(dto.checkIn);
    const checkOut = assertTime(dto.checkOut);
    if (!dto.reason.trim()) throw new BadRequestException('Reason is required.');
    if (await this.isLocked(employee.tenantId, date)) {
      throw new ConflictException('This month is locked.');
    }
    if (!employee.managerId) {
      throw new BadRequestException('No manager is assigned for this correction.');
    }
    const pending = await this.prisma.attendanceCorrection.findFirst({
      where: {
        employeeId: employee.id,
        attendanceDate: dateOnlyUtc(date),
        status: 'Pending',
      },
    });
    if (pending) {
      throw new ConflictException('A correction is already pending for this date.');
    }
    const correction = await this.prisma.attendanceCorrection.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        attendanceDate: dateOnlyUtc(date),
        requestedStatus: dto.requestedStatus,
        proposedCheckIn: checkIn,
        proposedCheckOut: checkOut,
        reason: dto.reason.trim(),
        approverEmployeeId: employee.managerId,
      },
    });
    await this.audit(employee.tenantId, employee.userId, 'attendance.correction.request', correction.id, {
      date,
      requestedStatus: dto.requestedStatus,
    });
    return this.correctionView(correction);
  }

  async teamMonth(userId: string, year: number, month: number) {
    const manager = await this.employeeByUser(userId);
    const reports = await this.prisma.employee.findMany({
      where: { tenantId: manager.tenantId, managerId: manager.id },
    });
    const policy = await this.policy(manager.tenantId);
    for (const report of reports) {
      await this.materialize(report.id, manager.tenantId, year, month, policy.timeZone);
    }
    const ids = reports.map((report) => report.id);
    const days = await this.daysFor(manager.tenantId, ids, year, month, policy.timeZone);
    const people = new Map(reports.map((report) => [report.id, report]));
    const exceptions = days
      .filter((day) => ['absent', 'missing_punch', 'half_day'].includes(day.status))
      .map((day) => ({
        ...day,
        person: this.person(people.get(day.employeeId)),
      }));
    const corrections = await this.prisma.attendanceCorrection.findMany({
      where: { tenantId: manager.tenantId, employeeId: { in: ids } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      exceptions,
      corrections: corrections.map((item) => ({
        ...this.correctionView(item),
        person: this.person(people.get(item.employeeId)),
      })),
    };
  }

  async decide(userId: string, correctionId: string, dto: DecisionDto) {
    const manager = await this.employeeByUser(userId);
    const correction = await this.prisma.attendanceCorrection.findFirst({
      where: { id: correctionId, tenantId: manager.tenantId },
      include: { employee: true },
    });
    if (!correction) throw new NotFoundException('Correction not found.');
    if (correction.employee.managerId !== manager.id) {
      throw new ForbiddenException('This correction belongs to another manager.');
    }
    if (correction.status !== 'Pending') {
      throw new ConflictException('This correction is already decided.');
    }
    const date = isoFromDateOnly(correction.attendanceDate);
    if (await this.isLocked(manager.tenantId, date)) {
      throw new ConflictException('This month is locked.');
    }
    const before = await this.prisma.attendanceDay.findUnique({
      where: {
        tenantId_employeeId_attendanceDate: {
          tenantId: manager.tenantId,
          employeeId: correction.employeeId,
          attendanceDate: correction.attendanceDate,
        },
      },
    });
    if (dto.status === 'Approved') {
      await this.writeManualPunches(
        correction.employee,
        date,
        correction.proposedCheckIn,
        correction.proposedCheckOut,
        'correction',
      );
    }
    const after =
      dto.status === 'Approved'
        ? await this.rebuild(correction.employeeId, date, {
            overrideStatus: this.asOverride(correction.requestedStatus) ?? undefined,
            note: correction.reason,
          })
        : null;
    const saved = await this.prisma.attendanceCorrection.update({
      where: { id: correction.id },
      data: {
        status: dto.status,
        decisionNote: dto.note?.trim() ?? '',
        decidedAt: new Date(),
        beforeSnapshot: before ? this.snapshot(before) : Prisma.JsonNull,
        afterSnapshot: after ? (after as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
    await this.audit(manager.tenantId, manager.userId, 'attendance.correction.decide', correction.id, {
      status: dto.status,
      date,
    });
    if (correction.employee.userId && this.notifications) {
      await this.notifications.notify({
        tenantId: manager.tenantId,
        userId: correction.employee.userId,
        title: dto.status === 'Approved' ? 'Attendance correction approved' : 'Attendance correction rejected',
        body: date,
        href: '/ess/attendance',
        kind: 'attendance',
      });
    }
    return this.correctionView(saved);
  }

  async listShifts(tenantId: string) {
    return this.prisma.shift.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
  }

  async createShift(tenantId: string, actorUserId: string, dto: ShiftDto) {
    const shift = await this.prisma.shift.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        startTime: assertTime(dto.startTime) ?? dto.startTime,
        endTime: assertTime(dto.endTime) ?? dto.endTime,
        breakMinutes: dto.breakMinutes,
        overnight: dto.overnight ?? false,
      },
    });
    await this.audit(tenantId, actorUserId, 'attendance.shift.create', shift.id, { code: shift.code });
    return shift;
  }

  async assignShift(tenantId: string, actorUserId: string, dto: AssignmentDto) {
    const effectiveFrom = assertDate(dto.effectiveFrom);
    const shift = await this.prisma.shift.findFirst({
      where: { id: dto.shiftId, tenantId },
    });
    if (!shift) throw new NotFoundException('Shift not found.');
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    const open = await this.prisma.shiftAssignment.findFirst({
      where: { employeeId: employee.id, effectiveTo: null },
    });
    if (open && isoFromDateOnly(open.effectiveFrom) === effectiveFrom) {
      await this.prisma.shiftAssignment.update({
        where: { id: open.id },
        data: { shiftId: shift.id },
      });
    } else {
      if (open) {
        const closeOn = addDays(effectiveFrom, -1);
        await this.prisma.shiftAssignment.update({
          where: { id: open.id },
          data: {
            effectiveTo: dateOnlyUtc(
              closeOn < isoFromDateOnly(open.effectiveFrom)
                ? isoFromDateOnly(open.effectiveFrom)
                : closeOn,
            ),
          },
        });
      }
      await this.prisma.shiftAssignment.create({
        data: {
          tenantId,
          employeeId: employee.id,
          shiftId: shift.id,
          effectiveFrom: dateOnlyUtc(effectiveFrom),
        },
      });
    }
    await this.audit(tenantId, actorUserId, 'attendance.shift.assign', employee.id, {
      shift: shift.code,
      effectiveFrom,
    });
    return { ok: true };
  }

  async listHolidays(tenantId: string) {
    const rows = await this.prisma.holiday.findMany({
      where: { tenantId },
      include: { location: true },
      orderBy: { holidayDate: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      date: isoFromDateOnly(row.holidayDate),
      name: row.name,
      locationId: row.locationId,
      locationName: row.location?.name ?? null,
    }));
  }

  async createHoliday(tenantId: string, actorUserId: string, dto: HolidayDto) {
    const date = assertDate(dto.date);
    const locationId = dto.locationId || null;
    const existing = await this.prisma.holiday.findFirst({
      where: { tenantId, holidayDate: dateOnlyUtc(date), locationId },
    });
    if (existing) throw new ConflictException('That holiday already exists.');
    const holiday = await this.prisma.holiday.create({
      data: {
        tenantId,
        holidayDate: dateOnlyUtc(date),
        name: dto.name.trim(),
        locationId,
      },
    });
    await this.audit(tenantId, actorUserId, 'attendance.holiday.create', holiday.id, { date });
    return { id: holiday.id, date, name: holiday.name, locationId };
  }

  async deleteHoliday(tenantId: string, actorUserId: string, id: string) {
    const holiday = await this.prisma.holiday.findFirst({ where: { id, tenantId } });
    if (!holiday) throw new NotFoundException('Holiday not found.');
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit(tenantId, actorUserId, 'attendance.holiday.delete', id, {});
    return { ok: true };
  }

  async getPolicy(tenantId: string) {
    return this.policy(tenantId);
  }

  async updatePolicy(tenantId: string, actorUserId: string, dto: PolicyDto) {
    const policy = await this.prisma.attendancePolicy.upsert({
      where: { tenantId },
      update: {
        timeZone: dto.timeZone,
        graceMinutes: dto.graceMinutes,
        halfDayMaxMinutes: dto.halfDayMaxMinutes,
        duplicateWindowMinutes: dto.duplicateWindowMinutes,
        webPunchEnabled: dto.webPunchEnabled,
      },
      create: {
        tenantId,
        timeZone: dto.timeZone ?? 'Asia/Kolkata',
        graceMinutes: dto.graceMinutes ?? 10,
        halfDayMaxMinutes: dto.halfDayMaxMinutes ?? 300,
        duplicateWindowMinutes: dto.duplicateWindowMinutes ?? 5,
        webPunchEnabled: dto.webPunchEnabled ?? true,
      },
    });
    await this.audit(tenantId, actorUserId, 'attendance.policy.update', policy.id, {});
    return policy;
  }

  async unmatched(tenantId: string) {
    const rows = await this.prisma.attendancePunch.findMany({
      where: { tenantId, employeeId: null },
      orderBy: { punchedAt: 'desc' },
      take: 100,
      include: { device: true },
    });
    return rows.map((row) => ({
      id: row.id,
      pin: row.pin,
      rawTimestamp: row.rawTimestamp,
      serial: row.serial,
      deviceName: row.device?.name ?? null,
    }));
  }

  async mapUnmatched(tenantId: string, actorUserId: string, punchId: string, employeeId: string) {
    const punch = await this.prisma.attendancePunch.findFirst({
      where: { id: punchId, tenantId, employeeId: null },
    });
    if (!punch) throw new NotFoundException('Unmatched punch not found.');
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    await this.prisma.attendancePunch.update({
      where: { id: punch.id },
      data: { employeeId: employee.id },
    });
    const date = isoFromDateOnly(punch.businessDate);
    await this.rebuild(employee.id, date);
    await this.audit(tenantId, actorUserId, 'attendance.punch.map', punch.id, {
      employeeId,
      date,
    });
    return { ok: true };
  }

  async override(
    tenantId: string,
    actorUserId: string,
    employeeId: string,
    dateRaw: string,
    dto: OverrideDto,
  ) {
    const date = assertDate(dateRaw);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    if (!dto.reason.trim()) throw new BadRequestException('Reason is required.');
    await this.writeManualPunches(employee, date, assertTime(dto.checkIn), assertTime(dto.checkOut), 'hr');
    const day = await this.rebuild(employee.id, date, {
      force: true,
      overrideStatus: dto.status,
      note: dto.reason.trim(),
    });
    await this.audit(tenantId, actorUserId, 'attendance.day.override', employee.id, {
      date,
      status: dto.status,
    });
    return day;
  }

  async markLeaveDays(employeeId: string, dates: string[], note: string) {
    for (const date of dates) {
      await this.rebuild(employeeId, date, {
        force: true,
        overrideStatus: 'leave',
        note,
      });
    }
  }

  async period(tenantId: string, year: number, month: number) {
    const row = await this.prisma.attendancePeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });
    return { year, month, status: row?.status ?? 'open', lockedAt: row?.lockedAt ?? null };
  }

  async lockPeriod(tenantId: string, actorUserId: string, year: number, month: number) {
    const period = await this.prisma.attendancePeriod.upsert({
      where: { tenantId_year_month: { tenantId, year, month } },
      update: { status: 'locked', lockedById: actorUserId, lockedAt: new Date() },
      create: {
        tenantId,
        year,
        month,
        status: 'locked',
        lockedById: actorUserId,
        lockedAt: new Date(),
      },
    });
    const start = dateOnlyUtc(isoDate({ year, month, day: 1 }));
    const end = dateOnlyUtc(isoDate({ year, month, day: eachDate(year, month).length }));
    await this.prisma.attendanceDay.updateMany({
      where: { tenantId, attendanceDate: { gte: start, lte: end } },
      data: { locked: true },
    });
    await this.audit(tenantId, actorUserId, 'attendance.period.lock', period.id, { year, month });
    return { year, month, status: 'locked' as const, lockedAt: period.lockedAt };
  }

  async registerCsv(tenantId: string, year: number, month: number) {
    const policy = await this.policy(tenantId);
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: { employeeCode: 'asc' },
    });
    for (const employee of employees) {
      await this.materialize(employee.id, tenantId, year, month, policy.timeZone);
    }
    const days = await this.daysFor(
      tenantId,
      employees.map((employee) => employee.id),
      year,
      month,
      policy.timeZone,
    );
    const people = new Map(employees.map((employee) => [employee.id, employee]));
    const header = [
      'employeeCode',
      'name',
      'date',
      'status',
      'checkIn',
      'checkOut',
      'workMinutes',
      'lateMinutes',
      'earlyMinutes',
      'missingPunch',
    ];
    const lines = [header.join(',')];
    for (const day of days) {
      const person = people.get(day.employeeId);
      lines.push(
        [
          person?.employeeCode ?? '',
          person ? `${person.firstName} ${person.lastName}` : '',
          day.date,
          day.status,
          day.checkIn,
          day.checkOut,
          day.workMinutes,
          day.lateMinutes,
          day.earlyMinutes,
          day.missingPunch ? 'yes' : 'no',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  async companyExceptions(tenantId: string, year: number, month: number) {
    const policy = await this.policy(tenantId);
    const employees = await this.prisma.employee.findMany({ where: { tenantId } });
    for (const employee of employees) {
      await this.materialize(employee.id, tenantId, year, month, policy.timeZone);
    }
    const days = await this.daysFor(
      tenantId,
      employees.map((employee) => employee.id),
      year,
      month,
      policy.timeZone,
    );
    const people = new Map(employees.map((employee) => [employee.id, employee]));
    return days
      .filter((day) => ['absent', 'missing_punch', 'half_day'].includes(day.status))
      .map((day) => ({ ...day, person: this.person(people.get(day.employeeId)) }));
  }

  async listDevices(tenantId: string) {
    const devices = await this.prisma.attendanceDevice.findMany({
      where: { tenantId },
      include: {
        location: true,
        enrollments: { include: { employee: true } },
      },
      orderBy: { name: 'asc' },
    });
    const logs = await this.prisma.deviceOperationLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      devices: devices.map((device) => ({
        id: device.id,
        serial: device.serial,
        name: device.name,
        model: device.model,
        firmware: device.firmware,
        timeZone: device.timeZone,
        directionMode: device.directionMode,
        locationId: device.locationId,
        locationName: device.location?.name ?? null,
        lastSeenAt: device.lastSeenAt,
        hasCommKey: Boolean(device.commKeyHash),
        enrollments: device.enrollments.map((row) => ({
          id: row.id,
          pin: row.pin,
          status: row.status,
          employeeId: row.employeeId,
          employeeCode: row.employee.employeeCode,
          name: `${row.employee.firstName} ${row.employee.lastName}`,
        })),
      })),
      operationLogs: logs.map((log) => ({
        id: log.id,
        kind: log.kind,
        raw: log.raw.slice(0, 500),
        createdAt: log.createdAt,
      })),
    };
  }

  async createDevice(tenantId: string, actorUserId: string, dto: DeviceDto) {
    const device = await this.prisma.attendanceDevice.create({
      data: {
        tenantId,
        serial: dto.serial.trim(),
        name: dto.name.trim(),
        locationId: dto.locationId || null,
        timeZone: dto.timeZone?.trim() || 'Asia/Kolkata',
        directionMode: dto.directionMode ?? 'inferred',
        model: dto.model?.trim() ?? '',
      },
    });
    await this.audit(tenantId, actorUserId, 'attendance.device.create', device.id, {
      serial: device.serial,
    });
    return device;
  }

  async rotateCommKey(tenantId: string, actorUserId: string, deviceId: string, dto: CommKeyDto) {
    const device = await this.requireDevice(tenantId, deviceId);
    await this.prisma.attendanceDevice.update({
      where: { id: device.id },
      data: { commKeyHash: commKeyHash(dto.commKey) },
    });
    await this.audit(tenantId, actorUserId, 'attendance.device.commkey', device.id, {});
    return { ok: true };
  }

  async enroll(tenantId: string, actorUserId: string, deviceId: string, dto: EnrollmentDto) {
    const device = await this.requireDevice(tenantId, deviceId);
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    const enrollment = await this.prisma.deviceEnrollment.upsert({
      where: { deviceId_pin: { deviceId: device.id, pin: dto.pin.trim() } },
      update: { employeeId: employee.id, status: 'pending' },
      create: {
        deviceId: device.id,
        employeeId: employee.id,
        pin: dto.pin.trim(),
        status: 'pending',
      },
    });
    const name = `${employee.firstName} ${employee.lastName}`.replace(/\t/g, ' ');
    await this.prisma.deviceCommand.create({
      data: {
        deviceId: device.id,
        enrollmentId: enrollment.id,
        body: `DATA UPDATE USERINFO PIN=${dto.pin.trim()}\tName=${name}\tPrivilege=0`,
      },
    });
    await this.audit(tenantId, actorUserId, 'attendance.device.enroll', device.id, {
      pin: dto.pin.trim(),
      employeeId: employee.id,
    });
    return enrollment;
  }

  async revokeEnrollment(tenantId: string, actorUserId: string, deviceId: string, enrollmentId: string) {
    const device = await this.requireDevice(tenantId, deviceId);
    const enrollment = await this.prisma.deviceEnrollment.findFirst({
      where: { id: enrollmentId, deviceId: device.id },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found.');
    await this.prisma.deviceEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'revoked' },
    });
    await this.prisma.deviceCommand.create({
      data: {
        deviceId: device.id,
        enrollmentId: enrollment.id,
        body: `DATA DELETE USERINFO PIN=${enrollment.pin}`,
      },
    });
    await this.audit(tenantId, actorUserId, 'attendance.device.revoke', device.id, {
      pin: enrollment.pin,
    });
    return { ok: true };
  }

  async handshake(serial: string, info: string | undefined, presentedKey: string | undefined) {
    const device = await this.deviceBySerial(serial, presentedKey);
    if (info) {
      await this.prisma.attendanceDevice.update({
        where: { id: device.id },
        data: { firmware: info.split(',')[0] ?? device.firmware, lastSeenAt: new Date() },
      });
    } else {
      await this.touch(device.id);
    }
    const body = [
      `GET OPTION FROM: ${device.serial}`,
      `ATTLOGStamp=${device.lastStamp}`,
      'OPERLOGStamp=9999',
      'ATTPHOTOStamp=0',
      'ErrorDelay=60',
      'Delay=30',
      'TransInterval=1',
      'TransFlag=TransData AttLog\tOpLog\tEnrollUser\tChgUser',
      'Realtime=1',
      'Encrypt=None',
    ].join('\r\n');
    return { body, dateHeader: httpDateHeader(device.timeZone) };
  }

  async poll(serial: string, info: string | undefined, presentedKey: string | undefined) {
    const device = await this.deviceBySerial(serial, presentedKey);
    const data: { firmware?: string; lastSeenAt: Date } = { lastSeenAt: new Date() };
    if (info) data.firmware = info.split(',')[0] ?? '';
    await this.prisma.attendanceDevice.update({ where: { id: device.id }, data });
    const command = await this.prisma.deviceCommand.findFirst({
      where: { deviceId: device.id, state: 'queued' },
      orderBy: { id: 'asc' },
    });
    if (!command) {
      return { body: 'OK', dateHeader: httpDateHeader(device.timeZone) };
    }
    await this.prisma.deviceCommand.update({
      where: { id: command.id },
      data: { state: 'sent' },
    });
    return {
      body: `C:${command.id}:${command.body}`,
      dateHeader: httpDateHeader(device.timeZone),
    };
  }

  async ingest(serial: string, table: string | undefined, stamp: string | undefined, body: string, presentedKey: string | undefined) {
    const device = await this.deviceBySerial(serial, presentedKey);
    const kind = (table ?? 'ATTLOG').toUpperCase();
    if (kind !== 'ATTLOG') {
      await this.prisma.deviceOperationLog.create({
        data: { tenantId: device.tenantId, deviceId: device.id, kind, raw: body.slice(0, 8000) },
      });
      await this.touch(device.id);
      return { body: 'OK', dateHeader: httpDateHeader(device.timeZone) };
    }
    const parsed = parseAttlog(body);
    if (parsed.bad.length) {
      await this.prisma.deviceOperationLog.create({
        data: {
          tenantId: device.tenantId,
          deviceId: device.id,
          kind: 'parse_error',
          raw: parsed.bad.join('\n').slice(0, 8000),
        },
      });
    }
    const affected = await this.insertAttlog(device, parsed.ok, stamp);
    for (const item of affected) {
      await this.rebuild(item.employeeId, item.date);
    }
    await this.audit(device.tenantId, null, 'attendance.punch.ingest', device.id, {
      inserted: affected.length,
      duplicatesOrUnmatched: parsed.ok.length,
    });
    return { body: 'OK', dateHeader: httpDateHeader(device.timeZone) };
  }

  async commandResult(serial: string, body: string, presentedKey: string | undefined) {
    const device = await this.deviceBySerial(serial, presentedKey);
    const result = parseDeviceCommandResult(body);
    if (result.id != null) {
      const command = await this.prisma.deviceCommand.findFirst({
        where: { id: result.id, deviceId: device.id },
      });
      if (command) {
        await this.prisma.deviceCommand.update({
          where: { id: command.id },
          data: {
            state: result.returnCode === 0 ? 'succeeded' : 'failed',
            returnCode: result.returnCode,
          },
        });
        if (result.returnCode === 0 && command.enrollmentId) {
          const revoke = command.body.includes('DELETE USERINFO');
          await this.prisma.deviceEnrollment.update({
            where: { id: command.enrollmentId },
            data: { status: revoke ? 'revoked' : 'active' },
          });
        }
      }
    }
    await this.touch(device.id);
    return { body: 'OK', dateHeader: httpDateHeader(device.timeZone) };
  }

  private async insertAttlog(
    device: {
      id: string;
      tenantId: string;
      serial: string;
      timeZone: string;
      directionMode: 'device' | 'inferred';
    },
    lines: AttlogLine[],
    stamp: string | undefined,
  ) {
    const affected: { employeeId: string; date: string }[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const enrollment = await tx.deviceEnrollment.findFirst({
          where: {
            deviceId: device.id,
            pin: line.pin,
            status: { in: ['pending', 'active'] },
          },
        });
        const employee = enrollment
          ? await tx.employee.findUnique({ where: { id: enrollment.employeeId } })
          : null;
        const dayPart = line.rawTimestamp.slice(0, 10);
        const timePart = line.rawTimestamp.slice(11);
        const punchedAt = wallToUtc(dayPart, timePart, device.timeZone);
        const shift = employee ? await this.shiftFor(employee.id, dayPart) : null;
        const businessDate = businessDateFor(punchedAt, device.timeZone, shift);
        const direction =
          device.directionMode === 'device' ? directionFromStatus(line.statusCode) : null;
        const inserted = await this.insertPunch(
          {
            tenantId: device.tenantId,
            employeeId: employee?.id ?? null,
            deviceId: device.id,
            serial: device.serial,
            pin: line.pin,
            rawTimestamp: line.rawTimestamp,
            punchedAt,
            businessDate,
            statusCode: line.statusCode,
            verifyMode: line.verifyMode,
            direction,
            source: 'device',
            workCode: line.workCode,
            rawLine: line.rawLine,
          },
          tx,
        );
        if (inserted && employee) affected.push({ employeeId: employee.id, date: businessDate });
      }
      await tx.attendanceDevice.update({
        where: { id: device.id },
        data: {
          lastSeenAt: new Date(),
          lastStamp: stamp && stamp.length ? stamp : undefined,
        },
      });
    });
    return affected;
  }

  private async insertPunch(
    input: {
      tenantId: string;
      employeeId: string | null;
      deviceId: string | null;
      serial: string;
      pin: string;
      rawTimestamp: string;
      punchedAt: Date;
      businessDate: string;
      statusCode: number;
      verifyMode: number;
      direction: PunchDirectionName | null;
      source: PunchSource;
      workCode: string;
      rawLine: string;
    },
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const key = punchKey({
      tenantId: input.tenantId,
      serial: input.serial,
      pin: input.pin,
      rawTimestamp: input.rawTimestamp,
      statusCode: input.statusCode,
      verifyMode: input.verifyMode,
    });
    const existing = await tx.attendancePunch.findUnique({ where: { idempotencyKey: key } });
    if (existing) return false;
    try {
      await tx.attendancePunch.create({
        data: {
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          deviceId: input.deviceId,
          serial: input.serial,
          pin: input.pin,
          rawTimestamp: input.rawTimestamp,
          punchedAt: input.punchedAt,
          businessDate: dateOnlyUtc(input.businessDate),
          statusCode: input.statusCode,
          verifyMode: input.verifyMode,
          direction: input.direction as PunchDirection | null,
          source: input.source,
          workCode: input.workCode,
          idempotencyKey: key,
          rawLine: input.rawLine,
        },
      });
      return true;
    } catch (error) {
      if (isUnique(error)) return false;
      throw error;
    }
  }

  private async rebuild(
    employeeId: string,
    date: string,
    options?: { force?: boolean; overrideStatus?: 'present' | 'absent' | 'leave'; note?: string },
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return null;
    const policy = await this.policy(employee.tenantId);
    const locked = await this.isLocked(employee.tenantId, date);
    if (!canRebuild(locked, options?.force ?? false)) {
      await this.audit(employee.tenantId, null, 'attendance.punch.locked', employeeId, { date });
      return this.readDay(employee.tenantId, employeeId, date, policy.timeZone);
    }
    const shift = await this.shiftFor(employeeId, date);
    const punches = await this.prisma.attendancePunch.findMany({
      where: { employeeId, businessDate: dateOnlyUtc(date) },
      orderBy: { punchedAt: 'asc' },
    });
    const existing = await this.prisma.attendanceDay.findUnique({
      where: {
        tenantId_employeeId_attendanceDate: {
          tenantId: employee.tenantId,
          employeeId,
          attendanceDate: dateOnlyUtc(date),
        },
      },
    });
    const override = options?.overrideStatus ?? this.asOverride(existing?.overrideStatus);
    const holiday = await this.isHoliday(employee.tenantId, employee.locationId, date);
    const summary = summarizeDay({
      timeZone: policy.timeZone,
      businessDate: date,
      now: new Date(),
      shift: shift
        ? {
            startTime: shift.startTime,
            endTime: shift.endTime,
            overnight: shift.overnight,
            breakMinutes: shift.breakMinutes,
          }
        : null,
      policy: {
        graceMinutes: policy.graceMinutes,
        halfDayMaxMinutes: policy.halfDayMaxMinutes,
        duplicateWindowMinutes: policy.duplicateWindowMinutes,
      },
      holiday,
      overrideStatus: override,
      punches: punches.map((punch) => ({
        at: punch.punchedAt,
        direction: punch.direction,
      })),
    });
    if (!summary.persist) {
      return null;
    }
    const saved = await this.prisma.attendanceDay.upsert({
      where: {
        tenantId_employeeId_attendanceDate: {
          tenantId: employee.tenantId,
          employeeId,
          attendanceDate: dateOnlyUtc(date),
        },
      },
      update: {
        shiftId: shift?.id ?? null,
        status: summary.status,
        firstInAt: summary.firstInAt,
        lastOutAt: summary.lastOutAt,
        workMinutes: summary.workMinutes,
        lateMinutes: summary.lateMinutes,
        earlyMinutes: summary.earlyMinutes,
        breakMinutes: summary.breakMinutes,
        missingPunch: summary.missingPunch,
        overrideStatus: override,
        note: options?.note ?? existing?.note ?? '',
        locked,
        rebuiltAt: new Date(),
      },
      create: {
        tenantId: employee.tenantId,
        employeeId,
        attendanceDate: dateOnlyUtc(date),
        shiftId: shift?.id ?? null,
        status: summary.status,
        firstInAt: summary.firstInAt,
        lastOutAt: summary.lastOutAt,
        workMinutes: summary.workMinutes,
        lateMinutes: summary.lateMinutes,
        earlyMinutes: summary.earlyMinutes,
        breakMinutes: summary.breakMinutes,
        missingPunch: summary.missingPunch,
        overrideStatus: override,
        note: options?.note ?? '',
        locked,
      },
    });
    return this.dayView(saved, policy.timeZone);
  }

  private async materialize(
    employeeId: string,
    tenantId: string,
    year: number,
    month: number,
    timeZone: string,
  ) {
    const today = todayIso(timeZone);
    const dates = eachDate(year, month).filter((date) => date <= today);
    if (!dates.length) return;
    const stored = await this.prisma.attendanceDay.findMany({
      where: {
        tenantId,
        employeeId,
        attendanceDate: {
          gte: dateOnlyUtc(dates[0]),
          lte: dateOnlyUtc(dates[dates.length - 1]),
        },
      },
    });
    const punches = await this.prisma.attendancePunch.findMany({
      where: {
        employeeId,
        businessDate: {
          gte: dateOnlyUtc(dates[0]),
          lte: dateOnlyUtc(dates[dates.length - 1]),
        },
      },
      select: { businessDate: true, createdAt: true },
    });
    const byDay = new Map(stored.map((day) => [isoFromDateOnly(day.attendanceDate), day]));
    const punchAt = new Map<string, Date>();
    for (const punch of punches) {
      const key = isoFromDateOnly(punch.businessDate);
      const current = punchAt.get(key);
      if (!current || punch.createdAt > current) punchAt.set(key, punch.createdAt);
    }
    for (const date of dates) {
      const day = byDay.get(date);
      const latest = punchAt.get(date);
      if (day && (!latest || day.rebuiltAt >= latest)) continue;
      await this.rebuild(employeeId, date);
    }
  }

  private async daysFor(
    tenantId: string,
    employeeIds: string[],
    year: number,
    month: number,
    timeZone: string,
  ) {
    if (!employeeIds.length) return [];
    const dates = eachDate(year, month);
    const rows = await this.prisma.attendanceDay.findMany({
      where: {
        tenantId,
        employeeId: { in: employeeIds },
        attendanceDate: {
          gte: dateOnlyUtc(dates[0]),
          lte: dateOnlyUtc(dates[dates.length - 1]),
        },
      },
      orderBy: [{ attendanceDate: 'asc' }, { employeeId: 'asc' }],
    });
    return rows.map((row) => this.dayView(row, timeZone));
  }

  private async withCalendar(
    days: ReturnType<AttendanceService['dayView']>[],
    year: number,
    month: number,
    timeZone: string,
    tenantId: string,
    locationId: string | null,
  ) {
    const known = new Set(days.map((day) => day.date));
    const holidays = await this.prisma.holiday.findMany({ where: { tenantId } });
    const extra = [];
    for (const date of eachDate(year, month)) {
      if (known.has(date)) continue;
      const holiday = holidays.find(
        (item) =>
          isoFromDateOnly(item.holidayDate) === date &&
          (item.locationId == null || item.locationId === locationId),
      );
      const weekend = weekdayIndex(date, timeZone) % 6 === 0;
      if (!holiday && !weekend) continue;
      extra.push({
        date,
        employeeId: '',
        status: holiday ? 'holiday' : 'weekend',
        checkIn: null,
        checkOut: null,
        workMinutes: null,
        lateMinutes: null,
        earlyMinutes: null,
        breakMinutes: null,
        missingPunch: false,
        note: holiday?.name ?? '',
        locked: false,
      });
    }
    return [...days, ...extra].sort((a, b) => a.date.localeCompare(b.date));
  }

  private async writeManualPunches(
    employee: { id: string; tenantId: string; employeeCode: string },
    date: string,
    checkIn: string | null,
    checkOut: string | null,
    source: 'correction' | 'hr',
  ) {
    const policy = await this.policy(employee.tenantId);
    const rows: Array<{ time: string; direction: 'IN' | 'OUT'; statusCode: number }> = [];
    if (checkIn) rows.push({ time: checkIn, direction: 'IN', statusCode: 0 });
    if (checkOut) rows.push({ time: checkOut, direction: 'OUT', statusCode: 1 });
    for (const row of rows) {
      const rawTimestamp = `${date} ${row.time}:00`;
      await this.insertPunch({
        tenantId: employee.tenantId,
        employeeId: employee.id,
        deviceId: null,
        serial: source,
        pin: employee.employeeCode,
        rawTimestamp,
        punchedAt: wallToUtc(date, row.time, policy.timeZone),
        businessDate: date,
        statusCode: row.statusCode,
        verifyMode: 0,
        direction: row.direction,
        source,
        workCode: '',
        rawLine: '',
      });
    }
  }

  private async shiftFor(employeeId: string, date: string): Promise<ShiftClock & {
    id: string;
    name: string;
    breakMinutes: number;
  } | null> {
    const day = dateOnlyUtc(date);
    const rows = await this.prisma.shiftAssignment.findMany({
      where: { employeeId, effectiveFrom: { lte: day } },
      include: { shift: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    const match = rows.find((row) => !row.effectiveTo || row.effectiveTo >= day);
    if (!match) return null;
    return match.shift;
  }

  private async isHoliday(tenantId: string, locationId: string | null, date: string) {
    const rows = await this.prisma.holiday.findMany({
      where: { tenantId, holidayDate: dateOnlyUtc(date) },
    });
    return rows.some((row) => row.locationId == null || row.locationId === locationId);
  }

  private async isLocked(tenantId: string, date: string) {
    const [year, month] = date.split('-').map(Number);
    const period = await this.prisma.attendancePeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });
    return period?.status === 'locked';
  }

  private async policy(tenantId: string) {
    return this.prisma.attendancePolicy.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  private async employeeByUser(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee profile for this login.');
    return employee;
  }

  private async deviceBySerial(serial: string, presentedKey: string | undefined) {
    if (!serial) throw new ForbiddenException('Unknown device');
    const device = await this.prisma.attendanceDevice.findFirst({ where: { serial } });
    if (!device || !commKeyMatches(device.commKeyHash, presentedKey)) {
      throw new ForbiddenException('Unknown device');
    }
    return device;
  }

  private async requireDevice(tenantId: string, deviceId: string) {
    const device = await this.prisma.attendanceDevice.findFirst({
      where: { id: deviceId, tenantId },
    });
    if (!device) throw new NotFoundException('Device not found.');
    return device;
  }

  private async touch(deviceId: string) {
    await this.prisma.attendanceDevice.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
  }

  private async readDay(tenantId: string, employeeId: string, date: string, timeZone: string) {
    const day = await this.prisma.attendanceDay.findUnique({
      where: {
        tenantId_employeeId_attendanceDate: {
          tenantId,
          employeeId,
          attendanceDate: dateOnlyUtc(date),
        },
      },
    });
    return day ? this.dayView(day, timeZone) : null;
  }

  private dayView(
    day: {
      employeeId: string;
      attendanceDate: Date;
      status: AttendanceStatus;
      firstInAt: Date | null;
      lastOutAt: Date | null;
      workMinutes: number | null;
      lateMinutes: number | null;
      earlyMinutes: number | null;
      breakMinutes: number | null;
      missingPunch: boolean;
      note: string;
      locked: boolean;
    },
    timeZone: string,
  ) {
    return {
      date: isoFromDateOnly(day.attendanceDate),
      employeeId: day.employeeId,
      status: day.status as DayStatusName,
      checkIn: clockLabel(day.firstInAt, timeZone),
      checkOut: clockLabel(day.lastOutAt, timeZone),
      workMinutes: day.workMinutes,
      lateMinutes: day.lateMinutes,
      earlyMinutes: day.earlyMinutes,
      breakMinutes: day.breakMinutes,
      missingPunch: day.missingPunch,
      note: day.note,
      locked: day.locked,
    };
  }

  private correctionView(item: {
    id: string;
    employeeId: string;
    attendanceDate: Date;
    requestedStatus: AttendanceStatus;
    proposedCheckIn: string | null;
    proposedCheckOut: string | null;
    reason: string;
    status: string;
    decisionNote: string;
    createdAt: Date;
  }) {
    return {
      id: item.id,
      employeeId: item.employeeId,
      date: isoFromDateOnly(item.attendanceDate),
      requestedStatus: item.requestedStatus,
      checkIn: item.proposedCheckIn,
      checkOut: item.proposedCheckOut,
      reason: item.reason,
      status: item.status,
      decisionNote: item.decisionNote,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private person(employee?: { id: string; firstName: string; lastName: string; employeeCode: string; photo: string } | null) {
    if (!employee) return null;
    return {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      employeeCode: employee.employeeCode,
      photo: employee.photo,
    };
  }

  private snapshot(day: {
    status: AttendanceStatus;
    firstInAt: Date | null;
    lastOutAt: Date | null;
    workMinutes: number | null;
    note: string;
  }) {
    return {
      status: day.status,
      firstInAt: day.firstInAt?.toISOString() ?? null,
      lastOutAt: day.lastOutAt?.toISOString() ?? null,
      workMinutes: day.workMinutes,
      note: day.note,
    };
  }

  private asOverride(status: AttendanceStatus | null | undefined) {
    if (status === 'present' || status === 'absent' || status === 'leave') return status;
    return null;
  }

  private async audit(
    tenantId: string,
    actorUserId: string | null,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorUserId,
        action,
        entityType: 'Attendance',
        entityId,
        metadata,
      },
    });
  }
}
