import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  AssignAssetDto,
  CreateAssetDto,
  CreateAssetTicketDto,
  ReturnAssetDto,
  UpdateAssetDto,
  UpdateAssetTicketDto,
} from './dto/assets.dto';

const ticketInclude = {
  comments: { orderBy: { createdAt: 'asc' as const } },
  asset: true,
} satisfies Prisma.AssetTicketInclude;

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async myAssets(userId: string) {
    const employee = await this.employeeByUser(userId);
    const rows = await this.prisma.assetAssignment.findMany({
      where: { employeeId: employee.id, returnedOn: null },
      include: { asset: true },
      orderBy: { assignedOn: 'desc' },
    });
    return rows.map((row) => ({
      assetId: row.asset.id,
      assetTag: row.asset.assetTag,
      category: row.asset.category,
      makeModel: row.asset.makeModel,
      serialNo: row.asset.serialNo,
      status: row.asset.status,
      assignedOn: this.day(row.assignedOn),
      conditionNotes: row.conditionNotes,
    }));
  }

  async myTickets(userId: string) {
    const employee = await this.employeeByUser(userId);
    const rows = await this.prisma.assetTicket.findMany({
      where: { employeeId: employee.id },
      include: ticketInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.ticketView(row));
  }

  async createTicket(userId: string, dto: CreateAssetTicketDto) {
    const employee = await this.employeeByUser(userId);
    const subject = dto.subject.trim();
    const body = dto.body.trim();
    if (!subject || !body) throw new BadRequestException('Subject and details are required.');

    let assetId: string | null = null;
    let category = '';
    if (dto.type === 'Request') {
      if (!dto.category) throw new BadRequestException('Choose the kind of asset you need.');
      category = dto.category;
    } else {
      if (!dto.assetId) throw new BadRequestException('Choose one of your current assets.');
      const open = await this.prisma.assetAssignment.findFirst({
        where: { employeeId: employee.id, assetId: dto.assetId, returnedOn: null },
      });
      if (!open) throw new BadRequestException('That asset is not currently assigned to you.');
      assetId = dto.assetId;
    }

    const ticket = await this.prisma.assetTicket.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        assetId,
        type: dto.type,
        category,
        subject,
        body,
      },
      include: ticketInclude,
    });
    await this.audit(employee.tenantId, userId, 'assets.ticket.create', ticket.id);
    await this.notifyItAdmins(employee.tenantId, {
      title: `Asset ${dto.type.toLowerCase()}`,
      body: `${employee.firstName} ${employee.lastName}: ${subject}`,
      href: '/it/tickets',
    });
    return this.ticketView(ticket);
  }

  async people(tenantId: string) {
    const rows = await this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
    });
    return rows.map((row) => ({
      id: row.id,
      name: `${row.firstName} ${row.lastName}`.trim(),
      employeeCode: row.employeeCode,
    }));
  }

  async list(tenantId: string, status?: string) {
    const rows = await this.prisma.asset.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        assignments: {
          where: { returnedOn: null },
          include: { employee: true },
          take: 1,
        },
      },
      orderBy: { assetTag: 'asc' },
    });
    return rows.map((row) => this.assetView(row));
  }

  async create(tenantId: string, actorUserId: string, dto: CreateAssetDto) {
    const tag = dto.assetTag.trim();
    if (!tag) throw new BadRequestException('Asset tag is required.');
    try {
      const asset = await this.prisma.asset.create({
        data: {
          tenantId,
          assetTag: tag,
          category: dto.category,
          makeModel: dto.makeModel?.trim() ?? '',
          serialNo: dto.serialNo?.trim() ?? '',
          purchasedOn: dto.purchasedOn ? new Date(dto.purchasedOn) : null,
          status: 'in_stock',
        },
        include: { assignments: { where: { returnedOn: null }, include: { employee: true } } },
      });
      await this.audit(tenantId, actorUserId, 'assets.create', asset.id);
      return this.assetView(asset);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That asset tag is already in use.');
      }
      throw error;
    }
  }

  async update(tenantId: string, actorUserId: string, id: string, dto: UpdateAssetDto) {
    const asset = await this.requireAsset(tenantId, id);
    if (dto.status === 'assigned') {
      throw new BadRequestException('Use assign to give an asset to someone.');
    }
    const open = asset.assignments[0];
    if (dto.status === 'in_stock' && open) {
      throw new BadRequestException('Return the asset before marking it in stock.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (open && (dto.status === 'lost' || dto.status === 'retired')) {
        await tx.assetAssignment.update({
          where: { id: open.id },
          data: {
            returnedOn: new Date(),
            conditionNotes: dto.status === 'lost' ? 'Marked lost' : 'Retired while assigned',
          },
        });
      }
      return tx.asset.update({
        where: { id },
        data: {
          category: dto.category,
          makeModel: dto.makeModel?.trim(),
          serialNo: dto.serialNo?.trim(),
          status: dto.status,
        },
        include: {
          assignments: {
            where: { returnedOn: null },
            include: { employee: true },
          },
        },
      });
    });
    await this.audit(tenantId, actorUserId, 'assets.update', id);
    return this.assetView(updated);
  }

  async assign(tenantId: string, actorUserId: string, id: string, dto: AssignAssetDto) {
    const asset = await this.requireAsset(tenantId, id);
    if (asset.assignments.length > 0) {
      throw new ConflictException('This asset is already assigned.');
    }
    if (asset.status === 'retired' || asset.status === 'lost') {
      throw new BadRequestException('Retired or lost assets cannot be assigned.');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.assetAssignment.create({
        data: {
          tenantId,
          assetId: id,
          employeeId: employee.id,
          conditionNotes: dto.conditionNotes?.trim() ?? '',
        },
      });
      return tx.asset.update({
        where: { id },
        data: { status: 'assigned' },
        include: {
          assignments: { where: { returnedOn: null }, include: { employee: true } },
        },
      });
    });
    await this.audit(tenantId, actorUserId, 'assets.assign', id);
    if (employee.userId) {
      await this.notifications.notify({
        tenantId,
        userId: employee.userId,
        title: 'Asset assigned',
        body: `${asset.assetTag} is now assigned to you.`,
        href: '/ess/assets',
        kind: 'asset',
      });
    }
    return this.assetView(updated);
  }

  async returnAsset(tenantId: string, actorUserId: string, id: string, dto: ReturnAssetDto) {
    const asset = await this.requireAsset(tenantId, id);
    const open = asset.assignments[0];
    if (!open) throw new BadRequestException('This asset is not currently assigned.');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.assetAssignment.update({
        where: { id: open.id },
        data: {
          returnedOn: new Date(),
          conditionNotes: dto.conditionNotes?.trim() || open.conditionNotes,
        },
      });
      return tx.asset.update({
        where: { id },
        data: { status: dto.status },
        include: { assignments: { where: { returnedOn: null }, include: { employee: true } } },
      });
    });
    await this.audit(tenantId, actorUserId, 'assets.return', id);
    if (open.employee.userId) {
      await this.notifications.notify({
        tenantId,
        userId: open.employee.userId,
        title: 'Asset returned',
        body: `${asset.assetTag} is no longer assigned to you.`,
        href: '/ess/assets',
        kind: 'asset',
      });
    }
    return this.assetView(updated);
  }

  async history(tenantId: string, id: string) {
    await this.requireAsset(tenantId, id);
    const rows = await this.prisma.assetAssignment.findMany({
      where: { tenantId, assetId: id },
      include: { employee: true },
      orderBy: { assignedOn: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      assignedOn: this.day(row.assignedOn),
      returnedOn: row.returnedOn ? this.day(row.returnedOn) : null,
      conditionNotes: row.conditionNotes,
      employee: {
        id: row.employee.id,
        name: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
        employeeCode: row.employee.employeeCode,
      },
    }));
  }

  async tickets(tenantId: string) {
    const rows = await this.prisma.assetTicket.findMany({
      where: { tenantId },
      include: { ...ticketInclude, employee: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      ...this.ticketView(row),
      person: {
        id: row.employee.id,
        name: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
        employeeCode: row.employee.employeeCode,
      },
    }));
  }

  async updateTicket(tenantId: string, actorUserId: string, id: string, dto: UpdateAssetTicketDto) {
    const ticket = await this.prisma.assetTicket.findFirst({
      where: { id, tenantId },
      include: { employee: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    await this.prisma.assetTicket.update({
      where: { id },
      data: { status: dto.status },
    });
    if (dto.note?.trim()) {
      await this.prisma.assetTicketComment.create({
        data: { ticketId: id, authorId: actorUserId, body: dto.note.trim() },
      });
    }
    await this.audit(tenantId, actorUserId, 'assets.ticket.status', id);
    if (ticket.employee.userId) {
      await this.notifications.notify({
        tenantId,
        userId: ticket.employee.userId,
        title: `Asset ticket ${dto.status}`,
        body: ticket.subject,
        href: '/ess/assets',
        kind: 'asset',
      });
    }
    const fresh = await this.prisma.assetTicket.findUniqueOrThrow({
      where: { id },
      include: ticketInclude,
    });
    return this.ticketView(fresh);
  }

  private async requireAsset(tenantId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId },
      include: {
        assignments: { where: { returnedOn: null }, include: { employee: true } },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    return asset;
  }

  private async employeeByUser(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee profile for this login.');
    return employee;
  }

  private async notifyItAdmins(
    tenantId: string,
    input: { title: string; body: string; href: string },
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        roles: { some: { role: { code: 'IT_ADMIN' } } },
      },
      select: { id: true },
    });
    await Promise.all(
      users.map((user) =>
        this.notifications.notify({
          tenantId,
          userId: user.id,
          title: input.title,
          body: input.body,
          href: input.href,
          kind: 'asset',
        }),
      ),
    );
  }

  private async audit(tenantId: string, actorUserId: string, action: string, entityId: string) {
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorUserId,
        action,
        entityType: 'asset',
        entityId,
      },
    });
  }

  private assetView(row: {
    id: string;
    assetTag: string;
    category: string;
    makeModel: string;
    serialNo: string;
    status: string;
    purchasedOn: Date | null;
    assignments: Array<{
      assignedOn: Date;
      employee: { id: string; firstName: string; lastName: string; employeeCode: string };
    }>;
  }) {
    const current = row.assignments[0];
    return {
      id: row.id,
      assetTag: row.assetTag,
      category: row.category,
      makeModel: row.makeModel,
      serialNo: row.serialNo,
      status: row.status,
      purchasedOn: row.purchasedOn ? this.day(row.purchasedOn) : null,
      current: current
        ? {
            employeeId: current.employee.id,
            name: `${current.employee.firstName} ${current.employee.lastName}`.trim(),
            employeeCode: current.employee.employeeCode,
            assignedOn: this.day(current.assignedOn),
          }
        : null,
    };
  }

  private ticketView(row: {
    id: string;
    type: string;
    category: string;
    subject: string;
    body: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    asset: { id: string; assetTag: string; category: string } | null;
    comments: Array<{ id: string; authorId: string; body: string; createdAt: Date }>;
  }) {
    return {
      id: row.id,
      type: row.type,
      category: row.category,
      subject: row.subject,
      body: row.body,
      status: row.status,
      asset: row.asset
        ? { id: row.asset.id, assetTag: row.asset.assetTag, category: row.asset.category }
        : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      comments: row.comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      })),
    };
  }

  private day(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}
