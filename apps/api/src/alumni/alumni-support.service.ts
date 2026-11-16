import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type AlumniAccountStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import path from 'path';
import { dateOnlyUtc } from '../attendance/clock';
import { PrismaService } from '../prisma/prisma.service';

export type AlumniUpload = {
  originalname: string;
  buffer: Buffer;
  size: number;
};
export type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

/** Who did something: an HR user, an alumnus, or the system itself. */
export type Actor =
  | { type: 'hr'; userId: string }
  | { type: 'alumni'; alumniId: string }
  | { type: 'system' };

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'alumni');
/** Where PayslipsService keeps its PDFs; read only, to copy them at exit. */
export const PAYSLIP_ROOT = path.join(process.cwd(), 'uploads', 'payslips');

export const DOCUMENT_EXT = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'doc',
  'docx',
]);
export const PHOTO_EXT = new Set(['png', 'jpg', 'jpeg']);
export const RESUME_EXT = new Set(['pdf', 'doc', 'docx']);
export const DOCUMENT_UPLOAD = { limits: { fileSize: 10 * 1024 * 1024 } };
export const PHOTO_UPLOAD = { limits: { fileSize: 2 * 1024 * 1024 } };
export const RESUME_UPLOAD = { limits: { fileSize: 5 * 1024 * 1024 } };

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export function isPrismaError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

