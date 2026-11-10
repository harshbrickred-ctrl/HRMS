import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { FAULT_CATEGORIES, RETURN_REQUEST, ticketReference } from './asset-rules';
import {
  AssetSupport,
  DOCUMENT_EXT,
  day,
  dayOrNull,
  fullName,
  toDay,
  today,
  type AssetUpload,
} from './asset-support.service';
import { ticketInclude, ticketView } from './assets.service';
import type {
  CreateAssetTicketDto,
  FaultReportDto,
  LossReportDto,
  ReturnRequestDto,
  SignedFormDto,
} from './dto/assets.dto';

const allocationInclude = {
  asset: { include: { category: true } },
  files: { where: { kind: { in: ['signed_ack', 'handover_ack'] } } },
  employee: true,
  transferredFrom: { include: { employee: true } },
  transferredTo: { include: { employee: true } },
} satisfies Prisma.AssetAssignmentInclude;

type AllocationRow = Prisma.AssetAssignmentGetPayload<{ include: typeof allocationInclude }>;

/**
 * Everything an employee sees or does in the portal. The employee always comes from the login,
 * and responses list permitted fields one by one so sensitive data (licence keys in custom
 * fields, vendor, cost, internal notes) can never leak in by being added to the asset later.
 */
@Injectable()
export class AssetSelfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AssetSupport,
  ) {}

  async myAssets(userId: string) {
    const employee = await this.support.employeeByUser(userId);
    const rows = await this.prisma.assetAssignment.findMany({
      where: { employeeId: employee.id, returnedOn: null },
      include: allocationInclude,
      orderBy: { assignedOn: 'desc' },
    });
    const [handovers, returns] = await Promise.all([
      this.prisma.assetAssignment.findMany({
        where: { employeeId: employee.id, handoverAckStatus: 'pending' },
        include: allocationInclude,
        orderBy: { assignedOn: 'desc' },
      }),
      this.prisma.assetTicket.findMany({
        where: { ...this.openReturn(employee.id), assetId: { in: rows.map((row) => row.assetId) } },
        select: { assetId: true },
      }),
    ]);
    const returning = new Set(returns.map((row) => row.assetId));
    return {
      assets: rows.map((row) => ({ ...this.summary(row), returnRequested: returning.has(row.assetId) })),
      handovers: handovers.map((row) => this.summary(row)),
    };
  }

  /** Asks IT to take an asset back. IT books the actual return, which records its condition. */
  async requestReturn(userId: string, allocationId: string, dto: ReturnRequestDto) {
    const { employee, allocation } = await this.heldAsset(userId, allocationId);
    const body = dto.reason.trim();
    if (!body) throw new BadRequestException('Say why you are returning it.');
    const existing = await this.prisma.assetTicket.findFirst({
      where: { ...this.openReturn(employee.id), assetId: allocation.assetId },
    });
    if (existing) throw new ConflictException('You have already asked to return this asset.');
    const ticket = await this.prisma.assetTicket.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        assetId: allocation.assetId,
        type: 'Request',
        category: RETURN_REQUEST,
        subject: `Return ${allocation.asset.assetTag}`,
        body,
      },
      include: ticketInclude,
    });
    await this.announce(employee, userId, ticket.id, ticket.number, `Return requested: ${allocation.asset.assetTag}`, body);
    return ticketView(ticket);
  }

  private openReturn(employeeId: string): Prisma.AssetTicketWhereInput {
    return { employeeId, type: 'Request', category: RETURN_REQUEST, status: { in: ['Open', 'InProgress'] } };
  }

  async myAsset(userId: string, allocationId: string) {
    const row = await this.ownAllocation(userId, allocationId);
    return {
      ...this.summary(row),
      purchasedOn: dayOrNull(row.asset.purchasedOn),
      accessories: row.accessories,
      ackAt: row.ackAt?.toISOString() ?? null,
      ackMethod: row.ackMethod,
      hasPhoto: Boolean(row.asset.photoPath),
    };
  }

  async myAssetPhoto(userId: string, allocationId: string) {
    const row = await this.ownAllocation(userId, allocationId);
    if (!row.asset.photoPath) throw new NotFoundException('This asset has no photo.');
    return this.support.openFile(row.asset.photoPath, path.basename(row.asset.photoPath));
  }

  /** One write only: the update matches pending rows, so a recorded acknowledgement never changes. */
  async acknowledge(userId: string, allocationId: string) {
    const row = await this.ownAllocation(userId, allocationId);
    if (row.returnedOn) throw new ConflictException('This asset is no longer allocated to you.');
    const marked = await this.prisma.assetAssignment.updateMany({
      where: { id: row.id, returnedOn: null, ackStatus: 'pending' },
      data: { ackStatus: 'acknowledged', ackAt: new Date(), ackById: userId, ackMethod: 'digital' },
    });
    if (marked.count === 0) throw new ConflictException('This asset has already been acknowledged.');
    await this.support.audit(row.tenantId, userId, 'assets.acknowledge', row.assetId, { allocationId });
    return this.myAsset(userId, allocationId);
  }

  async acknowledgeHandover(userId: string, allocationId: string) {
    const row = await this.ownAllocation(userId, allocationId);
    const marked = await this.prisma.assetAssignment.updateMany({
      where: { id: row.id, handoverAckStatus: 'pending' },
      data: {
        handoverAckStatus: 'acknowledged',
        handoverAckAt: new Date(),
        handoverAckById: userId,
        handoverAckMethod: 'digital',
      },
    });
    if (marked.count === 0) throw new ConflictException('No handover is waiting for you on this asset.');
    await this.support.audit(row.tenantId, userId, 'assets.handover.acknowledge', row.assetId, { allocationId });
    return { ok: true };
  }

  async uploadSignedForm(userId: string, allocationId: string, dto: SignedFormDto, file: AssetUpload | undefined) {
    const row = await this.ownAllocation(userId, allocationId);
    const receipt = dto.kind === 'signed_ack';
    if (receipt ? row.returnedOn || row.ackStatus !== 'pending' : row.handoverAckStatus !== 'pending') {
      throw new ConflictException('This is not waiting for an acknowledgement.');
    }
    const saved = await this.support.saveFile(row.tenantId, `forms/${row.id}`, file, DOCUMENT_EXT);
    await this.prisma.$transaction(async (tx) => {
      const marked = await tx.assetAssignment.updateMany({
        where: { id: row.id, ...(receipt ? { ackStatus: 'pending' } : { handoverAckStatus: 'pending' }) },
        data: receipt
          ? { ackStatus: 'acknowledged', ackAt: new Date(), ackById: userId, ackMethod: 'signed_form' }
          : {
              handoverAckStatus: 'acknowledged',
              handoverAckAt: new Date(),
              handoverAckById: userId,
              handoverAckMethod: 'signed_form',
            },
      });
      if (marked.count === 0) throw new ConflictException('This has already been acknowledged.');
      await tx.assetAssignmentFile.create({
        data: { assignmentId: row.id, kind: dto.kind, ...saved, uploadedById: userId },
      });
    });
    await this.support.audit(row.tenantId, userId, `assets.${dto.kind}`, row.assetId, { allocationId });
    return { ok: true };
  }

  async history(userId: string) {
    const employee = await this.support.employeeByUser(userId);
    const rows = await this.prisma.assetAssignment.findMany({
      where: { employeeId: employee.id },
      include: allocationInclude,
      orderBy: { createdAt: 'desc' },
    });
    const view = (row: AllocationRow) => ({
      ...this.summary(row),
      returnedOn: dayOrNull(row.returnedOn),
      returnCondition: row.returnCondition,
      endReason: row.endReason,
      transferredFrom: row.transferredFrom ? fullName(row.transferredFrom.employee) : null,
      transferredTo: row.transferredTo ? fullName(row.transferredTo.employee) : null,
      handoverAckStatus: row.handoverAckStatus,
    });
    return {
      current: rows.filter((row) => !row.returnedOn).map(view),
      past: rows.filter((row) => row.returnedOn).map(view),
    };
  }

  async myTickets(userId: string) {
    const employee = await this.support.employeeByUser(userId);
    const rows = await this.prisma.assetTicket.findMany({
      where: { employeeId: employee.id },
      include: ticketInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ticketView(row));
  }

  async myTicket(userId: string, id: string) {
    const employee = await this.support.employeeByUser(userId);
    const row = await this.prisma.assetTicket.findFirst({
      where: { id, employeeId: employee.id },
      include: ticketInclude,
    });
    if (!row) throw new NotFoundException('Report not found.');
    return ticketView(row);
  }

  async openMyTicketFile(userId: string, ticketId: string, fileId: string) {
    const employee = await this.support.employeeByUser(userId);
    const file = await this.prisma.assetTicketFile.findFirst({
      where: { id: fileId, ticketId, ticket: { employeeId: employee.id } },
    });
    if (!file) throw new NotFoundException('File not found.');
    return this.support.openFile(file.storagePath, file.fileName);
  }

  /** A general question about an asset the employee holds. */
  async createTicket(userId: string, dto: CreateAssetTicketDto) {
    const employee = await this.support.employeeByUser(userId);
    const subject = dto.subject.trim();
    const body = dto.body.trim();
    if (!subject || !body) throw new BadRequestException('Subject and details are required.');
    const open = await this.prisma.assetAssignment.findFirst({
      where: { employeeId: employee.id, assetId: dto.assetId, returnedOn: null },
    });
    if (!open) throw new BadRequestException('That asset is not currently allocated to you.');
    const ticket = await this.prisma.assetTicket.create({
      data: { tenantId: employee.tenantId, employeeId: employee.id, assetId: dto.assetId, type: 'Query', subject, body },
      include: ticketInclude,
    });
    await this.announce(employee, userId, ticket.id, ticket.number, 'Asset query', subject);
    return ticketView(ticket);
  }

  async reportFault(userId: string, dto: FaultReportDto, files: AssetUpload[] = []) {
    const { employee, allocation } = await this.heldAsset(userId, dto.allocationId);
    const body = dto.description.trim();
    if (!body) throw new BadRequestException('Describe the problem.');
    const saved = await this.saveAttachments(employee.tenantId, allocation.id, files);
    const ticket = await this.prisma.assetTicket.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        assetId: allocation.assetId,
        type: 'Issue',
        category: dto.category,
        priority: dto.priority,
        subject: FAULT_CATEGORIES[dto.category],
        body,
        files: { create: saved.map((file) => ({ ...file, uploadedById: userId })) },
      },
      include: ticketInclude,
    });
    await this.announce(
      employee,
      userId,
      ticket.id,
      ticket.number,
      `Asset fault: ${allocation.asset.assetTag}`,
      `${FAULT_CATEGORIES[dto.category]} (${dto.priority} priority)`,
    );
    return ticketView(ticket);
  }

  /** Only records the report. An asset admin reviews it and makes any status change. */
  async reportLoss(userId: string, dto: LossReportDto, files: AssetUpload[] = []) {
    const { employee, allocation } = await this.heldAsset(userId, dto.allocationId);
    const body = dto.description.trim();
    const location = dto.location.trim();
    if (!body || !location) throw new BadRequestException('Location and description are required.');
    const lostOn = toDay(dto.lostOn)!;
    if (lostOn > today()) throw new BadRequestException('Date lost cannot be in the future.');
    if (lostOn < toDay(day(allocation.assignedOn))!) {
      throw new BadRequestException('Date lost cannot be before the asset was issued to you.');
    }
    const existing = await this.prisma.assetTicket.findFirst({
      where: { assetId: allocation.assetId, type: 'Loss', status: { in: ['Open', 'InProgress'] } },
    });
    if (existing) throw new ConflictException('A report for this asset is already being reviewed.');
    const saved = await this.saveAttachments(employee.tenantId, allocation.id, files);
    const ticket = await this.prisma.assetTicket.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        assetId: allocation.assetId,
        type: 'Loss',
        category: dto.reportType,
        priority: 'high',
        subject: `Reported ${dto.reportType}`,
        body,
        lostOn,
        lostLocation: location,
        files: { create: saved.map((file) => ({ ...file, uploadedById: userId })) },
      },
      include: ticketInclude,
    });
    await this.announce(
      employee,
      userId,
      ticket.id,
      ticket.number,
      `Asset reported ${dto.reportType}: ${allocation.asset.assetTag}`,
      `${location}, ${dto.lostOn.slice(0, 10)}`,
    );
    return ticketView(ticket);
  }

  private saveAttachments(tenantId: string, allocationId: string, files: AssetUpload[]) {
    return Promise.all(
      files.map((file) => this.support.saveFile(tenantId, `reports/${allocationId}`, file, DOCUMENT_EXT)),
    );
  }

  private async announce(
    employee: { tenantId: string; firstName: string; lastName: string },
    userId: string,
    ticketId: string,
    number: number,
    title: string,
    detail: string,
  ) {
    await this.support.audit(employee.tenantId, userId, 'assets.ticket.create', ticketId);
    await this.support.notifyAssetAdmins(employee.tenantId, {
      title,
      body: `${ticketReference(number)} · ${fullName(employee)} · ${detail}`,
      href: '/it/tickets',
    });
  }

  /** The allocation must be this employee's own and still active. */
  private async heldAsset(userId: string, allocationId: string) {
    const employee = await this.support.employeeByUser(userId);
    const allocation = await this.prisma.assetAssignment.findFirst({
      where: { id: allocationId, employeeId: employee.id, returnedOn: null },
      include: { asset: true },
    });
    if (!allocation) throw new NotFoundException('That asset is not currently allocated to you.');
    return { employee, allocation };
  }

  /** Someone else's allocation looks exactly like one that does not exist. */
  private async ownAllocation(userId: string, allocationId: string) {
    const employee = await this.support.employeeByUser(userId);
    const row = await this.prisma.assetAssignment.findFirst({
      where: { id: allocationId, employeeId: employee.id },
      include: allocationInclude,
    });
    if (!row) throw new NotFoundException('Asset not found.');
    return row;
  }

  private summary(row: AllocationRow) {
    return {
      allocationId: row.id,
      assetTag: row.asset.assetTag,
      category: row.asset.category.name,
      name: row.asset.name,
      make: row.asset.make,
      model: row.asset.model,
      serialNo: row.asset.serialNo,
      status: row.asset.status,
      assignedOn: day(row.assignedOn),
      issueCondition: row.issueCondition,
      accessories: row.accessories,
      warrantyExpiry: dayOrNull(row.asset.warrantyExpiry),
      ackStatus: row.ackStatus,
      ackDueOn: dayOrNull(row.ackDueOn),
      ackAt: row.ackAt?.toISOString() ?? null,
    };
  }
}
