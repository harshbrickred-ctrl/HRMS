import { BadRequestException, Injectable } from '@nestjs/common';
import type { AssetStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STATUS_LABELS, WARRANTY_WINDOW_DAYS } from './asset-rules';
import {
  AssetSupport,
  assetLabelOf,
  day,
  dayOrNull,
  fullName,
  toDay,
  today,
} from './asset-support.service';

const DAY_MS = 86_400_000;
/** Assets that have left the company do not count towards stock or cost. */
const OFF_BOOKS: AssetStatus[] = ['disposed', 'written_off'];

@Injectable()
export class AssetReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AssetSupport,
  ) {}

  /** Everything on the asset dashboard, narrowed to one location or category when asked. */
  async dashboard(tenantId: string, filters: { locationId?: string; categoryId?: string } = {}) {
    const scope: Prisma.AssetWhereInput = {
      tenantId,
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    };
    const now = today();
    const soon = new Date(now.getTime() + WARRANTY_WINDOW_DAYS * DAY_MS);
    const open = (where: Prisma.AssetAssignmentWhereInput) =>
      this.prisma.assetAssignment.count({ where: { tenantId, returnedOn: null, asset: scope, ...where } });
    const pendingRequests: Prisma.AssetRequestWhereInput = {
      tenantId,
      status: { in: ['pending_manager', 'pending_head', 'approved'] },
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    };
    const [
      statusCounts,
      categories,
      categoryCounts,
      locations,
      locationCounts,
      warrantyEnding,
      overdue,
      unacknowledged,
      ackLate,
      openFaults,
      pending,
      pendingOld,
      activity,
    ] = await Promise.all([
      this.prisma.asset.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
      this.prisma.assetCategory.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      this.prisma.asset.groupBy({ by: ['categoryId', 'status'], where: scope, _count: { _all: true } }),
      this.prisma.location.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      this.prisma.asset.groupBy({ by: ['locationId', 'status'], where: scope, _count: { _all: true } }),
      this.prisma.asset.count({
        where: { ...scope, status: { notIn: OFF_BOOKS }, warrantyExpiry: { gte: now, lte: soon } },
      }),
      open({ expectedReturnOn: { lt: now } }),
      open({ ackStatus: 'pending' }),
      open({ ackStatus: 'pending', ackDueOn: { lt: now } }),
      this.prisma.assetTicket.count({
        where: { tenantId, type: 'Issue', status: { in: ['Open', 'InProgress'] }, asset: scope },
      }),
      this.prisma.assetRequest.count({ where: pendingRequests }),
      this.prisma.assetRequest.count({
        where: { ...pendingRequests, updatedAt: { lt: new Date(Date.now() - 3 * DAY_MS) } },
      }),
      this.prisma.assetStatusHistory.findMany({
        where: { tenantId, asset: scope },
        include: { asset: { include: { location: true } } },
        orderBy: { changedAt: 'desc' },
        take: 6,
      }),
    ]);
    const count = (status: AssetStatus) => statusCounts.find((row) => row.status === status)?._count._all ?? 0;
    const total = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
    const placeIds = new Set(locationCounts.map((row) => row.locationId));
    const byLocation = [...locations, ...(placeIds.has(null) ? [{ id: null, name: 'Not set' }] : [])]
      .map((location) => {
        const rows = locationCounts.filter((row) => row.locationId === location.id);
        const of = (status: AssetStatus) => rows.find((row) => row.status === status)?._count._all ?? 0;
        return {
          location: location.name,
          locationId: location.id,
          total: rows.reduce((sum, row) => sum + row._count._all, 0),
          allocated: of('allocated'),
          inStock: of('in_stock'),
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);
    return {
      total,
      locations: byLocation.filter((row) => row.locationId).length,
      available: count('in_stock'),
      allocated: count('allocated'),
      underMaintenance: count('under_maintenance'),
      lost: count('lost'),
      retired: count('retired'),
      warrantyEnding,
      pendingApprovals: pending,
      pendingOlderThan3Days: pendingOld,
      attention: { warranty: warrantyEnding, overdue, unacknowledged, ackLate, lost: count('lost'), openFaults },
      byLocation,
      activity: activity.map((row) => ({
        id: row.id,
        assetId: row.assetId,
        title: `${assetLabelOf(row.asset)} ${row.asset.assetTag}: ${row.reason || STATUS_LABELS[row.toStatus]}`,
        place: row.asset.location?.name ?? null,
        at: row.changedAt.toISOString(),
      })),
      byStatus: (Object.keys(STATUS_LABELS) as AssetStatus[]).map((status) => ({
        status,
        label: STATUS_LABELS[status],
        count: count(status),
      })),
      byCategory: categories
        .map((category) => {
          const rows = categoryCounts.filter((row) => row.categoryId === category.id);
          const of = (status: AssetStatus) => rows.find((row) => row.status === status)?._count._all ?? 0;
          return {
            category: category.name,
            total: rows.reduce((sum, row) => sum + row._count._all, 0),
            available: of('in_stock'),
            allocated: of('allocated'),
            underMaintenance: of('under_maintenance'),
            other: of('lost') + of('retired') + of('disposed') + of('written_off'),
          };
        })
        .filter((row) => row.total > 0),
    };
  }

  report(tenantId: string, kind: string, query: { days?: string; from?: string; to?: string }) {
    switch (kind) {
      case 'stock':
        return this.stock(tenantId);
      case 'allocations':
        return this.allocationRows(tenantId);
      case 'employees':
        return this.employees(tenantId);
      case 'overdue':
        return this.overdue(tenantId);
      case 'warranty':
        return this.warranty(tenantId, Number(query.days) || 90);
      case 'department-cost':
        return this.departmentCost(tenantId);
      case 'history':
        return this.history(tenantId, query.from, query.to);
      default:
        throw new BadRequestException(`Unknown report "${kind}".`);
    }
  }

  private async stock(tenantId: string) {
    const rows = await this.prisma.asset.findMany({
      where: { tenantId },
      include: { category: true, location: true },
    });
    const groups = new Map<string, Record<string, string | number>>();
    for (const row of rows) {
      const key = `${row.categoryId}|${row.locationId ?? ''}`;
      const group = groups.get(key) ?? {
        category: row.category.name,
        location: row.location?.name ?? 'Not set',
        total: 0,
        in_stock: 0,
        allocated: 0,
        under_maintenance: 0,
        lost: 0,
        retired: 0,
        disposed: 0,
        written_off: 0,
      };
      group.total = Number(group.total) + 1;
      group[row.status] = Number(group[row.status]) + 1;
      groups.set(key, group);
    }
    return [...groups.values()].sort(
      (a, b) =>
        String(a.category).localeCompare(String(b.category)) ||
        String(a.location).localeCompare(String(b.location)),
    );
  }

  private async allocationRows(tenantId: string) {
    const rows = await this.prisma.assetAssignment.findMany({
      where: { tenantId, returnedOn: null },
      include: {
        asset: { include: { category: true } },
        employee: { include: { department: true } },
      },
      orderBy: { assignedOn: 'desc' },
    });
    return rows.map((row) => ({
      assetId: row.assetId,
      assetTag: row.asset.assetTag,
      asset: row.asset.name,
      category: row.asset.category.name,
      serialNo: row.asset.serialNo ?? '',
      employeeId: row.employeeId,
      employee: fullName(row.employee),
      employeeCode: row.employee.employeeCode,
      department: row.employee.department?.name ?? '',
      assignedOn: day(row.assignedOn),
      expectedReturnOn: dayOrNull(row.expectedReturnOn),
      ackStatus: row.ackStatus,
    }));
  }

  private async employees(tenantId: string) {
    const rows = await this.allocationRows(tenantId);
    const groups = new Map<string, { employeeId: string; employee: string; employeeCode: string; department: string; count: number; assets: string[]; pendingAck: number }>();
    for (const row of rows) {
      const group = groups.get(row.employeeId) ?? {
        employeeId: row.employeeId,
        employee: row.employee,
        employeeCode: row.employeeCode,
        department: row.department,
        count: 0,
        assets: [],
        pendingAck: 0,
      };
      group.count += 1;
      group.assets.push(`${row.assetTag} ${row.asset}`);
      if (row.ackStatus === 'pending') group.pendingAck += 1;
      groups.set(row.employeeId, group);
    }
    return [...groups.values()]
      .map((group) => ({ ...group, assets: group.assets.join('; ') }))
      .sort((a, b) => a.employee.localeCompare(b.employee));
  }

  private async overdue(tenantId: string) {
    const now = today();
    const rows = await this.prisma.assetAssignment.findMany({
      where: { tenantId, returnedOn: null, expectedReturnOn: { lt: now } },
      include: { asset: true, employee: true },
      orderBy: { expectedReturnOn: 'asc' },
    });
    return rows.map((row) => ({
      assetId: row.assetId,
      assetTag: row.asset.assetTag,
      asset: row.asset.name,
      employee: fullName(row.employee),
      employeeCode: row.employee.employeeCode,
      assignedOn: day(row.assignedOn),
      expectedReturnOn: day(row.expectedReturnOn!),
      daysOverdue: Math.round((now.getTime() - row.expectedReturnOn!.getTime()) / DAY_MS),
    }));
  }

  private async warranty(tenantId: string, days: number) {
    const now = today();
    const until = new Date(now.getTime() + Math.min(Math.max(days, 1), 730) * DAY_MS);
    const rows = await this.prisma.asset.findMany({
      where: { tenantId, status: { notIn: OFF_BOOKS }, warrantyExpiry: { lte: until } },
      include: { category: true },
      orderBy: { warrantyExpiry: 'asc' },
    });
    return rows.map((row) => ({
      assetId: row.id,
      assetTag: row.assetTag,
      asset: row.name,
      category: row.category.name,
      status: STATUS_LABELS[row.status],
      warrantyExpiry: day(row.warrantyExpiry!),
      daysLeft: Math.round((row.warrantyExpiry!.getTime() - now.getTime()) / DAY_MS),
    }));
  }

  /** Assets count towards whoever holds them today; the rest show as unallocated. */
  private async departmentCost(tenantId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, status: { notIn: OFF_BOOKS } },
      include: {
        maintenance: true,
        assignments: { where: { returnedOn: null }, include: { employee: { include: { department: true } } } },
      },
    });
    const groups = new Map<string, { department: string; assets: number; cost: number; repairCost: number }>();
    for (const asset of assets) {
      const holder = asset.assignments[0]?.employee;
      const department = holder ? (holder.department?.name ?? 'No department') : 'Unallocated';
      const group = groups.get(department) ?? { department, assets: 0, cost: 0, repairCost: 0 };
      group.assets += 1;
      group.cost += asset.cost?.toNumber() ?? 0;
      group.repairCost += asset.maintenance.reduce((sum, row) => sum + (row.cost?.toNumber() ?? 0), 0);
      groups.set(department, group);
    }
    return [...groups.values()].sort((a, b) => b.cost - a.cost);
  }

  private async history(tenantId: string, from?: string, to?: string) {
    const start = toDay(from);
    const end = toDay(to);
    if (start && end && end < start) throw new BadRequestException('The end date is before the start date.');
    const rows = await this.prisma.assetStatusHistory.findMany({
      where: {
        tenantId,
        changedAt: {
          ...(start ? { gte: start } : {}),
          ...(end ? { lt: new Date(end.getTime() + DAY_MS) } : {}),
        },
      },
      include: { asset: true },
      orderBy: { changedAt: 'desc' },
      take: 2000,
    });
    const names = await this.support.userNames(
      tenantId,
      rows.map((row) => row.changedById),
    );
    return rows.map((row) => ({
      assetId: row.assetId,
      assetTag: row.asset.assetTag,
      asset: assetLabelOf(row.asset),
      changedAt: row.changedAt.toISOString(),
      from: STATUS_LABELS[row.fromStatus],
      to: STATUS_LABELS[row.toStatus],
      reason: row.reason,
      changedBy: row.changedById ? (names.get(row.changedById) ?? '') : '',
    }));
  }
}
