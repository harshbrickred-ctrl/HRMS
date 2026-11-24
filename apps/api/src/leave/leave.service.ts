import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dateOnlyUtc, isoFromDateOnly } from '../attendance/clock';
import { LEAVE_CATALOG, leaveTypeName } from '../hr/leave-catalog';
import { LEAVE_OFFICER_CODES } from '../rbac/role-matrix';
import { eachWorkingDate, workingDaysBetween } from './leave-days';
import type { ApplyLeaveDto, ApplyLeaveForEmployeeDto, LeaveDecisionDto } from './dto/leave.dto';

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Date must be YYYY-MM-DD.');
  }
  return value;
}

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function available(entitled: number, used: number, pending: number) {
  return Math.max(0, entitled - used - pending);
}

function resolveLeaveHalves(dto: ApplyLeaveDto, fromDate: string, toDate: string) {
  const explicit =
    dto.fromHalfStart !== undefined ||
    dto.fromHalfEnd !== undefined ||
    dto.toHalfStart !== undefined ||
    dto.toHalfEnd !== undefined;
  if (explicit) {
    return {
      fromHalfStart: Boolean(dto.fromHalfStart),
      fromHalfEnd: Boolean(dto.fromHalfEnd),
      toHalfStart: Boolean(dto.toHalfStart),
      toHalfEnd: Boolean(dto.toHalfEnd),
    };
  }
  if (fromDate === toDate) {
    return {
      fromHalfStart: Boolean(dto.halfDayStart) && !dto.halfDayEnd,
      fromHalfEnd: Boolean(dto.halfDayEnd) && !dto.halfDayStart,
      toHalfStart: false,
      toHalfEnd: false,
    };
  }
  return {
    fromHalfStart: false,
    fromHalfEnd: Boolean(dto.halfDayStart),
    toHalfStart: Boolean(dto.halfDayEnd),
    toHalfEnd: false,
  };
}

