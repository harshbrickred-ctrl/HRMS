import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AlumniDocument,
  AlumniDocumentRequest,
  AlumniDocumentRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AlumniPrincipal } from './alumni-auth.service';
import { AlumniMailService } from './alumni-mail.service';
import {
  DOCUMENT_TYPE_LABELS,
  OPEN_REQUEST_STATUSES,
  canMoveRequest,
  portalAllowed,
} from './alumni-rules';
import {
  type Actor,
  type AlumniUpload,
  AlumniSupport,
  DOCUMENT_EXT,
} from './alumni-support.service';
import type {
  IssueRequestDto,
  RequestDecisionDto,
  UploadAlumniDocumentDto,
} from './dto/alumni-admin.dto';
import type { DocumentRequestDto } from './dto/alumni-portal.dto';

/**
 * ALM-07 and ALM-08. Every alumni read is filtered by the alumniId from the
 * login token, never by an id from the URL alone, so one alumnus can never
 * reach another's files (a wrong id simply answers 404).
 */
@Injectable()
export class AlumniDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AlumniSupport,
    private readonly mail: AlumniMailService,
  ) {}

  // ─── HR: the vault ─────────────────────────────────────────────────────────

  async listForAlumni(tenantId: string, alumniId: string) {
    await this.support.requireAlumni(tenantId, alumniId);
    const rows = await this.prisma.alumniDocument.findMany({
      where: { tenantId, alumniId },
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map((row) => this.view(row, true));
  }

  async upload(
    tenantId: string,
    actorUserId: string,
    alumniId: string,
    dto: UploadAlumniDocumentDto,
    file: AlumniUpload | undefined,
  ) {
    const alumni = await this.support.requireAlumni(tenantId, alumniId);
    const saved = await this.support.saveFile(
      tenantId,
      alumniId,
      'documents',
      file,
      DOCUMENT_EXT,
    );
    const doc = await this.prisma.alumniDocument.create({
      data: {
        tenantId,
        alumniId,
        type: dto.type,
        title: dto.title.trim(),
        period: dto.period?.trim() ?? '',
        fileName: saved.fileName,
        storagePath: saved.storagePath,
        source: 'hr_upload',
        issuedById: actorUserId,
      },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.document.issue',
      'AlumniDocument',
      doc.id,
      {
        alumniId,
        type: doc.type,
      },
    );
    const contact = await this.contact(alumni.id);
    if (contact)
      await this.mail.documentIssued(contact.email, contact.name, doc.title);
    return this.view(doc, true);
  }

  async revoke(
    tenantId: string,
    actorUserId: string,
    alumniId: string,
    documentId: string,
  ) {
    const doc = await this.prisma.alumniDocument.findFirst({
      where: { id: documentId, alumniId, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found.');
    if (doc.revokedAt) return this.view(doc, true);
    const updated = await this.prisma.alumniDocument.update({
      where: { id: doc.id },
      data: { revokedAt: new Date() },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.document.revoke',
      'AlumniDocument',
      doc.id,
      {
        alumniId,
      },
    );
    return this.view(updated, true);
  }

  async openForHr(tenantId: string, alumniId: string, documentId: string) {
    const doc = await this.prisma.alumniDocument.findFirst({
      where: { id: documentId, alumniId, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found.');
    return {
      stream: await this.support.open(doc.storagePath),
      fileName: doc.fileName,
    };
  }

  // ─── Alumnus: own documents ────────────────────────────────────────────────

  async mine(principal: AlumniPrincipal) {
    const rows = await this.prisma.alumniDocument.findMany({
      where: {
        alumniId: principal.alumniId,
        tenantId: principal.tenantId,
        revokedAt: null,
      },
      orderBy: [{ type: 'asc' }, { period: 'desc' }, { issuedAt: 'desc' }],
    });
    return rows.map((row) => this.view(row, false));
  }

  async openMine(principal: AlumniPrincipal, documentId: string) {
    const doc = await this.prisma.alumniDocument.findFirst({
      where: {
        id: documentId,
        alumniId: principal.alumniId,
        tenantId: principal.tenantId,
        revokedAt: null,
      },
    });
    if (!doc) throw new NotFoundException('Document not found.');
    const stream = await this.support.open(doc.storagePath);
    await this.prisma.alumniDocument.update({
      where: { id: doc.id },
      data: { downloadCount: { increment: 1 }, lastDownloadedAt: new Date() },
    });
    await this.support.audit(
      this.prisma,
      principal.tenantId,
      { type: 'alumni', alumniId: principal.alumniId },
      'alumni.document.download',
      'AlumniDocument',
      doc.id,
    );
    return { stream, fileName: doc.fileName };
  }

  // ─── Requests: alumnus side ────────────────────────────────────────────────

  async myRequests(principal: AlumniPrincipal) {
    const rows = await this.prisma.alumniDocumentRequest.findMany({
      where: { alumniId: principal.alumniId, tenantId: principal.tenantId },
      include: { issuedDocument: { select: { id: true, revokedAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const history = await this.support.historyFor(
      'document_request',
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...this.requestView(row),
      documentId:
        row.issuedDocument && !row.issuedDocument.revokedAt
          ? row.issuedDocument.id
          : null,
      history: history.get(row.id) ?? [],
    }));
  }

  async createRequest(principal: AlumniPrincipal, dto: DocumentRequestDto) {
    const period = dto.period?.trim() ?? '';
    const open = await this.prisma.alumniDocumentRequest.findFirst({
      where: {
        alumniId: principal.alumniId,
        type: dto.type,
        period,
        status: { in: OPEN_REQUEST_STATUSES },
      },
    });
    if (open)
      throw new ConflictException(
        'You already have an open request for this document.',
      );
    const actor: Actor = { type: 'alumni', alumniId: principal.alumniId };
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.alumniDocumentRequest.create({
        data: {
          tenantId: principal.tenantId,
          alumniId: principal.alumniId,
          type: dto.type,
          period,
          reason: dto.reason.trim(),
        },
      });
      await this.support.history(
        tx,
        principal.tenantId,
        'document_request',
        created.id,
        '',
        'submitted',
        actor,
      );
      await this.support.audit(
        tx,
        principal.tenantId,
        actor,
        'alumni.document_request.create',
        'AlumniDocumentRequest',
        created.id,
        {
          type: dto.type,
        },
      );
      return created;
    });
    return this.requestView(row);
  }

  async cancelRequest(principal: AlumniPrincipal, id: string) {
    const row = await this.prisma.alumniDocumentRequest.findFirst({
      where: { id, alumniId: principal.alumniId, tenantId: principal.tenantId },
    });
    if (!row) throw new NotFoundException('Request not found.');
    if (row.status !== 'submitted' && row.status !== 'under_review') {
      throw new BadRequestException(
        'Only a request that HR has not decided yet can be cancelled.',
      );
    }
    const updated = await this.move(
      principal.tenantId,
      row,
      'cancelled',
      { type: 'alumni', alumniId: principal.alumniId },
      'Cancelled by the alumnus',
    );
    return this.requestView(updated);
  }

  // ─── Requests: HR side ─────────────────────────────────────────────────────

  async listRequests(tenantId: string, status?: AlumniDocumentRequestStatus) {
    const rows = await this.prisma.alumniDocumentRequest.findMany({
      where: { tenantId, status },
      include: {
        alumni: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            eligibility: true,
          },
        },
        issuedDocument: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const history = await this.support.historyFor(
      'document_request',
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...this.requestView(row),
      alumni: row.alumni,
      documentId: row.issuedDocument?.id ?? null,
      history: history.get(row.id) ?? [],
    }));
  }

  async review(tenantId: string, actorUserId: string, id: string) {
    const row = await this.requireRequest(tenantId, id);
    if (row.status !== 'submitted')
      throw new BadRequestException(
        'Only a new request can be put under review.',
      );
    return this.requestView(
      await this.move(tenantId, row, 'under_review', {
        type: 'hr',
        userId: actorUserId,
      }),
    );
  }

  async decide(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: RequestDecisionDto,
  ) {
    const row = await this.requireRequest(tenantId, id);
    const note = dto.note?.trim() ?? '';
    const to = dto.decision === 'approve' ? 'approved' : 'rejected';
    if (to === 'rejected' && note.length < 3)
      throw new BadRequestException('Give a reason for rejecting the request.');
    const updated = await this.move(
      tenantId,
      row,
      to,
      { type: 'hr', userId: actorUserId },
      note,
      {
        reviewedById: actorUserId,
        decidedAt: new Date(),
        decisionNote: note,
      },
    );
    const contact = await this.contact(row.alumniId);
    if (contact) {
      await this.mail.requestUpdate(
        contact.email,
        contact.name,
        DOCUMENT_TYPE_LABELS[row.type],
        to,
        note,
      );
    }
    return this.requestView(updated);
  }

  /** Issuing puts the file in the alumnus's vault and emails them. */
  async issue(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: IssueRequestDto,
    file: AlumniUpload | undefined,
  ) {
    const row = await this.requireRequest(tenantId, id);
    if (row.status !== 'approved')
      throw new BadRequestException(
        'Approve the request before issuing the document.',
      );
    const saved = await this.support.saveFile(
      tenantId,
      row.alumniId,
      'documents',
      file,
      DOCUMENT_EXT,
    );
    const title = dto.title?.trim() || DOCUMENT_TYPE_LABELS[row.type];
    const actor: Actor = { type: 'hr', userId: actorUserId };
    const updated = await this.prisma
      .$transaction(async (tx) => {
        const doc = await tx.alumniDocument.create({
          data: {
            tenantId,
            alumniId: row.alumniId,
            type: row.type,
            title,
            period: dto.period?.trim() ?? row.period,
            fileName: saved.fileName,
            storagePath: saved.storagePath,
            source: 'request',
            requestId: row.id,
            issuedById: actorUserId,
          },
        });
        const result = await this.move(
          tenantId,
          row,
          'issued',
          actor,
          '',
          { issuedAt: new Date() },
          tx,
        );
        await this.support.audit(
          tx,
          tenantId,
          actor,
          'alumni.document.issue',
          'AlumniDocument',
          doc.id,
          {
            alumniId: row.alumniId,
            requestId: row.id,
          },
        );
        return result;
      })
      .catch(async (error: unknown) => {
        await this.support.remove(saved.storagePath);
        throw error;
      });
    const contact = await this.contact(row.alumniId);
    if (contact)
      await this.mail.documentIssued(contact.email, contact.name, title);
    return this.requestView(updated);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async move(
    tenantId: string,
    row: AlumniDocumentRequest,
    to: AlumniDocumentRequestStatus,
    actor: Actor,
    note = '',
    extra: Partial<
      Pick<
        AlumniDocumentRequest,
        'reviewedById' | 'decidedAt' | 'decisionNote' | 'issuedAt'
      >
    > = {},
    db: Parameters<AlumniSupport['history']>[0] = this.prisma,
  ) {
    if (!canMoveRequest(row.status, to)) {
      throw new BadRequestException(
        `A ${row.status.replace('_', ' ')} request cannot become ${to.replace('_', ' ')}.`,
      );
    }
    // Guard against two HR users acting on the same request at once.
    const { count } = await db.alumniDocumentRequest.updateMany({
      where: { id: row.id, status: row.status },
      data: { status: to, ...extra },
    });
    if (count !== 1)
      throw new ConflictException(
        'This request was just updated by someone else. Refresh and try again.',
      );
    await this.support.history(
      db,
      tenantId,
      'document_request',
      row.id,
      row.status,
      to,
      actor,
      note,
    );
    if (actor.type === 'hr') {
      await this.support.audit(
        db,
        tenantId,
        actor,
        `alumni.document_request.${to}`,
        'AlumniDocumentRequest',
        row.id,
      );
    }
    return db.alumniDocumentRequest.findUniqueOrThrow({
      where: { id: row.id },
    });
  }

  private async requireRequest(tenantId: string, id: string) {
    const row = await this.prisma.alumniDocumentRequest.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Request not found.');
    return row;
  }

  /** Where to email the alumnus, or null when they may not be contacted. */
  private async contact(alumniId: string) {
    const alumni = await this.prisma.alumni.findUnique({
      where: { id: alumniId },
      include: { account: true },
    });
    if (
      !alumni?.account ||
      !portalAllowed(alumni.account.status, alumni.eligibility)
    )
      return null;
    return { email: alumni.account.email, name: alumni.fullName };
  }

  private requestView(row: AlumniDocumentRequest) {
    return {
      id: row.id,
      type: row.type,
      typeLabel: DOCUMENT_TYPE_LABELS[row.type],
      period: row.period,
      reason: row.reason,
      status: row.status,
      decisionNote: row.decisionNote,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private view(row: AlumniDocument, forHr: boolean) {
    return {
      id: row.id,
      type: row.type,
      typeLabel: DOCUMENT_TYPE_LABELS[row.type],
      title: row.title,
      period: row.period,
      fileName: row.fileName,
      issuedAt: row.issuedAt.toISOString(),
      ...(forHr
        ? {
            source: row.source,
            revokedAt: row.revokedAt?.toISOString() ?? null,
            downloadCount: row.downloadCount,
            lastDownloadedAt: row.lastDownloadedAt?.toISOString() ?? null,
          }
        : {}),
    };
  }
}
