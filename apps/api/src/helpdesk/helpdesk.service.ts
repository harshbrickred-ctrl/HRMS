import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateTicketDto, UpdateTicketStatusDto } from './dto/helpdesk.dto';

@Injectable()
export class HelpdeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async myTickets(userId: string) {
    const employee = await this.employeeByUser(userId);
    const rows = await this.prisma.helpdeskTicket.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    });
    return rows.map((row) => this.view(row));
  }

  async create(userId: string, dto: CreateTicketDto) {
    const employee = await this.employeeByUser(userId);
    if (!dto.subject.trim() || !dto.body.trim() || !dto.category.trim()) {
      throw new BadRequestException('Category, subject, and body are required.');
    }
    const ticket = await this.prisma.helpdeskTicket.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        category: dto.category.trim(),
        subject: dto.subject.trim(),
        body: dto.body.trim(),
      },
      include: { comments: true },
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId: employee.tenantId,
        actorUserId: userId,
        action: 'helpdesk.ticket.create',
        entityType: 'helpdesk',
        entityId: ticket.id,
      },
    });
    return this.view(ticket);
  }

  async companyTickets(tenantId: string) {
    const rows = await this.prisma.helpdeskTicket.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        comments: { orderBy: { createdAt: 'asc' } },
        employee: true,
      },
      take: 100,
    });
    return rows.map((row) => ({
      ...this.view(row),
      person: {
        id: row.employee.id,
        name: `${row.employee.firstName} ${row.employee.lastName}`,
        employeeCode: row.employee.employeeCode,
      },
    }));
  }

  async updateStatus(tenantId: string, actorUserId: string, id: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.prisma.helpdeskTicket.findFirst({
      where: { id, tenantId },
      include: { employee: true, comments: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    const updated = await this.prisma.helpdeskTicket.update({
      where: { id },
      data: { status: dto.status },
      include: { comments: { orderBy: { createdAt: 'asc' } }, employee: true },
    });
    if (dto.note?.trim()) {
      await this.prisma.helpdeskComment.create({
        data: {
          ticketId: id,
          authorId: actorUserId,
          body: dto.note.trim(),
        },
      });
    }
    if (ticket.employee.userId) {
      await this.notifications.notify({
        tenantId,
        userId: ticket.employee.userId,
        title: `Ticket ${dto.status}`,
        body: ticket.subject,
        href: '/ess/helpdesk',
        kind: 'helpdesk',
      });
    }
    return this.view(
      await this.prisma.helpdeskTicket.findUniqueOrThrow({
        where: { id },
        include: { comments: { orderBy: { createdAt: 'asc' } } },
      }),
    );
  }

  private async employeeByUser(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee profile for this login.');
    return employee;
  }

  private view(row: {
    id: string;
    category: string;
    subject: string;
    body: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    comments?: Array<{ id: string; authorId: string; body: string; createdAt: Date }>;
  }) {
    return {
      id: row.id,
      category: row.category,
      subject: row.subject,
      body: row.body,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      comments: (row.comments ?? []).map((comment) => ({
        id: comment.id,
        authorId: comment.authorId,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      })),
    };
  }
}
