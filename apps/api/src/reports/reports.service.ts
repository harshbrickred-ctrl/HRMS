import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));

    const [
      headcount,
      pendingLeave,
      pendingCorrections,
      unmatchedPunches,
      openTickets,
      absentDays,
      onLeave,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId } }),
      this.prisma.leaveRequest.count({ where: { tenantId, status: 'Pending' } }),
      this.prisma.attendanceCorrection.count({ where: { tenantId, status: 'Pending' } }),
      this.prisma.attendancePunch.count({ where: { tenantId, employeeId: null } }),
      this.prisma.helpdeskTicket.count({
        where: { tenantId, status: { in: ['Open', 'InProgress'] } },
      }),
      this.prisma.attendanceDay.count({
        where: {
          tenantId,
          status: { in: ['absent', 'missing_punch', 'half_day'] },
          attendanceDate: { gte: monthStart, lte: monthEnd },
        },
      }),
      this.prisma.leaveRequest.count({
        where: {
          tenantId,
          status: 'Approved',
          fromDate: { lte: monthEnd },
          toDate: { gte: monthStart },
        },
      }),
    ]);

    return {
      headcount,
      onLeave,
      pendingLeave,
      pendingCorrections,
      unmatchedPunches,
      openTickets,
      attendanceExceptions: absentDays,
      year,
      month,
    };
  }

  async workflows(tenantId: string) {
    const summary = await this.summary(tenantId);
    return {
      queues: [
        {
          id: 'leave',
          name: 'Leave approvals',
          stuck: summary.pendingLeave,
          href: '/manager/inbox',
        },
        {
          id: 'attendance-corrections',
          name: 'Attendance corrections',
          stuck: summary.pendingCorrections,
          href: '/hr/attendance',
        },
        {
          id: 'unmatched-pins',
          name: 'Unmatched device PINs',
          stuck: summary.unmatchedPunches,
          href: '/hr/attendance',
        },
        {
          id: 'helpdesk',
          name: 'Open helpdesk tickets',
          stuck: summary.openTickets,
          href: '/hr',
        },
      ],
    };
  }
}