const LEAVE_OFFICERS = new Set<string>(LEAVE_OFFICER_CODES);

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly notifications: NotificationsService,
  ) {}

  async myLeave(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('No employee profile for this login.');
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      return {
        balances: this.catalogBalances(),
        requests: [],
        holidays: await this.holidayDates(user.tenantId, null),
      };
    }
    const [balances, requests, holidays] = await Promise.all([
      this.prisma.leaveBalance.findMany({ where: { employeeId: employee.id }, orderBy: { code: 'asc' } }),
      this.prisma.leaveRequest.findMany({
        where: { employeeId: employee.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.holidayDates(employee.tenantId, employee.locationId),
    ]);
    const mapped = balances.map((row) => ({
      code: row.code,
      type: leaveTypeName(row.code, row.type),
      entitled: row.entitled,
      used: row.used,
      pending: row.pending,
      available: available(row.entitled, row.used, row.pending),
    }));
    return {
      balances: mapped.length > 0 ? mapped : this.catalogBalances(),
      requests: requests.map((row) => this.view(row)),
      holidays,
    };
  }

  async apply(userId: string, dto: ApplyLeaveDto) {
    const employee = await this.employeeByUser(userId);
    return this.createRequest(employee, dto, false);
  }

  async applyForEmployee(actorUserId: string, dto: ApplyLeaveForEmployeeDto) {
    const actor = await this.actor(actorUserId);
    if (!actor.officer) {
      throw new ForbiddenException('Only HR or an admin can apply leave for an employee.');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId: actor.tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    return this.createRequest(employee, dto, true);
  }

  private async createRequest(
    employee: {
      id: string;
      tenantId: string;
      userId: string | null;
      managerId: string | null;
      locationId: string | null;
      firstName: string;
      lastName: string;
    },
    dto: ApplyLeaveDto,
    onBehalf: boolean,
  ) {
    const fromDate = assertDate(dto.fromDate);
    const toDate = assertDate(dto.toDate || dto.fromDate);
    if (toDate < fromDate) throw new BadRequestException('End date cannot be before start date.');
    const halves = resolveLeaveHalves(dto, fromDate, toDate);
    if (fromDate === toDate && (halves.fromHalfStart && halves.fromHalfEnd || halves.toHalfStart || halves.toHalfEnd)) {
      throw new BadRequestException('On a single day, choose either Half Day Start or Half Day End.');
    }
    if (fromDate !== toDate && halves.fromHalfStart && halves.fromHalfEnd) {
      throw new BadRequestException('On the From date, choose either Half Day Start or Half Day End.');
    }
    if (fromDate !== toDate && halves.toHalfStart && halves.toHalfEnd) {
      throw new BadRequestException('On the To date, choose either Half Day Start or Half Day End.');
    }
    const reason = dto.reason?.trim() ?? '';
    const today = todayIso();
    if (!onBehalf && dto.code !== 'SL' && fromDate < today) {
      throw new BadRequestException('Leave cannot be applied for a past date.');
    }
    if (!onBehalf && dto.code === 'SL' && (fromDate > today || toDate > today)) {
      throw new BadRequestException('Sick leave cannot be applied for a future date.');
    }
    const catalog = LEAVE_CATALOG.find((item) => item.code === dto.code);
    if (!catalog) throw new BadRequestException('Unknown leave type.');
    const holidays = await this.holidayIsoList(employee.tenantId, employee.locationId);
    const fromIsHalf = halves.fromHalfStart !== halves.fromHalfEnd;
    const toIsHalf = fromDate !== toDate && halves.toHalfStart !== halves.toHalfEnd;
    const days = workingDaysBetween(
      fromDate,
      toDate,
      holidays,
      fromIsHalf,
      toIsHalf,
      dto.code === 'EL',
    );
    if (days <= 0) throw new BadRequestException('Selected range has no working days.');

    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_code: { employeeId: employee.id, code: dto.code } },
    });
    if (!balance) throw new BadRequestException('Unknown leave type.');
    if (dto.code !== 'LOP') {
      const left = Math.max(0, balance.entitled - balance.used);
      if (days > left) {
        throw new BadRequestException(`Only ${left} day(s) available for ${balance.type}.`);
      }
    }

    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['Pending', 'Approved'] },
        fromDate: { lte: dateOnlyUtc(toDate) },
        toDate: { gte: dateOnlyUtc(fromDate) },
      },
    });
    if (overlap) {
      throw new ConflictException('Another leave request already covers part of that range.');
    }

    const request = await this.prisma.$transaction(async (tx) => {
      return tx.leaveRequest.create({
        data: {
          tenantId: employee.tenantId,
          employeeId: employee.id,
          code: dto.code,
          type: leaveTypeName(dto.code, catalog.type),
          fromDate: dateOnlyUtc(fromDate),
          toDate: dateOnlyUtc(toDate),
          days,
          halfDayStart: fromIsHalf,
          halfDayEnd: toIsHalf,
          fromHalfStart: halves.fromHalfStart,
          fromHalfEnd: halves.fromHalfEnd,
          toHalfStart: fromDate === toDate ? false : halves.toHalfStart,
          toHalfEnd: fromDate === toDate ? false : halves.toHalfEnd,
          reason,
          approverEmployeeId: employee.managerId,
        },
      });
    });

    const manager = employee.managerId
      ? await this.prisma.employee.findUnique({ where: { id: employee.managerId } })
      : null;
    if (manager?.userId) {
      await this.notifications.notify({
        tenantId: employee.tenantId,
        userId: manager.userId,
        title: 'Leave request pending',
        body: `${employee.firstName} ${employee.lastName} · ${catalog.type} · ${fromDate}`,
        href: '/manager/inbox',
        kind: 'leave',
      });
    } else if (!employee.managerId) {
      await this.notifyHrLeaveOfficers(employee, catalog.type, fromDate);
    }
    await this.audit(employee.tenantId, employee.userId, 'leave.request.create', request.id, {
      code: dto.code,
      days,
    });
    return this.view(request);
  }

  async withdraw(userId: string, id: string) {
    const employee = await this.employeeByUser(userId);
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, employeeId: employee.id },
    });
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'Pending') {
      throw new ConflictException('Only pending leave can be withdrawn.');
    }
    await this.prisma.$transaction(async (tx) => {
      if (request.code !== 'LOP') {
        const balance = await tx.leaveBalance.findUnique({
          where: { employeeId_code: { employeeId: employee.id, code: request.code } },
        });
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { pending: Math.max(0, balance.pending - request.days) },
          });
        }
      }
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: { status: 'Withdrawn', decidedAt: new Date() },
      });
    });
    await this.audit(employee.tenantId, employee.userId, 'leave.request.withdraw', request.id, {});
    return this.myLeave(userId);
  }

  async teamLeave(userId: string) {
    const manager = await this.employeeByUser(userId);
    const reports = await this.prisma.employee.findMany({
      where: { tenantId: manager.tenantId, managerId: manager.id },
    });
    const ids = reports.map((row) => row.id);
    const people = new Map(reports.map((row) => [row.id, row]));
    const requests = await this.prisma.leaveRequest.findMany({
      where: { tenantId: manager.tenantId, employeeId: { in: ids } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      requests: requests.map((row) => ({
        ...this.view(row),
        person: this.person(people.get(row.employeeId)),
      })),
    };
  }

  async companyLeave(userId: string) {
    const actor = await this.actor(userId);
    if (!actor.officer) {
      throw new ForbiddenException('Only HR or an admin can review company leave.');
    }
    const requests = await this.prisma.leaveRequest.findMany({
      where: { tenantId: actor.tenantId, status: 'Pending' },
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      requests: requests.map((row) => ({
        ...this.view(row),
        person: this.person(row.employee),
      })),
    };
  }

  async decide(userId: string, id: string, dto: LeaveDecisionDto) {
    const actor = await this.actor(userId);
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { employee: true },
    });
    if (!request) throw new NotFoundException('Leave request not found.');
    const isManager = actor.employee != null && request.employee.managerId === actor.employee.id;
    if (!isManager && !actor.officer) {
      throw new ForbiddenException('Only the manager, HR, or an admin can decide this leave.');
    }
    if (request.status !== 'Pending') {
      throw new ConflictException('This leave request is already decided.');
    }
    if (dto.status === 'Rejected' && !dto.note?.trim()) {
      throw new BadRequestException('A comment is required to reject leave.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (request.code !== 'LOP') {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_code: { employeeId: request.employeeId, code: request.code },
          },
        });
        if (balance) {
          if (dto.status === 'Approved') {
            const left = Math.max(0, balance.entitled - balance.used);
            if (request.days > left) {
              throw new BadRequestException(`Only ${left} day(s) left for ${request.type}.`);
            }
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                pending: Math.max(0, balance.pending - request.days),
                used: balance.used + request.days,
              },
            });
          } else {
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: { pending: Math.max(0, balance.pending - request.days) },
            });
          }
        }
      }
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: dto.status,
          decisionNote: dto.note?.trim() ?? '',
          decidedAt: new Date(),
        },
      });
    });

    if (dto.status === 'Approved') {
      const holidays = await this.holidayIsoList(
        request.tenantId,
        request.employee.locationId,
      );
      const dates = eachWorkingDate(
        isoFromDateOnly(request.fromDate),
        isoFromDateOnly(request.toDate),
        holidays,
      );
      await this.attendance.markLeaveDays(
        request.employeeId,
        dates,
        `Approved leave: ${request.reason}`,
      );
    }

    if (request.employee.userId) {
      await this.notifications.notify({
        tenantId: request.tenantId,
        userId: request.employee.userId,
        title: dto.status === 'Approved' ? 'Leave approved' : 'Leave rejected',
        body: `${request.type} · ${isoFromDateOnly(request.fromDate)}`,
        href: '/ess/leave',
        kind: 'leave',
      });
    }
    await this.audit(actor.tenantId, actor.userId, 'leave.request.decide', request.id, {
      status: dto.status,
    });
    return this.view(
      await this.prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } }),
    );
  }

  async pendingCount(tenantId: string) {
    return this.prisma.leaveRequest.count({
      where: { tenantId, status: 'Pending' },
    });
  }

  private async holidayDates(tenantId: string, locationId: string | null) {
    const rows = await this.prisma.holiday.findMany({ where: { tenantId } });
    return rows
      .filter((row) => row.locationId == null || row.locationId === locationId)
      .map((row) => ({ date: isoFromDateOnly(row.holidayDate), name: row.name }));
  }

  private async holidayIsoList(tenantId: string, locationId: string | null) {
    const rows = await this.holidayDates(tenantId, locationId);
    return rows.map((row) => row.date);
  }

  private catalogBalances() {
    return LEAVE_CATALOG.map((item) => ({
      code: item.code,
      type: item.type,
      entitled: 0,
      used: 0,
      pending: 0,
      available: 0,
    }));
  }

  private async notifyHrLeaveOfficers(
    employee: { id: string; tenantId: string; userId: string | null; firstName: string; lastName: string },
    leaveType: string,
    fromDate: string,
  ) {
    const officers = await this.prisma.user.findMany({
      where: {
        tenantId: employee.tenantId,
        status: 'ACTIVE',
        id: employee.userId ? { not: employee.userId } : undefined,
        roles: { some: { role: { code: { in: ['HRA', 'HRH', 'HRBP', 'HR_EXEC', 'HR_HEAD'] } } } },
      },
      select: { id: true },
    });
    await Promise.all(
      officers.map((officer) =>
        this.notifications.notify({
          tenantId: employee.tenantId,
          userId: officer.id,
          title: 'Leave request pending',
          body: `${employee.firstName} ${employee.lastName} · ${leaveType} · ${fromDate}`,
          href: '/hr/leave',
          kind: 'leave',
        }),
      ),
    );
  }

  private async isLeaveOfficer(userId: string) {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { code: true } } },
    });
    return rows.some((row) => LEAVE_OFFICERS.has(row.role.code));
  }

  private async actor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('No employee profile for this login.');
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    return {
      userId: user.id,
      tenantId: user.tenantId,
      employee,
      officer: await this.isLeaveOfficer(userId),
    };
  }

  private async employeeByUser(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee profile for this login.');
    return employee;
  }

  private view(row: {
    id: string;
    employeeId: string;
    code: string;
    type: string;
    fromDate: Date;
    toDate: Date;
    days: number;
    halfDayStart: boolean;
    halfDayEnd: boolean;
    fromHalfStart: boolean;
    fromHalfEnd: boolean;
    toHalfStart: boolean;
    toHalfEnd: boolean;
    reason: string;
    status: string;
    decisionNote: string;
    decidedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      code: row.code,
      type: leaveTypeName(row.code, row.type),
      typeCode: row.code,
      startDate: isoFromDateOnly(row.fromDate),
      endDate: isoFromDateOnly(row.toDate),
      days: row.days,
      halfDayStart: row.halfDayStart,
      halfDayEnd: row.halfDayEnd,
      fromHalfStart: row.fromHalfStart,
      fromHalfEnd: row.fromHalfEnd,
      toHalfStart: row.toHalfStart,
      toHalfEnd: row.toHalfEnd,
      reason: row.reason,
      status: row.status,
      decisionNote: row.decisionNote,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      submittedAt: row.createdAt.toISOString(),
    };
  }

  private person(employee?: { id: string; firstName: string; lastName: string; photo: string; employeeCode: string } | null) {
    if (!employee) return null;
    return {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      photo: employee.photo,
      employeeCode: employee.employeeCode,
    };
  }

  private async audit(
    tenantId: string,
    actorUserId: string | null,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorUserId,
        action,
        entityType: 'leave',
        entityId,
        metadata: metadata as object,
      },
    });
  }
}
