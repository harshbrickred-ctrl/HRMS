import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssetRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssetAllocationsService } from './asset-allocations.service';
import { requestReference } from './asset-rules';
import { AssetSupport, fullName, person } from './asset-support.service';
import type {
  CreateAssetRequestDto,
  DepartmentHeadDto,
  FulfilAssetRequestDto,
  RequestDecisionDto,
} from './dto/assets.dto';

const requestInclude = {
  employee: { include: { department: true } },
  category: true,
  managerApprover: { include: { user: { select: { status: true } } } },
  headApprover: { include: { user: { select: { status: true } } } },
  decisions: { orderBy: { decidedAt: 'asc' as const } },
} satisfies Prisma.AssetRequestInclude;

type RequestRow = Prisma.AssetRequestGetPayload<{ include: typeof requestInclude }>;

@Injectable()
export class AssetRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AssetSupport,
    private readonly allocations: AssetAllocationsService,
  ) {}

  /** The reporting manager approves first, then the department head. A step with nobody to do it is skipped. */
  async create(userId: string, dto: CreateAssetRequestDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { department: true },
    });
    if (!employee) throw new NotFoundException('No employee profile for this login.');
    const category = await this.prisma.assetCategory.findFirst({
      where: { id: dto.categoryId, tenantId: employee.tenantId, active: true },
    });
    if (!category) throw new NotFoundException('Category not found.');
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Say why you need this asset.');
    const open = await this.prisma.assetRequest.findFirst({
      where: {
        employeeId: employee.id,
        categoryId: category.id,
        status: { in: ['pending_manager', 'pending_head', 'approved'] },
      },
    });
    if (open) throw new ConflictException(`You already have an open request for ${category.name}.`);

    const managerApproverId = employee.managerId;
    const head = employee.department?.headId ?? null;
    const headApproverId = head && head !== employee.id && head !== managerApproverId ? head : null;
    const row = await this.prisma.assetRequest.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        categoryId: category.id,
        reason,
        status: managerApproverId ? 'pending_manager' : 'pending_head',
        managerApproverId,
        headApproverId,
        createdById: userId,
      },
      include: requestInclude,
    });
    await this.support.audit(employee.tenantId, userId, 'assets.request.create', row.id);
    await this.notifyNextApprover(row);
    return this.view(row);
  }

  async mine(userId: string) {
    const employee = await this.support.employeeByUser(userId);
    const rows = await this.prisma.assetRequest.findMany({
      where: { employeeId: employee.id },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.view(row));
  }

  async toApprove(userId: string) {
    const employee = await this.support.employeeByUser(userId);
    const rows = await this.prisma.assetRequest.findMany({
      where: {
        OR: [
          { managerApproverId: employee.id, status: 'pending_manager' },
          { headApproverId: employee.id, status: 'pending_head' },
        ],
      },
      include: requestInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.view(row));
  }

  async decideAsApprover(userId: string, id: string, dto: RequestDecisionDto) {
    const employee = await this.support.employeeByUser(userId);
    const row = await this.prisma.assetRequest.findFirst({
      where: { id, tenantId: employee.tenantId },
      include: requestInclude,
    });
    if (!row) throw new NotFoundException('Request not found.');
    const step =
      row.status === 'pending_manager' && row.managerApproverId === employee.id
        ? 'manager'
        : row.status === 'pending_head' && row.headApproverId === employee.id
          ? 'head'
          : null;
    if (!step) throw new ForbiddenException('This request is not waiting for your approval.');
    return this.decide(row, step, userId, dto);
  }

  /** Asset admins only step in when the approver is missing or no longer active. */
  async decideAsAdmin(tenantId: string, userId: string, id: string, dto: RequestDecisionDto) {
    const row = await this.prisma.assetRequest.findFirst({
      where: { id, tenantId },
      include: requestInclude,
    });
    if (!row) throw new NotFoundException('Request not found.');
    if (row.createdById === userId) throw new ForbiddenException('You cannot decide your own request.');
    if (!this.needsAdmin(row)) {
      throw new ForbiddenException('This request is waiting for its approver.');
    }
    return this.decide(row, 'admin', userId, dto);
  }

  async cancel(userId: string, id: string) {
    const employee = await this.support.employeeByUser(userId);
    const moved = await this.prisma.assetRequest.updateMany({
      where: { id, employeeId: employee.id, status: { in: ['pending_manager', 'pending_head', 'approved'] } },
      data: { status: 'cancelled' },
    });
    if (moved.count === 0) throw new NotFoundException('No open request found.');
    await this.support.audit(employee.tenantId, userId, 'assets.request.cancel', id);
    return { ok: true };
  }

  async list(tenantId: string, status?: string) {
    if (status && !(status in AssetRequestStatus)) {
      throw new BadRequestException('Unknown request status.');
    }
    const rows = await this.prisma.assetRequest.findMany({
      where: { tenantId, ...(status ? { status: status as AssetRequestStatus } : {}) },
      include: { ...requestInclude, employee: { include: { department: true, location: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const categoryIds = [...new Set(rows.map((row) => row.categoryId))];
    const [prices, stock, held] = await Promise.all([
      this.prisma.asset.groupBy({
        by: ['categoryId'],
        where: { tenantId, categoryId: { in: categoryIds }, cost: { not: null } },
        _avg: { cost: true },
      }),
      this.prisma.asset.groupBy({
        by: ['categoryId', 'locationId'],
        where: { tenantId, categoryId: { in: categoryIds }, status: 'in_stock' },
        _count: { _all: true },
      }),
      this.prisma.assetAssignment.findMany({
        where: { tenantId, returnedOn: null, employeeId: { in: rows.map((row) => row.employeeId) } },
        select: { employeeId: true, asset: { select: { categoryId: true } } },
      }),
    ]);
    // What the approver needs to decide: typical price, what is on the shelf, and what they already hold.
    return rows.map((row) => {
      const shelf = stock.filter((item) => item.categoryId === row.categoryId);
      const lastStep = row.decisions[row.decisions.length - 1]?.decidedAt ?? row.createdAt;
      return {
        ...this.view(row),
        location: row.employee.location?.name ?? null,
        estimatedValue: prices.find((item) => item.categoryId === row.categoryId)?._avg.cost?.toNumber() ?? null,
        stock: {
          total: shelf.reduce((sum, item) => sum + item._count._all, 0),
          atLocation: shelf
            .filter((item) => item.locationId && item.locationId === row.employee.locationId)
            .reduce((sum, item) => sum + item._count._all, 0),
        },
        alreadyHolds: held.filter(
          (item) => item.employeeId === row.employeeId && item.asset.categoryId === row.categoryId,
        ).length,
        waitingSince: lastStep.toISOString(),
      };
    });
  }

  /** Sends the requester a question from the asset desk without deciding the request. */
  async ask(tenantId: string, actorUserId: string, id: string, question: string) {
    const row = await this.prisma.assetRequest.findFirst({ where: { id, tenantId }, include: requestInclude });
    if (!row) throw new NotFoundException('Request not found.');
    const text = question.trim();
    if (!text) throw new BadRequestException('Write your question.');
    await this.support.notifyUser(tenantId, row.employee.userId, {
      title: `Question about asset request ${requestReference(row.number)}`,
      body: text,
    });
    await this.support.audit(tenantId, actorUserId, 'assets.request.question', row.id, { question: text });
    return { ok: true };
  }

  async fulfil(tenantId: string, actorUserId: string, id: string, dto: FulfilAssetRequestDto) {
    const row = await this.prisma.assetRequest.findFirst({
      where: { id, tenantId },
      include: requestInclude,
    });
    if (!row) throw new NotFoundException('Request not found.');
    if (row.status !== 'approved') throw new BadRequestException('Only an approved request can be issued.');
    const asset = await this.support.requireAsset(tenantId, dto.assetId);
    if (asset.categoryId !== row.categoryId) {
      throw new BadRequestException(`This request is for ${row.category.name}. Choose one of those.`);
    }
    const { assetId, ...allocation } = dto;
    const result = await this.allocations.allocate(
      tenantId,
      actorUserId,
      assetId,
      { ...allocation, employeeId: row.employeeId },
      async (tx, assignmentId) => {
        const done = await tx.assetRequest.updateMany({
          where: { id, status: 'approved' },
          data: { status: 'fulfilled', fulfilledById: actorUserId, fulfilledAt: new Date(), assignmentId },
        });
        if (done.count === 0) throw new ConflictException('This request has already been issued.');
      },
    );
    await this.support.audit(tenantId, actorUserId, 'assets.request.fulfil', id, { assetId });
    return result;
  }

  async departments(tenantId: string) {
    const rows = await this.prisma.department.findMany({
      where: { tenantId },
      include: { head: true, _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      employees: row._count.employees,
      head: row.head ? person(row.head) : null,
    }));
  }

  async setDepartmentHead(tenantId: string, actorUserId: string, id: string, dto: DepartmentHeadDto) {
    const department = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!department) throw new NotFoundException('Department not found.');
    if (dto.headId) await this.support.requireActiveEmployee(tenantId, dto.headId);
    await this.prisma.department.update({ where: { id }, data: { headId: dto.headId || null } });
    await this.support.audit(tenantId, actorUserId, 'assets.department.head', id, { headId: dto.headId ?? null });
    return this.departments(tenantId);
  }

  private async decide(
    row: RequestRow,
    step: 'manager' | 'head' | 'admin',
    userId: string,
    dto: RequestDecisionDto,
  ) {
    const note = dto.note?.trim() ?? '';
    if (!dto.approve && !note) throw new BadRequestException('Give a reason for declining.');
    const toHead = row.status === 'pending_manager' && row.headApproverId;
    const next: AssetRequestStatus = !dto.approve ? 'rejected' : toHead ? 'pending_head' : 'approved';
    const updated = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.assetRequest.updateMany({
        where: { id: row.id, status: row.status },
        data: { status: next },
      });
      if (moved.count === 0) throw new ConflictException('This request has already been decided.');
      await tx.assetRequestDecision.create({
        data: { requestId: row.id, step, approved: dto.approve, note, decidedById: userId },
      });
      return tx.assetRequest.findUniqueOrThrow({ where: { id: row.id }, include: requestInclude });
    });
    await this.support.audit(row.tenantId, userId, `assets.request.${dto.approve ? 'approve' : 'reject'}`, row.id, { step });
    if (next === 'pending_head') {
      await this.notifyNextApprover(updated);
    } else {
      const reference = requestReference(row.number);
      await this.support.notifyUser(row.tenantId, row.employee.userId, {
        title: dto.approve ? `Asset request ${reference} approved` : `Asset request ${reference} declined`,
        body: note ? `${row.category.name}: ${note}` : row.category.name,
      });
      if (dto.approve) {
        await this.support.notifyAssetAdmins(row.tenantId, {
          title: `Asset request ${reference} ready to issue`,
          body: `${fullName(row.employee)}: ${row.category.name}`,
          href: '/it/requests',
        });
      }
    }
    return this.view(updated);
  }

  private needsAdmin(row: RequestRow) {
    if (row.status === 'pending_manager') return row.managerApprover?.user.status !== 'ACTIVE';
    if (row.status === 'pending_head') return row.headApprover?.user.status !== 'ACTIVE';
    return false;
  }

  private async notifyNextApprover(row: RequestRow) {
    const approver = row.status === 'pending_manager' ? row.managerApprover : row.headApprover;
    const reference = requestReference(row.number);
    if (approver) {
      await this.support.notifyUser(row.tenantId, approver.userId, {
        title: `Asset request ${reference} to approve`,
        body: `${fullName(row.employee)} needs: ${row.category.name}`,
      });
    } else {
      await this.support.notifyAssetAdmins(row.tenantId, {
        title: `Asset request ${reference} has no approver`,
        body: `${fullName(row.employee)} needs: ${row.category.name}`,
        href: '/it/requests',
      });
    }
  }

  private view(row: RequestRow) {
    return {
      id: row.id,
      reference: requestReference(row.number),
      employee: { ...person(row.employee), department: row.employee.department?.name ?? null },
      category: { id: row.category.id, name: row.category.name },
      reason: row.reason,
      status: row.status,
      manager: row.managerApprover ? person(row.managerApprover) : null,
      head: row.headApprover ? person(row.headApprover) : null,
      needsAdmin: this.needsAdmin(row),
      decisions: row.decisions.map((decision) => ({
        step: decision.step,
        approved: decision.approved,
        note: decision.note,
        decidedAt: decision.decidedAt.toISOString(),
      })),
      fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
