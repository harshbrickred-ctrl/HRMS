import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AlumniApplicationStatus,
  AlumniJob,
  AlumniReferral,
  AlumniReferralStatus,
  AlumniRehire,
  Prisma,
} from '@prisma/client';
import { HrService } from '../hr/hr.service';
import type { CreateEmployeeDto } from '../hr/dto/hr.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { AlumniPrincipal } from './alumni-auth.service';
import {
  OPEN_REFERRAL_STATUSES,
  REHIRE_FROM,
  canMoveApplication,
  canMoveReferral,
  formatTenure,
  rewardProblem,
} from './alumni-rules';
import {
  type Actor,
  type AlumniUpload,
  AlumniSupport,
  RESUME_EXT,
  day,
  dayOrNull,
  isPrismaError,
  normaliseEmail,
  toDay,
  today,
} from './alumni-support.service';
import type {
  ApplicationListQueryDto,
  ApplicationStatusDto,
  CompleteRehireDto,
  JobDto,
  StartRehireDto,
  UpdateJobDto,
  UpdateReferralDto,
} from './dto/alumni-admin.dto';
import type { ApplyDto, ReferralDto } from './dto/alumni-portal.dto';

/** ALM-10 and ALM-11: job board, fast-track rehire and referrals. */
@Injectable()
export class AlumniCareersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AlumniSupport,
    private readonly hr: HrService,
  ) {}

  // ─── HR: jobs ──────────────────────────────────────────────────────────────

  async listJobs(tenantId: string) {
    const rows = await this.prisma.alumniJob.findMany({
      where: { tenantId },
      include: { _count: { select: { applications: true, referrals: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
    return rows.map((row) => ({
      ...this.jobView(row),
      applications: row._count.applications,
      referrals: row._count.referrals,
    }));
  }

  async createJob(tenantId: string, actorUserId: string, dto: JobDto) {
    const row = await this.prisma.alumniJob.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        departmentName: dto.departmentName?.trim() ?? '',
        location: dto.location?.trim() ?? '',
        employmentType: dto.employmentType?.trim() || 'Full-time',
        experience: dto.experience?.trim() ?? '',
        description: dto.description.trim(),
        closesOn: dto.closesOn ? toDay(dto.closesOn) : null,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.job.create',
      'AlumniJob',
      row.id,
    );
    return this.jobView(row);
  }

  async updateJob(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateJobDto,
  ) {
    await this.requireJob(tenantId, id);
    const row = await this.prisma.alumniJob.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        departmentName: dto.departmentName?.trim(),
        location: dto.location?.trim(),
        employmentType: dto.employmentType?.trim(),
        experience: dto.experience?.trim(),
        description: dto.description?.trim(),
        closesOn: dto.closesOn ? toDay(dto.closesOn) : undefined,
        updatedById: actorUserId,
      },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.job.update',
      'AlumniJob',
      id,
    );
    return this.jobView(row);
  }

  async setJobStatus(
    tenantId: string,
    actorUserId: string,
    id: string,
    status: 'draft' | 'open' | 'closed',
  ) {
    const job = await this.requireJob(tenantId, id);
    if (status === 'open' && job.closesOn && job.closesOn < today()) {
      throw new BadRequestException(
        'The closing date has passed. Change it before opening the job.',
      );
    }
    const row = await this.prisma.alumniJob.update({
      where: { id },
      data: {
        status,
        openedAt: status === 'open' ? (job.openedAt ?? new Date()) : undefined,
        updatedById: actorUserId,
      },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      `alumni.job.${status}`,
      'AlumniJob',
      id,
    );
    return this.jobView(row);
  }

  // ─── HR: applications ──────────────────────────────────────────────────────

  async listApplications(tenantId: string, query: ApplicationListQueryDto) {
    const rows = await this.prisma.alumniJobApplication.findMany({
      where: { tenantId, jobId: query.jobId, status: query.status },
      include: {
        job: { select: { id: true, title: true } },
        alumni: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            designation: true,
            departmentName: true,
            tenureMonths: true,
            lastWorkingDay: true,
            eligibility: true,
          },
        },
        rehire: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const history = await this.support.historyFor(
      'job_application',
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      id: row.id,
      job: row.job,
      alumni: {
        id: row.alumni.id,
        fullName: row.alumni.fullName,
        employeeCode: row.alumni.employeeCode,
        designation: row.alumni.designation,
        departmentName: row.alumni.departmentName,
        tenure: formatTenure(row.alumni.tenureMonths),
        lastWorkingDay: day(row.alumni.lastWorkingDay),
        eligibility: row.alumni.eligibility,
      },
      note: row.note,
      status: row.status,
      fastTrack: row.fastTrack,
      hrNote: row.hrNote,
      createdAt: row.createdAt.toISOString(),
      rehire: row.rehire ? this.rehireView(row.rehire) : null,
      history: history.get(row.id) ?? [],
    }));
  }

  async setApplicationStatus(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: ApplicationStatusDto,
  ) {
    const row = await this.prisma.alumniJobApplication.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Application not found.');
    await this.moveApplication(
      this.prisma,
      tenantId,
      row.id,
      row.status,
      dto.status,
      { type: 'hr', userId: actorUserId },
      dto.note?.trim() ?? '',
    );
    return { id, status: dto.status };
  }

  // ─── HR: fast-track rehire (rule 8) ────────────────────────────────────────

  async listRehires(tenantId: string) {
    const rows = await this.prisma.alumniRehire.findMany({
      where: { tenantId },
      include: {
        alumni: { select: { id: true, fullName: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({ ...this.rehireView(row), alumni: row.alumni }));
  }

  /**
   * Starts a rehire from an application, keeping a copy of the previous
   * employment. Nothing is written to the previous Employee row.
   */
  async startRehire(
    tenantId: string,
    actorUserId: string,
    applicationId: string,
    dto: StartRehireDto,
  ) {
    const app = await this.prisma.alumniJobApplication.findFirst({
      where: { id: applicationId, tenantId },
      include: { alumni: true, job: true, rehire: true },
    });
    if (!app) throw new NotFoundException('Application not found.');
    if (!REHIRE_FROM.includes(app.status))
      throw new BadRequestException('This application is already closed.');
    if (app.rehire && app.rehire.status !== 'cancelled') {
      throw new ConflictException(
        'A rehire is already in progress for this application.',
      );
    }
    if (app.alumni.eligibility !== 'eligible')
      throw new BadRequestException('Only eligible alumni can be rehired.');

    const previous = await this.prisma.employee.findFirst({
      where: { id: app.alumni.employeeId, tenantId },
      include: {
        department: true,
        location: true,
        user: { select: { email: true } },
      },
    });
    const departmentId = await this.existingId(
      'department',
      tenantId,
      dto.departmentId ?? app.alumni.departmentId,
    );
    const locationId = await this.existingId(
      'location',
      tenantId,
      dto.locationId ?? previous?.locationId ?? null,
    );
    if (dto.departmentId && !departmentId)
      throw new BadRequestException('Department not found.');
    if (dto.locationId && !locationId)
      throw new BadRequestException('Location not found.');

    const previousEmployment: Prisma.InputJsonObject = {
      employeeId: app.alumni.employeeId,
      employeeCode: app.alumni.employeeCode,
      fullName: app.alumni.fullName,
      designation: app.alumni.designation,
      departmentName: app.alumni.departmentName,
      locationName: app.alumni.locationName,
      joiningDate: day(app.alumni.joiningDate),
      lastWorkingDay: day(app.alumni.lastWorkingDay),
      tenureMonths: app.alumni.tenureMonths,
      previousWorkEmail: previous?.user.email ?? '',
    };
    const data = {
      status: 'initiated' as const,
      designation: dto.designation?.trim() || app.job.title,
      departmentId,
      locationId,
      joiningDate: toDay(dto.joiningDate),
      workEmail: normaliseEmail(dto.workEmail),
      previousEmployment,
      notes: dto.notes?.trim() ?? '',
      createdById: actorUserId,
      completedById: null,
      completedAt: null,
      newEmployeeId: null,
    };
    const actor: Actor = { type: 'hr', userId: actorUserId };
    const rehire = await this.prisma.$transaction(async (tx) => {
      // A cancelled rehire for the same application is reopened rather than duplicated.
      const row = app.rehire
        ? await tx.alumniRehire.update({ where: { id: app.rehire.id }, data })
        : await tx.alumniRehire.create({
            data: {
              ...data,
              tenantId,
              alumniId: app.alumniId,
              applicationId: app.id,
              previousEmployeeId: app.alumni.employeeId,
            },
          });
      await this.support.history(
        tx,
        tenantId,
        'rehire',
        row.id,
        app.rehire?.status ?? '',
        'initiated',
        actor,
      );
      await this.support.audit(
        tx,
        tenantId,
        actor,
        'alumni.rehire.start',
        'AlumniRehire',
        row.id,
        {
          applicationId: app.id,
          previousEmployeeId: app.alumni.employeeId,
        },
      );
      return row;
    });
    return this.rehireView(rehire);
  }

  /**
   * Creates the NEW employment through the existing HrService.createEmployee
   * (login, roles, leave balances, default shift). The previous Employee row and
   * all its history stay exactly as they were.
   */
  async completeRehire(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: CompleteRehireDto,
  ) {
    const rehire = await this.prisma.alumniRehire.findFirst({
      where: { id, tenantId },
      include: { alumni: true, application: true },
    });
    if (!rehire) throw new NotFoundException('Rehire not found.');
    if (rehire.status !== 'initiated')
      throw new BadRequestException('This rehire is not in progress.');

    const previous = await this.prisma.employee.findFirst({
      where: { id: rehire.previousEmployeeId, tenantId },
      select: { firstName: true, lastName: true },
    });
    const [firstFromAlumni, ...rest] = rehire.alumni.fullName.split(' ');
    const input: CreateEmployeeDto = {
      firstName: previous?.firstName ?? firstFromAlumni,
      lastName: previous?.lastName ?? (rest.join(' ') || firstFromAlumni),
      email: rehire.workEmail,
      password: dto.password,
      designation: rehire.designation,
      roleCodes: dto.roleCodes,
      departmentId: rehire.departmentId ?? undefined,
      locationId: rehire.locationId ?? undefined,
      teamId: dto.teamId,
      managerId: dto.managerId,
      status: 'ACTIVE',
    };
    const created = await this.hr.createEmployee(tenantId, actorUserId, input);

    const actor: Actor = { type: 'hr', userId: actorUserId };
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.alumniRehire.update({
        where: { id },
        data: {
          status: 'completed',
          newEmployeeId: created.id,
          completedById: actorUserId,
          completedAt: new Date(),
        },
      });
      await this.support.history(
        tx,
        tenantId,
        'rehire',
        id,
        'initiated',
        'completed',
        actor,
        `New employee ${created.employeeCode}`,
      );
      if (rehire.application && rehire.application.status !== 'rehired') {
        // A rehire can start before a formal offer; completing it closes the application as rehired.
        await tx.alumniJobApplication.update({
          where: { id: rehire.application.id },
          data: { status: 'rehired' },
        });
        await this.support.history(
          tx,
          tenantId,
          'job_application',
          rehire.application.id,
          rehire.application.status,
          'rehired',
          actor,
          'Rehired',
        );
      }
      await this.support.audit(
        tx,
        tenantId,
        actor,
        'alumni.rehire.complete',
        'AlumniRehire',
        id,
        {
          previousEmployeeId: rehire.previousEmployeeId,
          newEmployeeId: created.id,
          newEmployeeCode: created.employeeCode,
        },
      );
      return row;
    });
    return {
      ...this.rehireView(updated),
      newEmployeeCode: created.employeeCode,
    };
  }

  async cancelRehire(
    tenantId: string,
    actorUserId: string,
    id: string,
    note: string,
  ) {
    const rehire = await this.prisma.alumniRehire.findFirst({
      where: { id, tenantId },
    });
    if (!rehire) throw new NotFoundException('Rehire not found.');
    if (rehire.status !== 'initiated')
      throw new BadRequestException(
        'Only a rehire in progress can be cancelled.',
      );
    const actor: Actor = { type: 'hr', userId: actorUserId };
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.alumniRehire.update({
        where: { id },
        data: { status: 'cancelled' },
      });
      await this.support.history(
        tx,
        tenantId,
        'rehire',
        id,
        'initiated',
        'cancelled',
        actor,
        note,
      );
      await this.support.audit(
        tx,
        tenantId,
        actor,
        'alumni.rehire.cancel',
        'AlumniRehire',
        id,
      );
      return updated;
    });
    return this.rehireView(row);
  }

  // ─── HR: referrals ─────────────────────────────────────────────────────────

  async listReferrals(tenantId: string, status?: AlumniReferralStatus) {
    const rows = await this.prisma.alumniReferral.findMany({
      where: { tenantId, status },
      include: {
        alumni: { select: { id: true, fullName: true, employeeCode: true } },
        job: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const history = await this.support.historyFor(
      'referral',
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...this.referralView(row),
      alumni: row.alumni,
      candidatePhone: row.candidatePhone,
      resumeFileName: row.resumeFileName,
      hrNote: row.hrNote,
      rewardReference: row.rewardReference,
      history: history.get(row.id) ?? [],
    }));
  }

  async updateReferral(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateReferralDto,
  ) {
    const row = await this.prisma.alumniReferral.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Referral not found.');
    const status = dto.status ?? row.status;
    if (!canMoveReferral(row.status, status)) {
      throw new BadRequestException(
        `A ${row.status} referral cannot become ${status}.`,
      );
    }
    const rewardAmount =
      dto.rewardAmount ?? (row.rewardAmount ? Number(row.rewardAmount) : null);
    const rewardStatus = dto.rewardStatus ?? row.rewardStatus;
    const rewardPaidOn = dto.rewardPaidOn
      ? toDay(dto.rewardPaidOn)
      : row.rewardPaidOn;
    const problem = rewardProblem({
      status,
      rewardStatus,
      rewardAmount,
      rewardPaidOn,
    });
    if (problem) throw new BadRequestException(problem);

    const actor: Actor = { type: 'hr', userId: actorUserId };
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.alumniReferral.update({
        where: { id },
        data: {
          status,
          hrNote: dto.hrNote?.trim(),
          rewardAmount: dto.rewardAmount,
          rewardCurrency: dto.rewardCurrency,
          rewardStatus,
          rewardPaidOn,
          rewardReference: dto.rewardReference?.trim(),
          updatedById: actorUserId,
        },
        include: { job: { select: { id: true, title: true } } },
      });
      if (status !== row.status) {
        await this.support.history(
          tx,
          tenantId,
          'referral',
          id,
          row.status,
          status,
          actor,
          dto.hrNote?.trim() ?? '',
        );
      }
      await this.support.audit(
        tx,
        tenantId,
        actor,
        'alumni.referral.update',
        'AlumniReferral',
        id,
        {
          from: row.status,
          to: status,
          rewardStatus,
          rewardAmount,
        },
      );
      return saved;
    });
    return this.referralView(updated);
  }

  async openResumeForHr(tenantId: string, id: string) {
    const row = await this.prisma.alumniReferral.findFirst({
      where: { id, tenantId },
    });
    if (!row?.resumePath) throw new NotFoundException('No CV attached.');
    return {
      stream: await this.support.open(row.resumePath),
      fileName: row.resumeFileName,
    };
  }

  // ─── Alumnus: jobs and applications ────────────────────────────────────────

  async openJobs(principal: AlumniPrincipal) {
    const rows = await this.prisma.alumniJob.findMany({
      where: {
        tenantId: principal.tenantId,
        status: 'open',
        OR: [{ closesOn: null }, { closesOn: { gte: today() } }],
      },
      include: {
        applications: {
          where: { alumniId: principal.alumniId },
          select: { id: true, status: true },
        },
      },
      orderBy: { openedAt: 'desc' },
    });
    return rows.map((row) => ({
      ...this.jobView(row),
      myApplication: row.applications[0] ?? null,
    }));
  }

  /** Eligible alumni are fast-tracked: they skip screening and start as shortlisted. */
  async apply(principal: AlumniPrincipal, jobId: string, dto: ApplyDto) {
    const job = await this.prisma.alumniJob.findFirst({
      where: { id: jobId, tenantId: principal.tenantId, status: 'open' },
    });
    if (!job || (job.closesOn && job.closesOn < today()))
      throw new NotFoundException('This job is not open.');
    const actor: Actor = { type: 'alumni', alumniId: principal.alumniId };
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.alumniJobApplication.create({
          data: {
            tenantId: principal.tenantId,
            jobId,
            alumniId: principal.alumniId,
            note: dto.note?.trim() ?? '',
            status: 'shortlisted',
            fastTrack: true,
          },
        });
        await this.support.history(
          tx,
          principal.tenantId,
          'job_application',
          created.id,
          '',
          'shortlisted',
          actor,
          'Fast-tracked: former employee eligible for rehire',
        );
        await this.support.audit(
          tx,
          principal.tenantId,
          actor,
          'alumni.job.apply',
          'AlumniJobApplication',
          created.id,
          { jobId },
        );
        return created;
      });
      return {
        id: row.id,
        jobId,
        status: row.status,
        fastTrack: row.fastTrack,
      };
    } catch (error) {
      if (isPrismaError(error, 'P2002'))
        throw new ConflictException('You have already applied for this job.');
      throw error;
    }
  }

  async myApplications(principal: AlumniPrincipal) {
    const rows = await this.prisma.alumniJobApplication.findMany({
      where: { alumniId: principal.alumniId, tenantId: principal.tenantId },
      include: { job: { select: { id: true, title: true, location: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const history = await this.support.historyFor(
      'job_application',
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      id: row.id,
      job: row.job,
      status: row.status,
      fastTrack: row.fastTrack,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      // HR's private notes are not shown to the alumnus.
      history: (history.get(row.id) ?? []).map(
        ({ note: _note, ...step }) => step,
      ),
    }));
  }

  async withdraw(principal: AlumniPrincipal, id: string) {
    const row = await this.prisma.alumniJobApplication.findFirst({
      where: { id, alumniId: principal.alumniId, tenantId: principal.tenantId },
    });
    if (!row) throw new NotFoundException('Application not found.');
    await this.moveApplication(
      this.prisma,
      principal.tenantId,
      row.id,
      row.status,
      'withdrawn',
      {
        type: 'alumni',
        alumniId: principal.alumniId,
      },
    );
    return { id, status: 'withdrawn' };
  }

  // ─── Alumnus: referrals ────────────────────────────────────────────────────

  async myReferrals(principal: AlumniPrincipal) {
    const rows = await this.prisma.alumniReferral.findMany({
      where: { alumniId: principal.alumniId, tenantId: principal.tenantId },
      include: { job: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.referralView(row));
  }

  async refer(
    principal: AlumniPrincipal,
    dto: ReferralDto,
    file: AlumniUpload | undefined,
  ) {
    const candidateEmail = normaliseEmail(dto.candidateEmail);
    if (dto.jobId) {
      const job = await this.prisma.alumniJob.findFirst({
        where: { id: dto.jobId, tenantId: principal.tenantId, status: 'open' },
      });
      if (!job) throw new BadRequestException('That job is not open.');
    }
    const duplicate = await this.prisma.alumniReferral.findFirst({
      where: {
        tenantId: principal.tenantId,
        candidateEmail,
        status: { in: [...OPEN_REFERRAL_STATUSES, 'hired'] },
      },
    });
    if (duplicate)
      throw new ConflictException('This candidate has already been referred.');
    const resume = file?.buffer?.length
      ? await this.support.saveFile(
          principal.tenantId,
          principal.alumniId,
          'referrals',
          file,
          RESUME_EXT,
        )
      : null;
    const actor: Actor = { type: 'alumni', alumniId: principal.alumniId };
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.alumniReferral.create({
        data: {
          tenantId: principal.tenantId,
          alumniId: principal.alumniId,
          jobId: dto.jobId || null,
          candidateName: dto.candidateName.trim(),
          candidateEmail,
          candidatePhone: dto.candidatePhone?.trim() ?? '',
          relationship: dto.relationship?.trim() ?? '',
          note: dto.note?.trim() ?? '',
          resumeFileName: resume?.fileName ?? '',
          resumePath: resume?.storagePath ?? '',
        },
        include: { job: { select: { id: true, title: true } } },
      });
      await this.support.history(
        tx,
        principal.tenantId,
        'referral',
        created.id,
        '',
        'submitted',
        actor,
      );
      await this.support.audit(
        tx,
        principal.tenantId,
        actor,
        'alumni.referral.create',
        'AlumniReferral',
        created.id,
        {
          jobId: created.jobId,
        },
      );
      return created;
    });
    return this.referralView(row);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async moveApplication(
    db: Parameters<AlumniSupport['history']>[0],
    tenantId: string,
    id: string,
    from: AlumniApplicationStatus,
    to: AlumniApplicationStatus,
    actor: Actor,
    note = '',
  ) {
    if (!canMoveApplication(from, to)) {
      throw new BadRequestException(
        `A ${from} application cannot become ${to}.`,
      );
    }
    const { count } = await db.alumniJobApplication.updateMany({
      where: { id, status: from },
      data: {
        status: to,
        ...(actor.type === 'hr' && note ? { hrNote: note } : {}),
      },
    });
    if (count !== 1)
      throw new ConflictException(
        'This application was just updated. Refresh and try again.',
      );
    await this.support.history(
      db,
      tenantId,
      'job_application',
      id,
      from,
      to,
      actor,
      note,
    );
  }

  private async existingId(
    kind: 'department' | 'location',
    tenantId: string,
    id: string | null,
  ) {
    if (!id) return null;
    const row =
      kind === 'department'
        ? await this.prisma.department.findFirst({
            where: { id, tenantId },
            select: { id: true },
          })
        : await this.prisma.location.findFirst({
            where: { id, tenantId },
            select: { id: true },
          });
    return row?.id ?? null;
  }

  private async requireJob(tenantId: string, id: string) {
    const job = await this.prisma.alumniJob.findFirst({
      where: { id, tenantId },
    });
    if (!job) throw new NotFoundException('Job not found.');
    return job;
  }

  private jobView(row: AlumniJob) {
    return {
      id: row.id,
      title: row.title,
      departmentName: row.departmentName,
      location: row.location,
      employmentType: row.employmentType,
      experience: row.experience,
      description: row.description,
      status: row.status,
      openedAt: row.openedAt?.toISOString() ?? null,
      closesOn: dayOrNull(row.closesOn),
    };
  }

  private rehireView(row: AlumniRehire) {
    return {
      id: row.id,
      alumniId: row.alumniId,
      applicationId: row.applicationId,
      status: row.status,
      designation: row.designation,
      departmentId: row.departmentId,
      locationId: row.locationId,
      joiningDate: day(row.joiningDate),
      workEmail: row.workEmail,
      previousEmployment: row.previousEmployment,
      previousEmployeeId: row.previousEmployeeId,
      newEmployeeId: row.newEmployeeId,
      notes: row.notes,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private referralView(
    row: AlumniReferral & { job?: { id: string; title: string } | null },
  ) {
    return {
      id: row.id,
      job: row.job ?? null,
      candidateName: row.candidateName,
      candidateEmail: row.candidateEmail,
      relationship: row.relationship,
      note: row.note,
      hasResume: Boolean(row.resumePath),
      status: row.status,
      rewardAmount: row.rewardAmount ? Number(row.rewardAmount) : null,
      rewardCurrency: row.rewardCurrency,
      rewardStatus: row.rewardStatus,
      rewardPaidOn: dayOrNull(row.rewardPaidOn),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
