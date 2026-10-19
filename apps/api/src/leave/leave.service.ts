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
import { LEAVE_CATALOG } from '../hr/leave-catalog';
import { eachWorkingDate, workingDaysBetween } from './leave-days';
import type { ApplyLeaveDto, LeaveDecisionDto } from './dto/leave.dto';

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Date must be YYYY-MM-DD.');
  }
  return value;
}

function available(entitled: number, used: number, pending: number) {
  return Math.max(0, entitled - used - pending);
}

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly notifications: NotificationsService,
  ) {}

  async myLeave(userId: string) {
    const employee = await this.employeeByUser(userId);
    const [balances, requests, holidays] = await Promise.all([
      this.prisma.leaveBalance.findMany({ where: { employeeId: employee.id }, orderBy: { code: 'asc' } }),
      this.prisma.leaveRequest.findMany({
        where: { employeeId: employee.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.holidayDates(employee.tenantId, employee.locationId),
    ]);
    return {
      balances: balances.map((row) => ({
        code: row.code,
        type: row.type,
        entitled: row.entitled,
        used: row.used,
        pending: row.pending,
        available: available(row.entitled, row.used, row.pending),
      })),
      requests: requests.map((row) => this.view(row)),
      holidays,
    };
  }

  async apply(userId: string, dto: ApplyLeaveDto) {
    const employee = await this.employeeByUser(userId);
    const fromDate = assertDate(dto.fromDate);
    const toDate = assertDate(dto.toDate || dto.fromDate);
    if (toDate < fromDate) throw new BadRequestException('End date cannot be before start date.');
    if (!dto.reason.trim()) throw new BadRequestException('Reason is required.');
    if (!employee.managerId) {
      throw new BadRequestException('No manager is assigned for this leave request.');
    }
    const catalog = LEAVE_CATALOG.find((item) => item.code === dto.code);
    if (!catalog) throw new BadRequestException('Unknown leave type.');
    const holidays = await this.holidayIsoList(employee.tenantId, employee.locationId);
    const days = workingDaysBetween(
      fromDate,
      toDate,
      holidays,
      Boolean(dto.halfDayStart),
      Boolean(dto.halfDayEnd),
    );
    if (days <= 0) throw new BadRequestException('Selected range has no working days.');

    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_code: { employeeId: employee.id, code: dto.code } },
    });
    if (!balance) throw new BadRequestException('Unknown leave type.');
    if (dto.code !== 'LOP') {
      const left = available(balance.entitled, balance.used, balance.pending);
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
      if (dto.code !== 'LOP') {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pending: balance.pending + days },
        });
      }
      return tx.leaveRequest.create({
        data: {
          tenantId: employee.tenantId,
          employeeId: employee.id,
          code: dto.code,
          type: catalog.type,
          fromDate: dateOnlyUtc(fromDate),
          toDate: dateOnlyUtc(toDate),
          days,
          halfDayStart: Boolean(dto.halfDayStart),
          halfDayEnd: Boolean(dto.halfDayEnd),
          reason: dto.reason.trim(),
          approverEmployeeId: employee.managerId,
        },
      });
    });

    const manager = await this.prisma.employee.findUnique({ where: { id: employee.managerId } });
    if (manager?.userId) {
      await this.notifications.notify({
        tenantId: employee.tenantId,
        userId: manager.userId,
        title: 'Leave request pending',
        body: `${employee.firstName} ${employee.lastName} · ${catalog.type} · ${fromDate}`,
        href: '/manager/inbox',
        kind: 'leave',
      });
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

  async decide(userId: string, id: string, dto: LeaveDecisionDto) {
    const manager = await this.employeeByUser(userId);
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId: manager.tenantId },
      include: { employee: true },
    });
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.employee.managerId !== manager.id) {
      throw new ForbiddenException('This leave belongs to another manager.');
    }
    if (request.status !== 'Pending') {
      throw new ConflictException('This leave request is already decided.');
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
    await this.audit(manager.tenantId, manager.userId, 'leave.request.decide', request.id, {
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
      type: row.type,
      typeCode: row.code,
      startDate: isoFromDateOnly(row.fromDate),
      endDate: isoFromDateOnly(row.toDate),
      days: row.days,
      halfDayStart: row.halfDayStart,
      halfDayEnd: row.halfDayEnd,
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
