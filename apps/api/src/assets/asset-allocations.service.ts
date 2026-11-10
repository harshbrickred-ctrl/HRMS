import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type AssetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssetMaintenanceService } from './asset-maintenance.service';
import { addWorkingDays, assertMove, RETURN_REQUEST, RETURN_STATUS, STATUS_LABELS } from './asset-rules';
import {
  AssetSupport,
  DOCUMENT_EXT,
  PHOTO_EXT,
  assetInclude,
  day,
  dayOrNull,
  fullName,
  isPrismaError,
  person,
  toDay,
  today,
  type AssetUpload,
  type Tx,
} from './asset-support.service';
import type {
  AllocateAssetDto,
  ChangeAssetStatusDto,
  ReturnAssetDto,
  SignedFormDto,
  TransferAssetDto,
} from './dto/assets.dto';
import { assetView } from './assets.service';

const allocationInclude = {
  employee: true,
  files: { orderBy: { uploadedAt: 'asc' as const } },
} satisfies Prisma.AssetAssignmentInclude;

type AllocationRow = Prisma.AssetAssignmentGetPayload<{ include: typeof allocationInclude }>;

@Injectable()
export class AssetAllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AssetSupport,
    private readonly maintenance: AssetMaintenanceService,
  ) {}

  /**
   * Issues an in-stock asset. The status update only succeeds while the asset is still
   * in stock, and the one-open-allocation index backs that up, so concurrent requests cannot both win.
   */
  async allocate(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: AllocateAssetDto,
    afterAllocate?: (tx: Tx, assignmentId: string) => Promise<unknown>,
  ) {
    const asset = await this.support.requireAsset(tenantId, id);
    if (asset.status === 'allocated') throw new ConflictException('This asset is already allocated.');
    assertMove(asset.status, 'allocated');
    const employee = await this.support.requireActiveEmployee(tenantId, dto.employeeId);
    const issuedOn = toDay(dto.issuedOn) ?? today();
    this.assertNotFuture(issuedOn, 'Issue date');
    const expectedReturnOn = toDay(dto.expectedReturnOn);
    if (expectedReturnOn && expectedReturnOn < issuedOn) {
      throw new BadRequestException('Expected return cannot be before the issue date.');
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.moveStatus(tx, id, 'in_stock', 'allocated', actorUserId);
        const assignment = await tx.assetAssignment.create({
          data: {
            tenantId,
            assetId: id,
            employeeId: employee.id,
            assignedOn: issuedOn,
            expectedReturnOn,
            issueCondition: dto.condition,
            accessories: dto.accessories?.trim() ?? '',
            conditionNotes: dto.notes?.trim() ?? '',
            project: dto.project?.trim() ?? '',
            contactMobile: dto.contactMobile?.trim() ?? '',
            employmentType: dto.employmentType?.trim() ?? '',
            issuedById: actorUserId,
            ackDueOn: dto.ackWithinDays ? addWorkingDays(issuedOn, dto.ackWithinDays) : null,
          },
        });
        await this.support.recordStatus(tx, {
          tenantId,
          assetId: id,
          from: 'in_stock',
          to: 'allocated',
          reason: `Allocated to ${fullName(employee)}`,
          source: 'allocation',
          changedById: actorUserId,
        });
        await afterAllocate?.(tx, assignment.id);
        return tx.asset.findUniqueOrThrow({ where: { id }, include: assetInclude });
      });
      await this.support.audit(tenantId, actorUserId, 'assets.allocate', id, { employeeId: employee.id });
      const dueOn = updated.assignments[0]?.ackDueOn;
      await this.support.notifyUser(tenantId, employee.userId, {
        title: 'Asset issued: please acknowledge',
        body: `${asset.assetTag} (${asset.name}) is now with you. Confirm you received it${dueOn ? ` by ${day(dueOn)}` : ''}.`,
      });
      if (dto.notifyManager && employee.managerId) {
        const manager = await this.prisma.employee.findUnique({ where: { id: employee.managerId } });
        await this.support.notifyUser(tenantId, manager?.userId, {
          title: `Asset issued to ${fullName(employee)}`,
          body: `${asset.assetTag} (${asset.name})`,
        });
      }
      return assetView(updated);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) throw new ConflictException('This asset is already allocated.');
      throw error;
    }
  }

  /** Good returns go to stock; anything else goes to maintenance, so it is never reissued unchecked. */
  async returnAsset(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: ReturnAssetDto,
    photos: AssetUpload[] = [],
  ) {
    const asset = await this.support.requireAsset(tenantId, id);
    const open = asset.assignments[0];
    if (asset.status !== 'allocated' || !open) {
      throw new BadRequestException('Only an allocated asset can be returned.');
    }
    const next = RETURN_STATUS[dto.condition];
    assertMove(asset.status, next);
    const returnedOn = toDay(dto.returnedOn) ?? today();
    this.assertNotFuture(returnedOn, 'Return date');
    if (returnedOn < toDay(day(open.assignedOn))!) {
      throw new BadRequestException('Return date cannot be before the issue date.');
    }
    const saved = await Promise.all(
      photos.map((photo) => this.support.saveFile(tenantId, `returns/${open.id}`, photo, PHOTO_EXT)),
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.assetAssignment.updateMany({
        where: { id: open.id, returnedOn: null },
        data: {
          returnedOn,
          returnCondition: dto.condition,
          damageNotes: dto.damageNotes?.trim() ?? '',
          inspectionNotes: dto.inspectionNotes?.trim() ?? '',
          returnedById: actorUserId,
          endReason: 'returned',
        },
      });
      if (closed.count === 0) throw new ConflictException('This asset has already been returned.');
      await tx.assetAssignmentFile.createMany({
        data: saved.map((file) => ({
          assignmentId: open.id,
          kind: 'return_photo',
          fileName: file.fileName,
          storagePath: file.storagePath,
          uploadedById: actorUserId,
        })),
      });
      await this.moveStatus(tx, id, 'allocated', next, actorUserId);
      await this.support.recordStatus(tx, {
        tenantId,
        assetId: id,
        from: 'allocated',
        to: next,
        reason: `Returned by ${fullName(open.employee)} (${dto.condition.replace(/_/g, ' ')})`,
        source: 'return',
        changedById: actorUserId,
      });
      if (next === 'under_maintenance') {
        // The holder's own fault report travels with the repair, so it closes when the repair does.
        const fault = await tx.assetTicket.findFirst({
          where: { assetId: id, type: 'Issue', status: 'Open' },
          orderBy: { createdAt: 'desc' },
        });
        await this.maintenance.openFromLifecycle(tx, {
          tenantId,
          assetId: id,
          issue: dto.damageNotes?.trim() || fault?.body || `Returned: ${dto.condition.replace(/_/g, ' ')}`,
          actorUserId,
          startedOn: returnedOn,
          ticketId: fault?.id ?? null,
        });
        if (fault) await tx.assetTicket.update({ where: { id: fault.id }, data: { status: 'InProgress' } });
      }
      // The employee's own request to hand it back is now done.
      await tx.assetTicket.updateMany({
        where: { assetId: id, type: 'Request', category: RETURN_REQUEST, status: { in: ['Open', 'InProgress'] } },
        data: { status: 'Resolved' },
      });
      return tx.asset.findUniqueOrThrow({ where: { id }, include: assetInclude });
    });
    await this.support.audit(tenantId, actorUserId, 'assets.return', id, { condition: dto.condition });
    await this.support.notifyUser(tenantId, open.employee.userId, {
      title: 'Asset return recorded',
      body: `${asset.assetTag} has been checked back in.`,
    });
    return assetView(updated);
  }

  /** The asset stays Allocated throughout, so it never becomes available mid-transfer. */
  async transfer(tenantId: string, actorUserId: string, id: string, dto: TransferAssetDto) {
    const asset = await this.support.requireAsset(tenantId, id);
    const open = asset.assignments[0];
    if (asset.status !== 'allocated' || !open) {
      throw new BadRequestException('Only an allocated asset can be transferred.');
    }
    if (open.employeeId === dto.toEmployeeId) {
      throw new BadRequestException('This employee already holds the asset.');
    }
    const from = await this.support.requireActiveEmployee(tenantId, open.employeeId);
    const to = await this.support.requireActiveEmployee(tenantId, dto.toEmployeeId);
    const transferredOn = toDay(dto.transferredOn) ?? today();
    this.assertNotFuture(transferredOn, 'Transfer date');
    if (transferredOn < toDay(day(open.assignedOn))!) {
      throw new BadRequestException('Transfer date cannot be before the issue date.');
    }
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Give a reason for the transfer.');
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const closed = await tx.assetAssignment.updateMany({
          where: { id: open.id, returnedOn: null },
          data: {
            returnedOn: transferredOn,
            returnedById: actorUserId,
            endReason: 'transferred',
            handoverAckStatus: 'pending',
          },
        });
        if (closed.count === 0) throw new ConflictException('This asset has already moved.');
        await tx.assetAssignment.create({
          data: {
            tenantId,
            assetId: id,
            employeeId: to.id,
            assignedOn: transferredOn,
            expectedReturnOn: open.expectedReturnOn,
            issueCondition: open.issueCondition,
            accessories: open.accessories,
            issuedById: actorUserId,
            transferredFromId: open.id,
            transferReason: reason,
          },
        });
        return tx.asset.update({
          where: { id },
          data: { updatedById: actorUserId },
          include: assetInclude,
        });
      });
      await this.support.audit(tenantId, actorUserId, 'assets.transfer', id, {
        fromEmployeeId: from.id,
        toEmployeeId: to.id,
      });
      await this.support.notifyUser(tenantId, from.userId, {
        title: 'Asset transferred: please confirm handover',
        body: `${asset.assetTag} has moved to ${fullName(to)}. Confirm you handed it over.`,
      });
      await this.support.notifyUser(tenantId, to.userId, {
        title: 'Asset transferred to you: please acknowledge',
        body: `${asset.assetTag} (${asset.name}) is now with you. Confirm you received it.`,
      });
      return assetView(updated);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) throw new ConflictException('This asset has already moved.');
      throw error;
    }
  }

  /**
   * Lifecycle moves that are not an allocation or a return. Ending an allocation back to stock
   * or maintenance must use Return, so the condition check is always recorded.
   */
  async changeStatus(tenantId: string, actorUserId: string, id: string, dto: ChangeAssetStatusDto) {
    const asset = await this.support.requireAsset(tenantId, id);
    const from = asset.status;
    const to = dto.status;
    if (to === 'allocated') throw new BadRequestException('Use Allocate to issue an asset.');
    if (from === 'allocated' && to !== 'lost') {
      assertMove(from, to);
      throw new BadRequestException('Use Return to bring an allocated asset back, so its condition is recorded.');
    }
    assertMove(from, to);
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Give a reason for the status change.');
    if (from === 'under_maintenance') {
      const repair = await this.prisma.assetMaintenance.findFirst({ where: { assetId: id, status: 'open' } });
      if (repair) throw new BadRequestException('Complete the repair record to take this asset out of maintenance.');
    }
    const open = asset.assignments[0];
    const updated = await this.prisma.$transaction(async (tx) => {
      if (open && to === 'lost') {
        await tx.assetAssignment.update({
          where: { id: open.id },
          data: { returnedOn: today(), endReason: 'lost', returnedById: actorUserId, damageNotes: reason },
        });
      }
      await this.moveStatus(tx, id, from, to, actorUserId);
      await this.support.recordStatus(tx, {
        tenantId,
        assetId: id,
        from,
        to,
        reason,
        source: 'status',
        changedById: actorUserId,
      });
      if (to === 'under_maintenance') {
        await this.maintenance.openFromLifecycle(tx, {
          tenantId,
          assetId: id,
          issue: reason,
          actorUserId,
          startedOn: today(),
        });
      }
      return tx.asset.findUniqueOrThrow({ where: { id }, include: assetInclude });
    });
    await this.support.audit(tenantId, actorUserId, 'assets.status', id, { from, to, reason });
    if (open && to === 'lost') {
      await this.support.notifyUser(tenantId, open.employee.userId, {
        title: 'Asset marked lost',
        body: `${asset.assetTag} was recorded as lost. ${reason}`,
      });
    }
    return assetView(updated);
  }

  async allocations(tenantId: string, assetId: string) {
    await this.support.requireAsset(tenantId, assetId);
    const rows = await this.prisma.assetAssignment.findMany({
      where: { tenantId, assetId },
      include: allocationInclude,
      orderBy: { createdAt: 'desc' },
    });
    const names = await this.namesFor(tenantId, rows);
    return rows.map((row) => this.allocationView(row, names));
  }

  /** Transfers still waiting for the previous holder to confirm they handed the asset over. */
  async pendingHandovers(tenantId: string) {
    const rows = await this.prisma.assetAssignment.findMany({
      where: { tenantId, endReason: 'transferred', handoverAckStatus: 'pending' },
      include: {
        asset: true,
        employee: { include: { department: true } },
        transferredTo: { include: { employee: true } },
      },
      orderBy: { returnedOn: 'asc' },
      take: 500,
    });
    return rows.map((row) => ({
      allocationId: row.id,
      asset: { id: row.asset.id, assetTag: row.asset.assetTag, name: row.asset.name },
      from: { ...person(row.employee), department: row.employee.department?.name ?? null },
      to: row.transferredTo ? person(row.transferredTo.employee) : null,
      transferredOn: dayOrNull(row.returnedOn),
      reason: row.transferredTo?.transferReason ?? '',
      cost: row.asset.cost?.toNumber() ?? null,
    }));
  }

  async employeeAllocations(tenantId: string, employeeId: string) {
    const employee = await this.support.requireEmployee(tenantId, employeeId);
    const rows = await this.prisma.assetAssignment.findMany({
      where: { tenantId, employeeId },
      include: { ...allocationInclude, asset: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const names = await this.namesFor(tenantId, rows);
    const view = (row: (typeof rows)[number]) => ({
      ...this.allocationView(row, names),
      asset: {
        id: row.asset.id,
        assetTag: row.asset.assetTag,
        name: row.asset.name,
        category: row.asset.category.name,
        serialNo: row.asset.serialNo,
        status: row.asset.status,
      },
    });
    return {
      employee: { ...person(employee), status: employee.user.status },
      current: rows.filter((row) => !row.returnedOn).map(view),
      past: rows.filter((row) => row.returnedOn).map(view),
    };
  }

  async statusHistory(tenantId: string, assetId: string) {
    await this.support.requireAsset(tenantId, assetId);
    const rows = await this.prisma.assetStatusHistory.findMany({
      where: { tenantId, assetId },
      orderBy: { changedAt: 'desc' },
    });
    const names = await this.support.userNames(
      tenantId,
      rows.map((row) => row.changedById),
    );
    return rows.map((row) => ({
      id: row.id,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      reason: row.reason,
      source: row.source,
      changedBy: row.changedById ? (names.get(row.changedById) ?? null) : null,
      changedAt: row.changedAt.toISOString(),
    }));
  }

  /** The asset's full story, assembled from its permanent records. */
  async history(tenantId: string, assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
      include: { createdBy: { include: { employee: true } } },
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    const [rows, statuses, repairs] = await Promise.all([
      this.prisma.assetAssignment.findMany({ where: { tenantId, assetId }, include: allocationInclude }),
      this.prisma.assetStatusHistory.findMany({ where: { tenantId, assetId, source: 'status' } }),
      this.prisma.assetMaintenance.findMany({ where: { tenantId, assetId } }),
    ]);
    const names = await this.support.userNames(tenantId, [
      asset.createdById,
      ...rows.flatMap((row) => [row.issuedById, row.ackById, row.returnedById, row.handoverAckById]),
      ...statuses.map((row) => row.changedById),
      ...repairs.flatMap((row) => [row.createdById, row.updatedById]),
    ]);
    const by = (id: string | null) => (id ? (names.get(id) ?? null) : null);
    const previous = new Map(rows.map((row) => [row.id, row]));

    const events: Array<{ at: string; kind: string; title: string; detail: string; by: string | null }> = [
      {
        at: asset.createdAt.toISOString(),
        kind: 'created',
        title: 'Asset created',
        detail: asset.assetTag,
        by: by(asset.createdById),
      },
    ];
    for (const row of rows) {
      const name = fullName(row.employee);
      const origin = row.transferredFromId ? previous.get(row.transferredFromId) : null;
      events.push(
        origin
          ? {
              at: row.assignedOn.toISOString(),
              kind: 'transferred',
              title: 'Transferred',
              detail: `From ${fullName(origin.employee)} to ${name}. ${row.transferReason}`,
              by: by(row.issuedById),
            }
          : {
              at: row.assignedOn.toISOString(),
              kind: 'allocated',
              title: `Allocated to ${name}`,
              detail: [
                row.issueCondition && `Condition: ${row.issueCondition.replace(/_/g, ' ')}`,
                row.accessories && `Accessories: ${row.accessories}`,
                row.conditionNotes,
              ]
                .filter(Boolean)
                .join(' · '),
              by: by(row.issuedById),
            },
      );
      if (row.ackAt) {
        events.push({
          at: row.ackAt.toISOString(),
          kind: 'acknowledged',
          title: `Receipt acknowledged by ${name}`,
          detail: row.ackMethod === 'signed_form' ? 'Signed form on file' : 'Confirmed in the portal',
          by: by(row.ackById),
        });
      }
      if (row.handoverAckAt) {
        events.push({
          at: row.handoverAckAt.toISOString(),
          kind: 'handover',
          title: `Handover confirmed by ${name}`,
          detail: row.handoverAckMethod === 'signed_form' ? 'Signed form on file' : 'Confirmed in the portal',
          by: by(row.handoverAckById),
        });
      }
      if (row.returnedOn && row.endReason === 'returned') {
        events.push({
          at: row.returnedOn.toISOString(),
          kind: 'returned',
          title: `Returned by ${name}`,
          detail: [
            row.returnCondition && `Condition: ${row.returnCondition.replace(/_/g, ' ')}`,
            row.damageNotes,
            row.inspectionNotes,
          ]
            .filter(Boolean)
            .join(' · '),
          by: by(row.returnedById),
        });
      }
    }
    for (const row of statuses) {
      events.push({
        at: row.changedAt.toISOString(),
        kind: 'status',
        title: `${STATUS_LABELS[row.fromStatus]} → ${STATUS_LABELS[row.toStatus]}`,
        detail: row.reason,
        by: by(row.changedById),
      });
    }
    for (const row of repairs) {
      events.push({
        at: row.startedOn.toISOString(),
        kind: 'maintenance',
        title: 'Sent for repair',
        detail: [row.issue, row.vendor].filter(Boolean).join(' · '),
        by: by(row.createdById),
      });
      if (row.completedOn) {
        events.push({
          at: row.completedOn.toISOString(),
          kind: 'maintenance',
          title: row.outcome === 'repaired' ? 'Repair completed' : 'Beyond repair',
          detail: [row.outcomeNotes, row.cost ? `Cost: ${row.cost.toString()}` : ''].filter(Boolean).join(' · '),
          by: by(row.updatedById),
        });
      }
    }
    return events.sort((a, b) => b.at.localeCompare(a.at));
  }

  /** Paper acknowledgement. Never replaces one already recorded. */
  async recordSignedForm(
    tenantId: string,
    actorUserId: string,
    assignmentId: string,
    dto: SignedFormDto,
    file: AssetUpload | undefined,
  ) {
    const assignment = await this.prisma.assetAssignment.findFirst({ where: { id: assignmentId, tenantId } });
    if (!assignment) throw new NotFoundException('Allocation not found.');
    const receipt = dto.kind === 'signed_ack';
    if (receipt && (assignment.returnedOn || assignment.ackStatus !== 'pending')) {
      throw new ConflictException('This allocation is not waiting for an acknowledgement.');
    }
    if (!receipt && assignment.handoverAckStatus !== 'pending') {
      throw new ConflictException('This allocation is not waiting for a handover confirmation.');
    }
    const saved = await this.support.saveFile(tenantId, `forms/${assignmentId}`, file, DOCUMENT_EXT);
    await this.prisma.$transaction(async (tx) => {
      const marked = await tx.assetAssignment.updateMany({
        where: { id: assignmentId, ...(receipt ? { ackStatus: 'pending' } : { handoverAckStatus: 'pending' }) },
        data: receipt
          ? { ackStatus: 'acknowledged', ackAt: new Date(), ackById: actorUserId, ackMethod: 'signed_form' }
          : {
              handoverAckStatus: 'acknowledged',
              handoverAckAt: new Date(),
              handoverAckById: actorUserId,
              handoverAckMethod: 'signed_form',
            },
      });
      if (marked.count === 0) throw new ConflictException('This has already been acknowledged.');
      await tx.assetAssignmentFile.create({
        data: {
          assignmentId,
          kind: dto.kind,
          fileName: saved.fileName,
          storagePath: saved.storagePath,
          uploadedById: actorUserId,
        },
      });
    });
    await this.support.audit(tenantId, actorUserId, `assets.${dto.kind}`, assignment.assetId, { assignmentId });
    return { ok: true };
  }

  async openFile(tenantId: string, assignmentId: string, fileId: string) {
    const file = await this.prisma.assetAssignmentFile.findFirst({
      where: { id: fileId, assignmentId, assignment: { tenantId } },
    });
    if (!file) throw new NotFoundException('File not found.');
    return this.support.openFile(file.storagePath, file.fileName);
  }

  /** Conditional update so two admins cannot move the same asset at once. */
  private async moveStatus(tx: Tx, id: string, from: AssetStatus, to: AssetStatus, actorUserId: string) {
    const moved = await tx.asset.updateMany({
      where: { id, status: from },
      data: { status: to, updatedById: actorUserId },
    });
    if (moved.count === 0) {
      throw new ConflictException('This asset has just changed. Reload and try again.');
    }
  }

  private assertNotFuture(value: Date, label: string) {
    if (value > today()) throw new BadRequestException(`${label} cannot be in the future.`);
  }

  private namesFor(tenantId: string, rows: AllocationRow[]) {
    return this.support.userNames(
      tenantId,
      rows.flatMap((row) => [row.issuedById, row.ackById, row.returnedById, row.handoverAckById]),
    );
  }

  private allocationView(row: AllocationRow, names: Map<string, string>) {
    const name = (id: string | null) => (id ? (names.get(id) ?? null) : null);
    return {
      id: row.id,
      assetId: row.assetId,
      employee: person(row.employee),
      assignedOn: day(row.assignedOn),
      expectedReturnOn: dayOrNull(row.expectedReturnOn),
      returnedOn: dayOrNull(row.returnedOn),
      issueCondition: row.issueCondition,
      accessories: row.accessories,
      notes: row.conditionNotes,
      issuedBy: name(row.issuedById),
      ackStatus: row.ackStatus,
      ackAt: row.ackAt?.toISOString() ?? null,
      ackBy: name(row.ackById),
      ackMethod: row.ackMethod,
      returnCondition: row.returnCondition,
      damageNotes: row.damageNotes,
      inspectionNotes: row.inspectionNotes,
      returnedBy: name(row.returnedById),
      endReason: row.endReason,
      transferredFromId: row.transferredFromId,
      transferReason: row.transferReason,
      handoverAckStatus: row.handoverAckStatus,
      handoverAckAt: row.handoverAckAt?.toISOString() ?? null,
      handoverAckBy: name(row.handoverAckById),
      files: row.files.map((file) => ({
        id: file.id,
        kind: file.kind,
        fileName: file.fileName,
        uploadedAt: file.uploadedAt.toISOString(),
      })),
    };
  }
}