export function day(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function dayOrNull(value: Date | null | undefined) {
  return value ? day(value) : null;
}

/** YYYY-MM-DD (or a full ISO string) to a UTC date; rejects dates such as 2026-02-30. */
export function toDay(value: string) {
  const iso = value.slice(0, 10);
  const date = dateOnlyUtc(iso);
  if (Number.isNaN(date.getTime()) || day(date) !== iso) {
    throw new BadRequestException(`${value} is not a valid date.`);
  }
  return date;
}

/** Today in UTC date terms, matching how dates are stored. */
export function today() {
  return dateOnlyUtc(new Date().toISOString().slice(0, 10));
}

export function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

export function contentType(fileName: string) {
  return CONTENT_TYPES[extension(fileName)] ?? 'application/octet-stream';
}

export function attachment(fileName: string) {
  return `attachment; filename="${fileName.replace(/["\r\n]/g, '')}"`;
}

function extension(fileName: string) {
  return fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
}

function safeName(original: string) {
  return path
    .basename(original)
    .replace(/[^\w.\- ()]+/g, '_')
    .slice(-120);
}

/** PNG or JPEG by their first bytes, so a renamed file cannot pose as a photo. */
function looksLikeImage(buffer: Buffer) {
  const png = buffer
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return png || jpeg;
}

@Injectable()
export class AlumniSupport {
  constructor(private readonly prisma: PrismaService) {}

  /** AuditEvent row. Alumni are not Users, so their actions carry alumniId in metadata. */
  async audit(
    db: Db,
    tenantId: string,
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata: Record<string, unknown> = {},
  ) {
    await db.auditEvent.create({
      data: {
        tenantId,
        actorUserId: actor.type === 'hr' ? actor.userId : null,
        action,
        entityType,
        entityId,
        metadata: {
          ...metadata,
          actorType: actor.type,
          ...(actor.type === 'alumni' ? { alumniId: actor.alumniId } : {}),
        } as Prisma.InputJsonObject,
      },
    });
  }

  /** Status trail shown to HR and to the alumnus. */
  async history(
    db: Db,
    tenantId: string,
    entityType: 'document_request' | 'job_application' | 'referral' | 'rehire',
    entityId: string,
    fromStatus: string,
    toStatus: string,
    actor: Actor,
    note = '',
  ) {
    await db.alumniStatusHistory.create({
      data: {
        tenantId,
        entityType,
        entityId,
        fromStatus,
        toStatus,
        note,
        actorType: actor.type,
        actorId:
          actor.type === 'hr'
            ? actor.userId
            : actor.type === 'alumni'
              ? actor.alumniId
              : '',
      },
    });
  }

  async historyFor(entityType: string, entityIds: string[]) {
    if (!entityIds.length)
      return new Map<
        string,
        {
          fromStatus: string;
          toStatus: string;
          note: string;
          actorType: string;
          at: string;
        }[]
      >();
    const rows = await this.prisma.alumniStatusHistory.findMany({
      where: { entityType, entityId: { in: entityIds } },
      orderBy: { createdAt: 'asc' },
    });
    const byEntity = new Map<
      string,
      {
        fromStatus: string;
        toStatus: string;
        note: string;
        actorType: string;
        at: string;
      }[]
    >();
    for (const row of rows) {
      const list = byEntity.get(row.entityId) ?? [];
      list.push({
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        note: row.note,
        actorType: row.actorType,
        at: row.createdAt.toISOString(),
      });
      byEntity.set(row.entityId, list);
    }
    return byEntity;
  }

  /** Ends portal access: no login, no sessions, no codes, no emails, hidden from the directory. */
  async closeAccount(
    db: Db,
    accountId: string,
    status: Exclude<AlumniAccountStatus, 'active'>,
    reason: string,
  ) {
    const now = new Date();
    const account = await db.alumniAccount.update({
      where: { id: accountId },
      data: { status, statusReason: reason, communicationsConsent: false },
    });
    await db.alumniSession.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: now },
    });
    await db.alumniOtp.updateMany({
      where: { accountId, consumedAt: null },
      data: { consumedAt: now },
    });
    await db.alumniProfile.updateMany({
      where: { alumniId: account.alumniId },
      data: { directoryOptIn: false, directoryOptInAt: null },
    });
  }

  async requireAlumni(tenantId: string, id: string) {
    const alumni = await this.prisma.alumni.findFirst({
      where: { id, tenantId },
    });
    if (!alumni) throw new NotFoundException('Alumni record not found.');
    return alumni;
  }

  async saveFile(
    tenantId: string,
    alumniId: string,
    folder: string,
    file: AlumniUpload | undefined,
    allowed: Set<string>,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Choose a file to upload.');
    const fileName = safeName(file.originalname);
    if (!allowed.has(extension(fileName))) {
      throw new BadRequestException(
        `Use a ${[...allowed].join(', ').toUpperCase()} file.`,
      );
    }
    if (allowed === PHOTO_EXT && !looksLikeImage(file.buffer)) {
      throw new BadRequestException('That file is not a PNG or JPG image.');
    }
    const storagePath = path.join(
      tenantId,
      alumniId,
      folder,
      `${randomUUID()}-${fileName}`,
    );
    const absolute = this.resolve(storagePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, file.buffer);
    return { fileName, storagePath };
  }

  /** Copies a file from elsewhere in uploads/ into the alumnus's folder; null when the source is missing. */
  async copyIn(
    sourceAbsolute: string,
    tenantId: string,
    alumniId: string,
    folder: string,
    fileName: string,
  ) {
    const storagePath = path.join(
      tenantId,
      alumniId,
      folder,
      `${randomUUID()}-${safeName(fileName)}`,
    );
    const absolute = this.resolve(storagePath);
    try {
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.copyFile(sourceAbsolute, absolute);
      return storagePath;
    } catch {
      return null;
    }
  }

  async open(storagePath: string) {
    const absolute = this.resolve(storagePath);
    try {
      await fs.access(absolute);
    } catch {
      throw new NotFoundException('The file is missing on the server.');
    }
    return createReadStream(absolute);
  }

  async remove(storagePath: string) {
    if (!storagePath) return;
    await fs.unlink(this.resolve(storagePath)).catch(() => undefined);
  }

  /** Keeps every path inside uploads/alumni. */
  private resolve(storagePath: string) {
    const absolute = path.resolve(UPLOAD_ROOT, storagePath);
    if (!absolute.startsWith(UPLOAD_ROOT + path.sep))
      throw new NotFoundException('File not found.');
    return absolute;
  }
}
