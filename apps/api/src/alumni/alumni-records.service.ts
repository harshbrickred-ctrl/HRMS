import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type AlumniExitClosure } from '@prisma/client';
import path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  ELIGIBILITY_LABELS,
  OPEN_REFERRAL_STATUSES,
  OPEN_REQUEST_STATUSES,
  accessStatus,
  formatTenure,
  tenureMonths,
} from './alumni-rules';
import {
  type Actor,
  AlumniSupport,
  PAYSLIP_ROOT,
  day,
  dayOrNull,
  isPrismaError,
  normaliseEmail,
  toDay,
  today,
} from './alumni-support.service';
import type {
  AlumniListQueryDto,
  CreateExitClosureDto,
  EligibilityDto,
  UpdateAlumniRecordDto,
  UpdateExitClosureDto,
} from './dto/alumni-admin.dto';

/** Read only: the Employee master is copied from, never written to. */
const employeeSnapshot = {
  department: true,
  location: true,
  user: { select: { email: true, status: true } },
} satisfies Prisma.EmployeeInclude;

const listInclude = {
  account: { select: { status: true, email: true, lastLoginAt: true } },
  invitations: { orderBy: { sentAt: 'desc' as const }, take: 1 },
} satisfies Prisma.AlumniInclude;

type ListRow = Prisma.AlumniGetPayload<{ include: typeof listInclude }>;
type ClosureDates = Pick<
  AlumniExitClosure,
  'joiningDate' | 'lastWorkingDay' | 'exitCompletedOn' | 'fnfSettledOn'
>;

@Injectable()
export class AlumniRecordsService {
  private readonly logger = new Logger(AlumniRecordsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AlumniSupport,
  ) {}

