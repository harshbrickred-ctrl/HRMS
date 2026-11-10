import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AssetStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import path from 'path';
import { dateOnlyUtc } from '../attendance/clock';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export type AssetUpload = { originalname: string; buffer: Buffer; size: number };
export type Tx = Prisma.TransactionClient;

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'assets');
const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};
export const PHOTO_EXT = new Set(['png', 'jpg', 'jpeg', 'webp']);
export const DOCUMENT_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf']);
export const UPLOAD_LIMITS = { limits: { fileSize: 10 * 1024 * 1024 } };
export const MAX_ATTACHMENTS = 5;
const ASSET_ADMIN_ROLES = ['IT_ADMIN', 'HR_HEAD'];

export const assetInclude = {
  category: true,
  location: true,
  assignments: {
    where: { returnedOn: null },
    include: { employee: { include: { department: true } } },
    orderBy: { assignedOn: 'desc' as const },
  },
} satisfies Prisma.AssetInclude;

export type AssetRow = Prisma.AssetGetPayload<{ include: typeof assetInclude }>;

export function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export function day(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function dayOrNull(value: Date | null | undefined) {
  return value ? day(value) : null;
}

export function toDay(value: string | null | undefined) {
  return value ? dateOnlyUtc(value.slice(0, 10)) : null;
}

/** Today in UTC date terms, matching how dates are stored. */
export function today() {
  return dateOnlyUtc(new Date().toISOString().slice(0, 10));
}

export function fullName(row: { firstName: string; lastName: string }) {
  return `${row.firstName} ${row.lastName}`.trim();
}

export function person(row: { id: string; firstName: string; lastName: string; employeeCode: string }) {
  return { id: row.id, name: fullName(row), employeeCode: row.employeeCode };
}

export function assetLabelOf(row: { name: string; assetTag: string }) {
  return row.name || row.assetTag;
}

@Injectable()
export class AssetSupport {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async employeeByUser(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee profile for this login.');
    return employee;
  }

  async requireAsset(tenantId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId },
      include: assetInclude,
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    return asset;
  }

  async requireEmployee(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: { user: { select: { status: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    return employee;
  }

  async requireActiveEmployee(tenantId: string, id: string) {
    const employee = await this.requireEmployee(tenantId, id);
    if (employee.user.status !== 'ACTIVE') {
      throw new BadRequestException(`${fullName(employee)} is not an active employee.`);
    }
    return employee;
  }

  /** Every status change goes through here so nothing moves without a history row. */
  recordStatus(
    tx: Tx,
    input: {
      tenantId: string;
      assetId: string;
      from: AssetStatus;
      to: AssetStatus;
      reason: string;
      source: 'allocation' | 'return' | 'status' | 'maintenance' | 'import';
      changedById: string | null;
      changedAt?: Date;
    },
  ) {
    return tx.assetStatusHistory.create({
      data: {
        tenantId: input.tenantId,
        assetId: input.assetId,
        fromStatus: input.from,
        toStatus: input.to,
        reason: input.reason.trim(),
        source: input.source,
        changedById: input.changedById,
        changedAt: input.changedAt,
      },
    });
  }

  async audit(
    tenantId: string,
    actorUserId: string | null,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorUserId,
        action,
        entityType: 'asset',
        entityId,
        metadata: metadata as object | undefined,
      },
    });
  }

  async notifyAssetAdmins(tenantId: string, input: { title: string; body: string; href: string }) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        roles: { some: { role: { code: { in: ASSET_ADMIN_ROLES } } } },
      },
      select: { id: true },
    });
    await Promise.all(users.map((user) => this.notifyUser(tenantId, user.id, input)));
  }

  async notifyUser(
    tenantId: string,
    userId: string | null | undefined,
    input: { title: string; body: string; href?: string },
  ) {
    if (!userId) return;
    await this.notifications.notify({
      tenantId,
      userId,
      title: input.title,
      body: input.body,
      href: input.href ?? '/ess/assets',
      kind: 'asset',
    });
  }

  async saveFile(tenantId: string, folder: string, file: AssetUpload | undefined, allowed: Set<string>) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a file to upload.');
    const safeName = path.basename(file.originalname).replace(/[^\w.\- ()]+/g, '_');
    const ext = safeName.includes('.') ? safeName.split('.').pop()!.toLowerCase() : '';
    if (!allowed.has(ext)) {
      throw new BadRequestException(`Use a ${[...allowed].join(', ').toUpperCase()} file.`);
    }
    const storagePath = path.join(tenantId, folder, `${randomUUID()}-${safeName}`);
    const absolute = path.join(UPLOAD_ROOT, storagePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, file.buffer);
    return { fileName: safeName, storagePath };
  }

  async openFile(storagePath: string, fileName: string) {
    const absolute = path.join(UPLOAD_ROOT, storagePath);
    await fs.access(absolute).catch(() => {
      throw new NotFoundException('File not found.');
    });
    return {
      stream: createReadStream(absolute),
      fileName,
      contentType: CONTENT_TYPES[fileName.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream',
    };
  }

  async removeFile(storagePath: string) {
    await fs.unlink(path.join(UPLOAD_ROOT, storagePath)).catch(() => undefined);
  }

  /** Display names for user ids held on history rows. */
  async userNames(tenantId: string, ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: unique } },
      include: { employee: true },
    });
    return new Map(users.map((user) => [user.id, user.employee ? fullName(user.employee) : user.email]));
  }
}
