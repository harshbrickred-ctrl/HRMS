import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssetMaintenanceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WARRANTY_WINDOW_DAYS, assertMove, depreciation, ticketReference } from './asset-rules';

/** A plain recommendation for a batch whose warranty is about to end. */
function warrantySuggestion(cost: number, bookValue: number, assets: number) {
  if (cost <= 0) return 'Check the purchase record, then decide';
  if (bookValue / cost < 0.25) return 'Let lapse, plan a refresh';
  if (cost / assets >= 50_000) return 'Extend for 1 year, cover critical roles';
  return 'Let lapse, repair on demand';
}
import {
  AssetSupport,
  assetInclude,
  day,
  dayOrNull,
  isPrismaError,
  toDay,
  today,
  type Tx,
} from './asset-support.service';
import { assetView } from './assets.service';
import type {
  CompleteMaintenanceDto,
  OpenMaintenanceDto,
  UpdateMaintenanceDto,
} from './dto/assets.dto';

const maintenanceInclude = {
  asset: { include: { category: true, location: true } },
  ticket: { include: { employee: true } },
} satisfies Prisma.AssetMaintenanceInclude;

const DAY_MS = 86_400_000;
const STAGES = ['with_vendor', 'testing', 'ready'] as const;

type MaintenanceRow = Prisma.AssetMaintenanceGetPayload<{ include: typeof maintenanceInclude }>;