  async overview(tenantId: string) {
    const now = new Date();
    const [
      byEligibility,
      registered,
      invited,
      pendingClosures,
      openRequests,
      upcomingEvents,
      openJobs,
      openReferrals,
    ] = await Promise.all([
      this.prisma.alumni.groupBy({
        by: ['eligibility'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.alumniAccount.count({
        where: { tenantId, status: 'active' },
      }),
      this.prisma.alumniInvitation.count({
        where: {
          tenantId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
      this.prisma.alumniExitClosure.count({
        where: { tenantId, alumni: { is: null } },
      }),
      this.prisma.alumniDocumentRequest.count({
        where: { tenantId, status: { in: OPEN_REQUEST_STATUSES } },
      }),
      this.prisma.alumniEvent.count({
        where: { tenantId, status: 'published', startsAt: { gt: now } },
      }),
      this.prisma.alumniJob.count({ where: { tenantId, status: 'open' } }),
      this.prisma.alumniReferral.count({
        where: { tenantId, status: { in: OPEN_REFERRAL_STATUSES } },
      }),
    ]);
    const count = (key: string) =>
      byEligibility.find((row) => row.eligibility === key)?._count._all ?? 0;
    return {
      alumni: byEligibility.reduce((sum, row) => sum + row._count._all, 0),
      eligible: count('eligible'),
      notEligible: count('not_eligible'),
      doNotContact: count('do_not_contact'),
      registered,
      invited,
      pendingClosures,
      openRequests,
      upcomingEvents,
      openJobs,
      openReferrals,
    };
  }

  // ─── Exit closures ─────────────────────────────────────────────────────────

  async listClosures(tenantId: string) {
    const rows = await this.prisma.alumniExitClosure.findMany({
      where: { tenantId },
      include: { alumni: { select: { id: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, id: { in: rows.map((row) => row.employeeId) } },
      include: employeeSnapshot,
    });
    const byId = new Map(employees.map((employee) => [employee.id, employee]));
    return rows.map((row) => {
      const employee = byId.get(row.employeeId);
      return {
        id: row.id,
        employeeId: row.employeeId,
        employeeCode: employee?.employeeCode ?? '',
        employeeName: employee
          ? `${employee.firstName} ${employee.lastName}`.trim()
          : '',
        designation: employee?.designation ?? '',
        departmentName: employee?.department?.name ?? '',
        /** The old employee login is HR's to disable; shown as a reminder only. */
        employeeLoginActive: employee?.user.status === 'ACTIVE',
        joiningDate: day(row.joiningDate),
        lastWorkingDay: day(row.lastWorkingDay),
        personalEmail: row.personalEmail,
        exitCompletedOn: dayOrNull(row.exitCompletedOn),
        fnfSettledOn: dayOrNull(row.fnfSettledOn),
        fnfReference: row.fnfReference,
        notes: row.notes,
        alumniId: row.alumni?.id ?? null,
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async createClosure(
    tenantId: string,
    actorUserId: string,
    dto: CreateExitClosureDto,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    const dates: ClosureDates = {
      joiningDate: toDay(dto.joiningDate),
      lastWorkingDay: toDay(dto.lastWorkingDay),
      exitCompletedOn: dto.exitCompletedOn ? toDay(dto.exitCompletedOn) : null,
      fnfSettledOn: dto.fnfSettledOn ? toDay(dto.fnfSettledOn) : null,
    };
    this.checkDates(dates);

    let closure: AlumniExitClosure;
    try {
      closure = await this.prisma.$transaction(async (tx) => {
        const row = await tx.alumniExitClosure.create({
          data: {
            tenantId,
            employeeId: employee.id,
            ...dates,
            personalEmail: normaliseEmail(dto.personalEmail),
            fnfReference: dto.fnfReference?.trim() ?? '',
            notes: dto.notes?.trim() ?? '',
            recordedById: actorUserId,
            updatedById: actorUserId,
          },
        });
        await this.support.audit(
          tx,
          tenantId,
          { type: 'hr', userId: actorUserId },
          'alumni.exit_closure.create',
          'AlumniExitClosure',
          row.id,
          {
            employeeId: employee.id,
          },
        );
        return row;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002'))
        throw new ConflictException(
          'An exit closure already exists for this employee.',
        );
      throw error;
    }
    await this.createFromExit(tenantId, closure.id, {
      type: 'hr',
      userId: actorUserId,
    });
    return this.closure(tenantId, closure.id);
  }

  async updateClosure(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateExitClosureDto,
  ) {
    const current = await this.prisma.alumniExitClosure.findFirst({
      where: { id, tenantId },
      include: { alumni: true },
    });
    if (!current) throw new NotFoundException('Exit closure not found.');
    const changesCore = [
      dto.joiningDate,
      dto.lastWorkingDay,
      dto.personalEmail,
      dto.exitCompletedOn,
      dto.fnfSettledOn,
    ].some((value) => value !== undefined);
    if (current.alumni && changesCore) {
      throw new BadRequestException(
        'The alumni record already exists, so the exit dates are locked. Correct the personal email on the alumni record instead.',
      );
    }
    const dates: ClosureDates = {
      joiningDate: dto.joiningDate
        ? toDay(dto.joiningDate)
        : current.joiningDate,
      lastWorkingDay: dto.lastWorkingDay
        ? toDay(dto.lastWorkingDay)
        : current.lastWorkingDay,
      exitCompletedOn: dto.exitCompletedOn
        ? toDay(dto.exitCompletedOn)
        : current.exitCompletedOn,
      fnfSettledOn: dto.fnfSettledOn
        ? toDay(dto.fnfSettledOn)
        : current.fnfSettledOn,
    };
    this.checkDates(dates);
    await this.prisma.$transaction(async (tx) => {
      await tx.alumniExitClosure.update({
        where: { id },
        data: {
          ...dates,
          personalEmail: dto.personalEmail
            ? normaliseEmail(dto.personalEmail)
            : undefined,
          fnfReference: dto.fnfReference?.trim(),
          notes: dto.notes?.trim(),
          updatedById: actorUserId,
        },
      });
      await this.support.audit(
        tx,
        tenantId,
        { type: 'hr', userId: actorUserId },
        'alumni.exit_closure.update',
        'AlumniExitClosure',
        id,
        {
          exitCompleted: Boolean(dates.exitCompletedOn),
          fnfSettled: Boolean(dates.fnfSettledOn),
        },
      );
    });
    await this.createFromExit(tenantId, id, {
      type: 'hr',
      userId: actorUserId,
    });
    return this.closure(tenantId, id);
  }

  /**
   * ALM-01. Creates the alumni record once the exit is completed and F&F is
   * settled, copying the Employee master. Safe to call again. A future Exit or
   * F&F module only needs to call this method.
   */
  async createFromExit(tenantId: string, closureId: string, actor: Actor) {
    const closure = await this.prisma.alumniExitClosure.findFirst({
      where: { id: closureId, tenantId },
      include: { alumni: true },
    });
    if (!closure) throw new NotFoundException('Exit closure not found.');
    if (closure.alumni) return closure.alumni;
    if (!closure.exitCompletedOn || !closure.fnfSettledOn) return null;

    const employee = await this.prisma.employee.findFirst({
      where: { id: closure.employeeId, tenantId },
      include: employeeSnapshot,
    });
    if (!employee) throw new NotFoundException('Employee not found.');

    const existing = await this.prisma.alumni.findFirst({
      where: { tenantId, employeeId: employee.id },
    });
    if (existing) {
      if (!existing.exitClosureId) {
        await this.prisma.alumni.update({
          where: { id: existing.id },
          data: { exitClosureId: closure.id },
        });
      }
      return existing;
    }

    const alumni = await this.prisma.$transaction(async (tx) => {
      const row = await tx.alumni.create({
        data: {
          tenantId,
          employeeId: employee.id,
          exitClosureId: closure.id,
          employeeCode: employee.employeeCode,
          fullName: `${employee.firstName} ${employee.lastName}`.trim(),
          personalEmail: closure.personalEmail,
          designation: employee.designation,
          departmentId: employee.departmentId,
          departmentName: employee.department?.name ?? '',
          locationName: employee.location?.name ?? '',
          joiningDate: closure.joiningDate,
          lastWorkingDay: closure.lastWorkingDay,
          tenureMonths: tenureMonths(
            closure.joiningDate,
            closure.lastWorkingDay,
          ),
        },
      });
      await this.support.audit(
        tx,
        tenantId,
        actor,
        'alumni.record.create',
        'Alumni',
        row.id,
        {
          employeeId: employee.id,
          exitClosureId: closure.id,
        },
      );
      return row;
    });
    await this.copyPayslips(tenantId, alumni.id, employee.id);
    return alumni;
  }

  // ─── Alumni records ────────────────────────────────────────────────────────

  async list(tenantId: string, query: AlumniListQueryDto) {
    const q = query.q?.trim();
    const rows = await this.prisma.alumni.findMany({
      where: {
        tenantId,
        eligibility: query.eligibility,
        departmentName: query.department
          ? { equals: query.department, mode: 'insensitive' }
          : undefined,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { employeeCode: { contains: q, mode: 'insensitive' } },
                { personalEmail: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: listInclude,
      orderBy: { lastWorkingDay: 'desc' },
      take: 2000,
    });
    return rows
      .map((row) => this.listView(row))
      .filter(
        (row) =>
          !query.exitYear ||
          Number(row.lastWorkingDay.slice(0, 4)) === query.exitYear,
      )
      .filter((row) => !query.access || row.access === query.access);
  }

  async detail(tenantId: string, id: string) {
    const row = await this.prisma.alumni.findFirst({
      where: { id, tenantId },
      include: {
        account: {
          select: {
            id: true,
            email: true,
            status: true,
            statusReason: true,
            emailVerifiedAt: true,
            lastLoginAt: true,
            lockedUntil: true,
            communicationsConsent: true,
            createdAt: true,
          },
        },
        invitations: { orderBy: { sentAt: 'desc' }, take: 10 },
        consents: { orderBy: { recordedAt: 'desc' }, take: 50 },
        profile: true,
        documents: { orderBy: { issuedAt: 'desc' } },
        documentRequests: { orderBy: { createdAt: 'desc' } },
        applications: {
          include: { job: { select: { title: true } } },
          orderBy: { createdAt: 'desc' },
        },
        referrals: { orderBy: { createdAt: 'desc' } },
        rehires: { orderBy: { createdAt: 'desc' } },
        exitClosure: true,
      },
    });
    if (!row) throw new NotFoundException('Alumni record not found.');
    const updatedBy = row.eligibilityUpdatedById
      ? await this.prisma.user.findUnique({
          where: { id: row.eligibilityUpdatedById },
          select: { email: true },
        })
      : null;
    const now = new Date();
    return {
      ...this.listView({ ...row, invitations: row.invitations.slice(0, 1) }),
      eligibilityUpdatedBy: updatedBy?.email ?? null,
      eligibilityUpdatedAt: row.eligibilityUpdatedAt?.toISOString() ?? null,
      exitClosure: row.exitClosure
        ? {
            id: row.exitClosure.id,
            exitCompletedOn: dayOrNull(row.exitClosure.exitCompletedOn),
            fnfSettledOn: dayOrNull(row.exitClosure.fnfSettledOn),
            fnfReference: row.exitClosure.fnfReference,
          }
        : null,
      account: row.account
        ? {
            email: row.account.email,
            status: row.account.status,
            statusReason: row.account.statusReason,
            emailVerifiedAt: row.account.emailVerifiedAt.toISOString(),
            lastLoginAt: row.account.lastLoginAt?.toISOString() ?? null,
            locked: Boolean(
              row.account.lockedUntil && row.account.lockedUntil > now,
            ),
            communications: row.account.communicationsConsent,
            registeredAt: row.account.createdAt.toISOString(),
          }
        : null,
      directoryOptIn: row.profile?.directoryOptIn ?? false,
      invitations: row.invitations.map((invite) => ({
        id: invite.id,
        email: invite.email,
        sentAt: invite.sentAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
        acceptedAt: invite.acceptedAt?.toISOString() ?? null,
        revokedAt: invite.revokedAt?.toISOString() ?? null,
        revokeReason: invite.revokeReason,
      })),
      consents: row.consents.map((consent) => ({
        type: consent.type,
        granted: consent.granted,
        version: consent.version,
        recordedAt: consent.recordedAt.toISOString(),
        ipAddress: consent.ipAddress,
      })),
      documents: row.documents.map((doc) => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        period: doc.period,
        fileName: doc.fileName,
        source: doc.source,
        issuedAt: doc.issuedAt.toISOString(),
        revokedAt: doc.revokedAt?.toISOString() ?? null,
        downloadCount: doc.downloadCount,
      })),
      requests: row.documentRequests.map((request) => ({
        id: request.id,
        type: request.type,
        period: request.period,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
      })),
      applications: row.applications.map((app) => ({
        id: app.id,
        jobTitle: app.job.title,
        status: app.status,
        createdAt: app.createdAt.toISOString(),
      })),
      referrals: row.referrals.map((ref) => ({
        id: ref.id,
        candidateName: ref.candidateName,
        status: ref.status,
        rewardStatus: ref.rewardStatus,
      })),
      rehires: row.rehires.map((rehire) => ({
        id: rehire.id,
        status: rehire.status,
        newEmployeeId: rehire.newEmployeeId,
        joiningDate: day(rehire.joiningDate),
      })),
    };
  }

  /** Fix a mistyped personal email before the alumnus registers. */
  async updateRecord(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateAlumniRecordDto,
  ) {
    const alumni = await this.prisma.alumni.findFirst({
      where: { id, tenantId },
      include: { account: true },
    });
    if (!alumni) throw new NotFoundException('Alumni record not found.');
    if (alumni.account?.status === 'active') {
      throw new BadRequestException(
        'The alumnus has registered; they change their login email in the portal.',
      );
    }
    const personalEmail = normaliseEmail(dto.personalEmail);
    await this.prisma.$transaction(async (tx) => {
      await tx.alumni.update({ where: { id }, data: { personalEmail } });
      // Links sent to the old address stop working.
      await tx.alumniInvitation.updateMany({
        where: { alumniId: id, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'Personal email changed' },
      });
      await this.support.audit(
        tx,
        tenantId,
        { type: 'hr', userId: actorUserId },
        'alumni.record.update',
        'Alumni',
        id,
        {
          from: alumni.personalEmail,
          to: personalEmail,
        },
      );
    });
    return this.detail(tenantId, id);
  }

  /**
   * ALM-02 and rule 7. Not eligible or Do not contact cancels open invitations.
   * Do not contact also closes the login (no portal, no documents), stops emails,
   * cancels open document requests and writes an audit entry.
   */
  async updateEligibility(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: EligibilityDto,
  ) {
    const alumni = await this.support.requireAlumni(tenantId, id);
    const reason = dto.reason?.trim() ?? '';
    if (dto.eligibility !== 'eligible' && reason.length < 3) {
      throw new BadRequestException(
        `Give a reason for "${ELIGIBILITY_LABELS[dto.eligibility]}".`,
      );
    }
    const actor: Actor = { type: 'hr', userId: actorUserId };
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.alumni.update({
        where: { id },
        data: {
          eligibility: dto.eligibility,
          eligibilityReason: reason,
          eligibilityUpdatedById: actorUserId,
          eligibilityUpdatedAt: now,
        },
      });
      if (dto.eligibility !== 'eligible') {
        await tx.alumniInvitation.updateMany({
          where: { alumniId: id, acceptedAt: null, revokedAt: null },
          data: {
            revokedAt: now,
            revokeReason: `Eligibility set to ${ELIGIBILITY_LABELS[dto.eligibility]}`,
          },
        });
      }
      if (dto.eligibility === 'do_not_contact') {
        const account = await tx.alumniAccount.findUnique({
          where: { alumniId: id },
        });
        if (account?.status === 'active') {
          await this.support.closeAccount(
            tx,
            account.id,
            'revoked',
            `Do not contact: ${reason}`,
          );
        } else if (account) {
          await tx.alumniAccount.update({
            where: { id: account.id },
            data: { communicationsConsent: false },
          });
        }
        const open = await tx.alumniDocumentRequest.findMany({
          where: { alumniId: id, status: { in: OPEN_REQUEST_STATUSES } },
        });
        for (const request of open) {
          await tx.alumniDocumentRequest.update({
            where: { id: request.id },
            data: {
              status: 'cancelled',
              decisionNote: 'Closed because HR set Do not contact.',
            },
          });
          await this.support.history(
            tx,
            tenantId,
            'document_request',
            request.id,
            request.status,
            'cancelled',
            actor,
            'Do not contact',
          );
        }
        await this.support.audit(
          tx,
          tenantId,
          actor,
          'alumni.access.revoke',
          'Alumni',
          id,
          {
            reason,
            loginClosed: account?.status === 'active',
            documentsBlocked: true,
            communicationsStopped: true,
            cancelledRequests: open.length,
          },
        );
      }
      await this.support.audit(
        tx,
        tenantId,
        actor,
        'alumni.eligibility.update',
        'Alumni',
        id,
        {
          from: alumni.eligibility,
          to: dto.eligibility,
          reason,
        },
      );
    });
    return this.detail(tenantId, id);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async closure(tenantId: string, id: string) {
    const rows = await this.listClosures(tenantId);
    return rows.find((row) => row.id === id)!;
  }

  private checkDates(dates: ClosureDates) {
    const now = today();
    if (dates.lastWorkingDay < dates.joiningDate) {
      throw new BadRequestException(
        'The last working day is before the joining date.',
      );
    }
    if (dates.exitCompletedOn && dates.exitCompletedOn > now) {
      throw new BadRequestException(
        'The exit completion date cannot be in the future.',
      );
    }
    if (dates.exitCompletedOn && dates.exitCompletedOn < dates.joiningDate) {
      throw new BadRequestException(
        'The exit completion date is before the joining date.',
      );
    }
    if (dates.fnfSettledOn && dates.fnfSettledOn > now) {
      throw new BadRequestException(
        'The F&F settlement date cannot be in the future.',
      );
    }
    if (dates.fnfSettledOn && dates.fnfSettledOn < dates.lastWorkingDay) {
      throw new BadRequestException(
        'F&F cannot be settled before the last working day.',
      );
    }
  }

  /** Copies the employee's payslip PDFs into the alumni vault; the Payslip rows are only read. */
  private async copyPayslips(
    tenantId: string,
    alumniId: string,
    employeeId: string,
  ) {
    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId, employeeId },
      orderBy: { month: 'asc' },
    });
    for (const slip of payslips) {
      const storagePath = await this.support.copyIn(
        path.join(PAYSLIP_ROOT, slip.storagePath),
        tenantId,
        alumniId,
        'documents',
        slip.fileName,
      );
      if (!storagePath) {
        this.logger.warn(
          `Payslip ${slip.id} file is missing; not copied to alumni ${alumniId}`,
        );
        continue;
      }
      await this.prisma.alumniDocument.create({
        data: {
          tenantId,
          alumniId,
          type: 'payslip',
          title: slip.label,
          period: slip.month,
          fileName: slip.fileName,
          storagePath,
          source: 'payslip_copy',
        },
      });
    }
  }

  private listView(row: ListRow) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      personalEmail: row.personalEmail,
      designation: row.designation,
      departmentName: row.departmentName,
      locationName: row.locationName,
      joiningDate: day(row.joiningDate),
      lastWorkingDay: day(row.lastWorkingDay),
      tenureMonths: row.tenureMonths,
      tenure: formatTenure(row.tenureMonths),
      eligibility: row.eligibility,
      eligibilityReason: row.eligibilityReason,
      access: accessStatus(row.account, row.invitations[0]),
      loginEmail: row.account?.email ?? null,
      lastLoginAt: row.account?.lastLoginAt?.toISOString() ?? null,
    };
  }
}
