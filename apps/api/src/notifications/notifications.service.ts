import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.view(row));
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Notification not found.');
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: row.readAt ?? new Date() },
    });
    return this.view(updated);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async notify(input: {
    tenantId: string;
    userId: string;
    title: string;
    body?: string;
    href?: string;
    kind?: string;
  }) {
    if (!input.userId) return null;
    return this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        title: input.title,
        body: input.body ?? '',
        href: input.href ?? '',
        kind: input.kind ?? 'info',
      },
    });
  }

  private view(row: {
    id: string;
    title: string;
    body: string;
    href: string;
    kind: string;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      href: row.href,
      kind: row.kind,
      read: Boolean(row.readAt),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