@Injectable()
export class AssetMaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AssetSupport,
  ) {}

  /**
   * Opens a repair record and moves an in-stock asset to Under Maintenance. Allocated assets
   * go through Return first, which opens the record itself.
   */
  async open(tenantId: string, actorUserId: string, assetId: string, dto: OpenMaintenanceDto) {
    const asset = await this.support.requireAsset(tenantId, assetId);
    if (asset.status === 'allocated') {
      throw new BadRequestException('Return this asset first, so its condition is recorded.');
    }
    const issue = dto.issue.trim();
    if (!issue) throw new BadRequestException('Describe the issue.');
    const startedOn = toDay(dto.startedOn) ?? today();
    if (startedOn > today()) throw new BadRequestException('Start date cannot be in the future.');
    const expectedOn = toDay(dto.expectedOn);
    if (expectedOn && expectedOn < startedOn) {
      throw new BadRequestException('Expected completion cannot be before the start date.');
    }
    const ticket = dto.ticketId
      ? await this.prisma.assetTicket.findFirst({ where: { id: dto.ticketId, tenantId, assetId } })
      : null;
    if (dto.ticketId && !ticket) throw new NotFoundException('That report is not for this asset.');
    if (asset.status !== 'under_maintenance') assertMove(asset.status, 'under_maintenance');

    const details = {
      issue,
      vendor: dto.vendor?.trim() ?? '',
      vendorContact: dto.vendorContact?.trim() ?? '',
      startedOn,
      expectedOn,
      cost: dto.estimatedCost ?? null,
      ticketId: ticket?.id ?? null,
    };
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.assetMaintenance.findFirst({ where: { assetId, status: 'open' } });
        if (existing) throw new ConflictException('This asset already has an open repair record.');
        if (asset.status !== 'under_maintenance') {
          const moved = await tx.asset.updateMany({
            where: { id: assetId, status: asset.status },
            data: { status: 'under_maintenance', updatedById: actorUserId },
          });
          if (moved.count === 0) throw new ConflictException('This asset has just changed. Reload and try again.');
          await this.support.recordStatus(tx, {
            tenantId,
            assetId,
            from: asset.status,
            to: 'under_maintenance',
            reason: issue,
            source: 'maintenance',
            changedById: actorUserId,
          });
        }
        await tx.assetMaintenance.create({
          data: { tenantId, assetId, ...details, createdById: actorUserId, updatedById: actorUserId },
        });
        if (ticket) {
          await tx.assetTicket.update({ where: { id: ticket.id }, data: { status: 'InProgress' } });
        }
        return tx.asset.findUniqueOrThrow({ where: { id: assetId }, include: assetInclude });
      });
      await this.support.audit(tenantId, actorUserId, 'assets.maintenance.open', assetId, { vendor: details.vendor });
      return assetView(updated);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) throw new ConflictException('This asset already has an open repair record.');
      throw error;
    }
  }

  /** Used by return and status changes that send an asset for repair, so every repair has a record. */
  openFromLifecycle(
    tx: Tx,
    input: {
      tenantId: string;
      assetId: string;
      issue: string;
      actorUserId: string;
      startedOn: Date;
      ticketId?: string | null;
    },
  ) {
    return tx.assetMaintenance.create({
      data: {
        tenantId: input.tenantId,
        assetId: input.assetId,
        ticketId: input.ticketId ?? null,
        issue: input.issue.slice(0, 1000),
        startedOn: input.startedOn,
        createdById: input.actorUserId,
        updatedById: input.actorUserId,
      },
    });
  }

  async update(tenantId: string, actorUserId: string, id: string, dto: UpdateMaintenanceDto) {
    const record = await this.prisma.assetMaintenance.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Repair record not found.');
    if (record.status !== 'open') throw new ConflictException('This repair record is already complete.');
    const expectedOn = dto.expectedOn === undefined ? undefined : toDay(dto.expectedOn);
    if (expectedOn && expectedOn < record.startedOn) {
      throw new BadRequestException('Expected completion cannot be before the start date.');
    }
    await this.prisma.assetMaintenance.update({
      where: { id },
      data: {
        vendor: dto.vendor?.trim(),
        vendorContact: dto.vendorContact?.trim(),
        expectedOn,
        cost: dto.estimatedCost,
        updatedById: actorUserId,
      },
    });
    await this.support.audit(tenantId, actorUserId, 'assets.maintenance.update', record.assetId);
    return this.view(
      await this.prisma.assetMaintenance.findUniqueOrThrow({ where: { id }, include: maintenanceInclude }),
    );
  }

  /** Repaired assets return to stock; anything beyond repair is retired. */
  async complete(tenantId: string, actorUserId: string, id: string, dto: CompleteMaintenanceDto) {
    const record = await this.prisma.assetMaintenance.findFirst({
      where: { id, tenantId },
      include: maintenanceInclude,
    });
    if (!record) throw new NotFoundException('Repair record not found.');
    if (record.status !== 'open') throw new ConflictException('This repair record is already complete.');
    const completedOn = toDay(dto.completedOn) ?? today();
    if (completedOn > today()) throw new BadRequestException('Completion date cannot be in the future.');
    if (completedOn < record.startedOn) {
      throw new BadRequestException('Completion date cannot be before the start date.');
    }
    const next = dto.outcome === 'repaired' ? 'in_stock' : 'retired';
    assertMove(record.asset.status, next);
    const cost = dto.cost ?? record.cost;
    await this.prisma.$transaction(async (tx) => {
      const closed = await tx.assetMaintenance.updateMany({
        where: { id, status: 'open' },
        data: {
          status: 'completed',
          completedOn,
          cost,
          vendor: dto.vendor?.trim() || record.vendor,
          outcome: dto.outcome,
          outcomeNotes: dto.outcomeNotes?.trim() ?? '',
          updatedById: actorUserId,
        },
      });
      if (closed.count === 0) throw new ConflictException('This repair record is already complete.');
      const moved = await tx.asset.updateMany({
        where: { id: record.assetId, status: 'under_maintenance' },
        data: { status: next, updatedById: actorUserId },
      });
      if (moved.count === 0) throw new ConflictException('This asset has just changed. Reload and try again.');
      await this.support.recordStatus(tx, {
        tenantId,
        assetId: record.assetId,
        from: 'under_maintenance',
        to: next,
        reason: dto.outcome === 'repaired' ? 'Repair completed' : 'Beyond repair',
        source: 'maintenance',
        changedById: actorUserId,
      });
      if (record.ticketId) {
        await tx.assetTicket.update({ where: { id: record.ticketId }, data: { status: 'Resolved' } });
      }
    });
    await this.support.audit(tenantId, actorUserId, 'assets.maintenance.complete', record.assetId, { outcome: dto.outcome });
    if (record.ticket) {
      await this.support.notifyUser(tenantId, record.ticket.employee.userId, {
        title: `Asset report ${ticketReference(record.ticket.number)}: Resolved`,
        body: `${record.asset.assetTag} repair is complete.`,
        href: '/ess/assets/reports',
      });
    }
    return this.view(
      await this.prisma.assetMaintenance.findUniqueOrThrow({ where: { id }, include: maintenanceInclude }),
    );
  }

  async list(tenantId: string, filters: { status?: string; assetId?: string }) {
    if (filters.status && !(filters.status in AssetMaintenanceStatus)) {
      throw new BadRequestException('Unknown maintenance status.');
    }
    const rows = await this.prisma.assetMaintenance.findMany({
      where: {
        tenantId,
        ...(filters.status ? { status: filters.status as AssetMaintenanceStatus } : {}),
        ...(filters.assetId ? { assetId: filters.assetId } : {}),
      },
      include: maintenanceInclude,
      orderBy: [{ status: 'asc' }, { startedOn: 'desc' }],
      take: 500,
    });
    return rows.map((row) => this.view(row));
  }

  /** Moves an open repair along the board: with the vendor, being tested, ready to go back. */
  async setStage(tenantId: string, actorUserId: string, id: string, stage: (typeof STAGES)[number]) {
    const record = await this.prisma.assetMaintenance.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Repair record not found.');
    if (record.status !== 'open') throw new ConflictException('This repair record is already complete.');
    await this.prisma.assetMaintenance.update({ where: { id }, data: { stage, updatedById: actorUserId } });
    await this.support.audit(tenantId, actorUserId, 'assets.maintenance.stage', record.assetId, { stage });
    return this.view(
      await this.prisma.assetMaintenance.findUniqueOrThrow({ where: { id }, include: maintenanceInclude }),
    );
  }

  /** Figures and warranty batches for the maintenance and warranty screen. */
  async overview(tenantId: string) {
    const now = today();
    const since = new Date(now.getTime() - 90 * DAY_MS);
    const soon = new Date(now.getTime() + WARRANTY_WINDOW_DAYS * DAY_MS);
    const [overdue, completed, expiring] = await Promise.all([
      this.prisma.assetMaintenance.count({ where: { tenantId, status: 'open', expectedOn: { lt: now } } }),
      this.prisma.assetMaintenance.findMany({
        where: { tenantId, status: 'completed', completedOn: { gte: since } },
        select: { startedOn: true, completedOn: true },
      }),
      this.prisma.asset.findMany({
        where: {
          tenantId,
          status: { notIn: ['disposed', 'written_off'] },
          warrantyExpiry: { gte: now, lte: soon },
        },
        include: { category: true },
        orderBy: { warrantyExpiry: 'asc' },
      }),
    ]);
    const days = completed.map((row) => (row.completedOn!.getTime() - row.startedOn.getTime()) / DAY_MS);

    // Assets bought together tend to expire together, so they are decided on as one batch.
    const batches = new Map<
      string,
      { name: string; category: string; vendor: string; boughtOn: string | null; endsOn: string; assets: number; cost: number; bookValue: number }
    >();
    for (const asset of expiring) {
      const bought = asset.purchasedOn ? day(asset.purchasedOn).slice(0, 7) : null;
      const key = `${asset.name}|${bought ?? ''}|${asset.vendor}`;
      const cost = asset.cost?.toNumber() ?? 0;
      const value = depreciation(cost, asset.purchasedOn, asset.category.usefulLifeMonths, now)?.bookValue ?? 0;
      const batch = batches.get(key) ?? {
        name: asset.name,
        category: asset.category.name,
        vendor: asset.vendor,
        boughtOn: bought,
        endsOn: day(asset.warrantyExpiry!),
        assets: 0,
        cost: 0,
        bookValue: 0,
      };
      batch.assets += 1;
      batch.cost += cost;
      batch.bookValue += value;
      batches.set(key, batch);
    }
    return {
      overdueRepairs: overdue,
      averageRepairDays: days.length ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length) : null,
      repairsCompleted90Days: days.length,
      warrantyEnding: expiring.length,
      warrantyBatches: [...batches.values()].map((batch) => ({
        ...batch,
        suggestion: warrantySuggestion(batch.cost, batch.bookValue, batch.assets),
      })),
    };
  }

  private view(row: MaintenanceRow) {
    const now = today();
    return {
      id: row.id,
      asset: {
        id: row.asset.id,
        assetTag: row.asset.assetTag,
        name: row.asset.name,
        category: row.asset.category.name,
        location: row.asset.location?.name ?? null,
      },
      stage: row.stage,
      inWarranty: !!row.asset.warrantyExpiry && row.asset.warrantyExpiry >= row.startedOn,
      daysOpen: Math.max(0, Math.round(((row.completedOn ?? now).getTime() - row.startedOn.getTime()) / DAY_MS)),
      ticketReference: row.ticket ? ticketReference(row.ticket.number) : null,
      issue: row.issue,
      vendor: row.vendor,
      vendorContact: row.vendorContact,
      startedOn: day(row.startedOn),
      expectedOn: dayOrNull(row.expectedOn),
      completedOn: dayOrNull(row.completedOn),
      cost: row.cost?.toNumber() ?? null,
      outcome: row.outcome,
      outcomeNotes: row.outcomeNotes,
      status: row.status,
      overdue: row.status === 'open' && !!row.expectedOn && row.expectedOn < today(),
    };
  }
}
