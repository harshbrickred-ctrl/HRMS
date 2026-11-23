import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  CreateCycleDto,
  DecisionDto,
  HrReviewDto,
  ManagerReviewDto,
  RevisionDto,
  SaveSelfAppraisalDto,
  SetCycleKpisDto,
} from './dto/appraisal.dto';

type Status =
  | 'Draft'
  | 'Self_Appraisal_Pending'
  | 'Submitted'
  | 'Manager_Review_Pending'
  | 'Manager_Approved'
  | 'HR_Review_Pending'
  | 'HR_Approved'
  | 'Management_Approval_Pending'
  | 'Completed'
  | 'Rejected'
  | 'Revision_Requested';

@Injectable()
export class AppraisalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createCycle(tenantId: string, userId: string, dto: CreateCycleDto) {
    if (dto.periodEnd < dto.periodStart || dto.selfDeadline < dto.selfStart || dto.reviewDeadline < dto.selfDeadline) {
      throw new BadRequestException('Cycle dates must be in chronological order.');
    }
    return this.prisma.appraisalCycle.create({
      data: {
        tenantId,
        createdById: userId,
        name: dto.name.trim(),
        periodStart: this.date(dto.periodStart),
        periodEnd: this.date(dto.periodEnd),
        selfStart: this.date(dto.selfStart),
        selfDeadline: this.date(dto.selfDeadline),
        reviewDeadline: this.date(dto.reviewDeadline),
      },
      include: { kpis: true },
    });
  }

  async listCycles(tenantId: string) {
    return this.prisma.appraisalCycle.findMany({
      where: { tenantId },
      include: { _count: { select: { appraisals: true } }, kpis: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setCycleKpis(tenantId: string, cycleId: string, dto: SetCycleKpisDto) {
    const cycle = await this.prisma.appraisalCycle.findFirst({ where: { id: cycleId, tenantId } });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found.');
    if (cycle.status !== 'Draft') throw new ConflictException('KPIs can only be changed before a cycle is launched.');
    const weight = dto.kpis.reduce((total, kpi) => total + kpi.weight, 0);
    if (Math.abs(weight - 100) > 0.01) throw new BadRequestException('KPI weights must total 100.');
    await this.prisma.$transaction(async (tx) => {
      await tx.cycleKpi.deleteMany({ where: { cycleId } });
      await tx.cycleKpi.createMany({
        data: dto.kpis.map((kpi, index) => ({
          cycleId,
          title: kpi.title.trim(),
          description: kpi.description ?? '',
          category: kpi.category ?? 'Performance',
          weight: kpi.weight,
          required: kpi.required ?? true,
          sortOrder: kpi.sortOrder ?? index,
        })),
      });
    });
    return this.prisma.cycleKpi.findMany({ where: { cycleId }, orderBy: { sortOrder: 'asc' } });
  }

  async launchCycle(tenantId: string, userId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: { kpis: true, _count: { select: { appraisals: true } } },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found.');
    if (cycle.status !== 'Draft') throw new ConflictException('This cycle has already been launched.');
    if (!cycle.kpis.length) throw new BadRequestException('Add at least one KPI before launching the cycle.');
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      include: { user: { select: { id: true } } },
      orderBy: { employeeCode: 'asc' },
    });
    if (!employees.length) throw new BadRequestException('There are no employees to include in this cycle.');
    await this.prisma.$transaction(async (tx) => {
      await tx.appraisalCycle.update({ where: { id: cycleId }, data: { status: 'Active' } });
      await tx.employeeAppraisal.createMany({
        data: employees.map((employee) => ({
          tenantId,
          cycleId,
          employeeId: employee.id,
          managerEmployeeId: employee.managerId,
          status: 'Self_Appraisal_Pending' as const,
        })),
      });
      for (const employee of employees) {
        const appraisal = await tx.employeeAppraisal.findUniqueOrThrow({
          where: { cycleId_employeeId: { cycleId, employeeId: employee.id } },
        });
        await tx.appraisalKpiResponse.createMany({
          data: cycle.kpis.map((kpi) => ({ appraisalId: appraisal.id, cycleKpiId: kpi.id })),
        });
        await tx.appraisalReview.create({
          data: {
            appraisalId: appraisal.id,
            actorUserId: userId,
            stage: 'system',
            action: 'cycle_initiated',
            fromStatus: 'Draft',
            toStatus: 'Self_Appraisal_Pending',
          },
        });
      }
    });
    for (const employee of employees) {
      await this.notify(tenantId, employee.userId, 'Self-appraisal pending', `${cycle.name} is open. Please submit your self-appraisal by ${cycle.selfDeadline.toISOString().slice(0, 10)}.`, '/ess/appraisals');
    }
    await this.audit(tenantId, userId, 'appraisal.cycle.launch', cycleId, { employeeCount: employees.length });
    return { cycleId, status: 'Active', employeeCount: employees.length };
  }

  async closeCycle(tenantId: string, userId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({ where: { id: cycleId, tenantId } });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found.');
    if (cycle.status !== 'Active') throw new ConflictException('Only active cycles can be closed.');
    const pending = await this.prisma.employeeAppraisal.count({
      where: { cycleId, status: { notIn: ['Completed', 'Rejected'] } },
    });
    if (pending) throw new ConflictException(`${pending} appraisal(s) still need review before this cycle can be closed.`);
    await this.prisma.appraisalCycle.update({ where: { id: cycleId }, data: { status: 'Closed' } });
    await this.audit(tenantId, userId, 'appraisal.cycle.close', cycleId, {});
    return { cycleId, status: 'Closed' };
  }

  async mine(userId: string, tenantId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { userId, tenantId } });
    if (!employee) return { current: [], previous: [] };
    const rows = await this.prisma.employeeAppraisal.findMany({
      where: { tenantId, employeeId: employee.id },
      include: { cycle: { include: { kpis: { orderBy: { sortOrder: 'asc' } } } }, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      current: rows.filter((row) => row.cycle.status === 'Active').map((row) => this.employeeView(row)),
      previous: rows.filter((row) => row.cycle.status !== 'Active').map((row) => this.employeeView(row)),
    };
  }

  async getMine(userId: string, tenantId: string, id: string) {
    const row = await this.prisma.employeeAppraisal.findFirst({
      where: { id, tenantId, employee: { userId } },
      include: { cycle: { include: { kpis: { orderBy: { sortOrder: 'asc' } } } }, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Appraisal not found.');
    return this.employeeView(row);
  }

  async saveSelf(userId: string, tenantId: string, id: string, dto: SaveSelfAppraisalDto) {
    const row = await this.ownedAppraisal(userId, tenantId, id);
    if (!['Self_Appraisal_Pending', 'Revision_Requested'].includes(row.status)) {
      throw new ConflictException('Submitted appraisals can only be changed after a revision request.');
    }
    const cycle = await this.prisma.appraisalCycle.findUniqueOrThrow({ where: { id: row.cycleId } });
    if (cycle.status !== 'Active') throw new ConflictException('This appraisal cycle is not active.');
    if (row.status !== 'Revision_Requested') {
      const today = this.todayIndia();
      const start = cycle.selfStart.toISOString().slice(0, 10);
      const deadline = cycle.selfDeadline.toISOString().slice(0, 10);
      if (today < start || today > deadline) throw new ConflictException('Self-appraisal is outside the submission window.');
    }
    const responses = dto.kpis ?? [];
    const allowed = new Set((await this.prisma.cycleKpi.findMany({ where: { cycleId: row.cycleId }, select: { id: true } })).map((item) => item.id));
    if (responses.some((item) => !allowed.has(item.cycleKpiId))) throw new BadRequestException('An appraisal response contains a KPI outside this cycle.');
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeAppraisal.update({
        where: { id },
        data: {
          ...(dto.goals !== undefined ? { goals: dto.goals as object[] } : {}),
          ...(dto.achievements !== undefined ? { achievements: dto.achievements as object[] } : {}),
          ...(dto.selfFeedback !== undefined ? { selfFeedback: dto.selfFeedback } : {}),
        },
      });
      for (const item of responses) {
        await tx.appraisalKpiResponse.upsert({
          where: { appraisalId_cycleKpiId: { appraisalId: id, cycleKpiId: item.cycleKpiId } },
          create: { appraisalId: id, cycleKpiId: item.cycleKpiId, selfRating: item.selfRating, selfComment: item.selfComment ?? '' },
          update: { selfRating: item.selfRating, selfComment: item.selfComment ?? '' },
        });
      }
      await tx.appraisalReview.create({
        data: {
          appraisalId: id,
          actorUserId: userId,
          stage: 'employee',
          action: 'self_saved',
          fromStatus: row.status,
          toStatus: row.status,
          comment: dto.selfFeedback ?? '',
          changes: { ratings: responses.map((item) => ({ cycleKpiId: item.cycleKpiId, rating: item.selfRating, comment: item.selfComment ?? '' })) },
        },
      });
    });
    return this.getMine(userId, tenantId, id);
  }

  async submitSelf(userId: string, tenantId: string, id: string) {
    const row = await this.ownedAppraisal(userId, tenantId, id);
    if (!['Self_Appraisal_Pending', 'Revision_Requested'].includes(row.status)) throw new ConflictException('This appraisal cannot be submitted in its current status.');
    if (row.status !== 'Revision_Requested') {
      const cycle = await this.prisma.appraisalCycle.findUniqueOrThrow({ where: { id: row.cycleId } });
      const today = this.todayIndia();
      if (today < cycle.selfStart.toISOString().slice(0, 10) || today > cycle.selfDeadline.toISOString().slice(0, 10)) {
        throw new ConflictException('Self-appraisal is outside the submission window.');
      }
    }
    const responses = await this.prisma.appraisalKpiResponse.findMany({ where: { appraisalId: id }, include: { cycleKpi: true } });
    if (responses.some((response) => response.cycleKpi.required && response.selfRating == null)) {
      throw new BadRequestException('Complete every required KPI rating before submitting.');
    }
    if (row.status === 'Revision_Requested' && row.revisionReturnStage === 'hr') {
      const result = await this.move(tenantId, userId, row, 'HR_Review_Pending', 'employee', 'revision_resubmitted', 'HR review resumed after employee revision.', { revisionReturnStage: '' });
      await this.notifyRole(tenantId, ['HR_EXEC', 'HR_HEAD'], 'HR review pending', 'An employee resubmitted an appraisal after HR requested clarification.', '/hr/appraisals');
      return result;
    }
    const oldStatus = row.status;
    const nextStatus: Status = row.managerEmployeeId ? 'Manager_Review_Pending' : 'HR_Review_Pending';
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employeeAppraisal.updateMany({
        where: { id, status: oldStatus },
        data: { status: nextStatus as never, submittedAt: new Date(), revisionReturnStage: '' },
      });
      if (!result.count) throw new ConflictException('This appraisal was updated by another reviewer. Refresh and try again.');
      await tx.appraisalReview.create({ data: { appraisalId: id, actorUserId: userId, stage: 'employee', action: 'submitted', fromStatus: oldStatus, toStatus: 'Submitted' } });
      await tx.appraisalReview.create({
        data: {
          appraisalId: id,
          actorUserId: userId,
          stage: 'system',
          action: row.managerEmployeeId ? 'routed_to_manager' : 'routed_to_hr_no_reporting_manager',
          fromStatus: 'Submitted',
          toStatus: nextStatus,
        },
      });
      return tx.employeeAppraisal.findUniqueOrThrow({ where: { id }, include: { employee: true, manager: true, cycle: true } });
    });
    const manager = updated.managerEmployeeId ? await this.prisma.employee.findUnique({ where: { id: updated.managerEmployeeId }, select: { userId: true } }) : null;
    if (manager?.userId) {
      await this.notify(tenantId, manager.userId, 'Manager review pending', `${updated.employee.firstName} ${updated.employee.lastName} submitted a self-appraisal for ${updated.cycle.name}.`, '/manager/appraisals');
    } else {
      await this.notifyRole(tenantId, ['HR_EXEC', 'HR_HEAD'], 'HR review pending', `${updated.employee.firstName} ${updated.employee.lastName} submitted an appraisal without an assigned reporting manager.`, '/hr/appraisals');
    }
    await this.audit(tenantId, userId, 'appraisal.self.submit', id, {});
    return { id, status: updated.status };
  }

  async managerQueue(userId: string, tenantId: string) {
    const manager = await this.employeeByUser(userId, tenantId);
    const rows = await this.prisma.employeeAppraisal.findMany({
      where: { tenantId, managerEmployeeId: manager.id },
      include: { employee: { include: { department: true } }, cycle: true, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.managerView(row));
  }

  async managerReview(userId: string, tenantId: string, id: string, dto: ManagerReviewDto) {
    const manager = await this.employeeByUser(userId, tenantId);
    const row = await this.prisma.employeeAppraisal.findFirst({ where: { id, tenantId }, include: { kpiResponses: true } });
    if (!row) throw new NotFoundException('Appraisal not found.');
    if (row.employeeId === manager.id) throw new ForbiddenException('You cannot review your own appraisal.');
    if (row.managerEmployeeId !== manager.id) throw new ForbiddenException('This appraisal is not assigned to you.');
    if (row.status !== 'Manager_Review_Pending') throw new ConflictException('This appraisal is not awaiting manager review.');
    const kpiIds = new Set(row.kpiResponses.map((response) => response.cycleKpiId));
    if (dto.kpis.some((response) => !kpiIds.has(response.cycleKpiId))) throw new BadRequestException('A rating references a KPI outside this appraisal.');
    const submittedRatings = new Set(dto.kpis.map((response) => response.cycleKpiId));
    const required = await this.prisma.cycleKpi.findMany({ where: { cycleId: row.cycleId, required: true }, select: { id: true } });
    if (required.some((kpi) => !submittedRatings.has(kpi.id))) throw new BadRequestException('Rate every required KPI before saving the manager review.');
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.employeeAppraisal.updateMany({ where: { id, status: 'Manager_Review_Pending' }, data: { managerFeedback: dto.feedback, managerStrengths: dto.strengths, managerImprovementAreas: dto.improvementAreas, managerRating: dto.rating } });
      if (!current.count) throw new ConflictException('This appraisal was updated by another reviewer.');
      for (const response of dto.kpis) {
        await tx.appraisalKpiResponse.update({
          where: { appraisalId_cycleKpiId: { appraisalId: id, cycleKpiId: response.cycleKpiId } },
          data: { managerRating: response.managerRating, managerComment: response.managerComment ?? '' },
        });
      }
      await tx.appraisalReview.create({
        data: { appraisalId: id, actorUserId: userId, stage: 'manager', action: 'review_saved', fromStatus: row.status, toStatus: row.status, comment: dto.comment ?? dto.feedback, changes: { rating: dto.rating, kpiRatings: dto.kpis.map((item) => ({ cycleKpiId: item.cycleKpiId, rating: item.managerRating, comment: item.managerComment ?? '' })), strengths: dto.strengths, improvementAreas: dto.improvementAreas } },
      });
    });
    return { id, status: row.status };
  }

  async managerApprove(userId: string, tenantId: string, id: string, dto: DecisionDto) {
    const row = await this.requireManagerPending(userId, tenantId, id);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeAppraisal.updateMany({ where: { id, tenantId, status: 'Manager_Review_Pending' }, data: { status: 'HR_Review_Pending' } });
      if (!changed.count) throw new ConflictException('This appraisal was updated by another reviewer. Refresh and try again.');
      await tx.appraisalReview.create({ data: { appraisalId: id, actorUserId: userId, stage: 'manager', action: 'approved', fromStatus: 'Manager_Review_Pending', toStatus: 'Manager_Approved', comment: dto.comment ?? '' } });
      await tx.appraisalReview.create({ data: { appraisalId: id, actorUserId: userId, stage: 'system', action: 'routed_to_hr', fromStatus: 'Manager_Approved', toStatus: 'HR_Review_Pending' } });
      await tx.auditEvent.create({ data: { tenantId, actorUserId: userId, action: 'appraisal.manager.approve', entityType: 'EmployeeAppraisal', entityId: id, metadata: { fromStatus: 'Manager_Review_Pending', toStatus: 'HR_Review_Pending' } } });
    });
    const result = { id, status: 'HR_Review_Pending' };
    const employee = await this.prisma.employee.findUnique({ where: { id: row.employeeId }, select: { firstName: true, lastName: true } });
    await this.notifyEmployee(tenantId, row.employeeId, 'Manager approved your appraisal', 'Your self-appraisal has been sent to HR for review.', `/ess/appraisals/${id}`);
    await this.notifyRole(tenantId, ['HR_EXEC', 'HR_HEAD'], 'HR review pending', `${employee?.firstName ?? 'An employee'} ${employee?.lastName ?? ''} has manager-approved appraisal awaiting HR review.`, '/hr/appraisals');
    return result;
  }

  async managerReturn(userId: string, tenantId: string, id: string, dto: RevisionDto) {
    const row = await this.requireManagerPending(userId, tenantId, id);
    const result = await this.returnForRevision(tenantId, userId, row, 'manager', 'manager', dto.comment);
    const employee = await this.prisma.employee.findUnique({ where: { id: row.employeeId }, select: { userId: true } });
    await this.notify(tenantId, employee?.userId, 'Appraisal revision requested', dto.comment, `/ess/appraisals/${id}`);
    return result;
  }

  async hrQueue(tenantId: string, canSeeSensitive: boolean) {
    const rows = await this.prisma.employeeAppraisal.findMany({
      where: { tenantId, status: { in: ['HR_Review_Pending', 'HR_Approved', 'Management_Approval_Pending', 'Completed', 'Rejected'] } },
      include: { employee: { include: { department: true } }, cycle: true, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.hrView(row, canSeeSensitive));
  }

  async adminQueue(tenantId: string) {
    const rows = await this.prisma.employeeAppraisal.findMany({
      where: { tenantId },
      include: { employee: { include: { department: true, manager: true } }, cycle: true, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => {
      const view = this.hrView(row, false);
      const { finalRating: _finalRating, ...publicView } = view;
      return {
        ...publicView,
        history: row.reviews.map((review) => ({
          stage: review.stage,
          action: review.action,
          fromStatus: review.fromStatus,
          status: review.toStatus,
          createdAt: review.createdAt,
        })),
      };
    });
  }

  async adminDetail(tenantId: string, id: string) {
    const row: any = await this.findAppraisal(tenantId, id, {
      employee: { include: { department: true, manager: true } },
      cycle: true,
      kpiResponses: { include: { cycleKpi: true } },
      reviews: { include: { actor: { select: { email: true } } }, orderBy: { createdAt: 'asc' } },
    });
    const view = this.hrView(row, false);
    const { finalRating: _finalRating, ...publicView } = view;
    return {
      ...publicView,
      history: row.reviews.map((review: any) => ({ stage: review.stage, action: review.action, fromStatus: review.fromStatus, status: review.toStatus, comment: review.comment, actor: review.actor?.email, createdAt: review.createdAt })),
    };
  }

  async hrApprove(userId: string, tenantId: string, id: string, dto: HrReviewDto) {
    const row = await this.findAppraisal(tenantId, id);
    await this.assertNotSubject(userId, tenantId, row.employeeId);
    if (row.status !== 'HR_Review_Pending') throw new ConflictException('This appraisal is not awaiting HR review.');
    const fromStatus = row.status;
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeAppraisal.updateMany({
        where: { id, status: fromStatus },
        data: {
          status: 'Management_Approval_Pending',
          hrFeedback: dto.feedback,
          hrRating: dto.rating,
          promotionRecommendation: dto.promotionRecommendation ?? '',
          salaryIncreasePercent: dto.salaryIncreasePercent,
          salaryIncreaseAmount: dto.salaryIncreaseAmount,
          revisionReturnStage: '',
        },
      });
      if (!changed.count) throw new ConflictException('This appraisal was updated by another reviewer.');
      await tx.appraisalReview.create({ data: { appraisalId: id, actorUserId: userId, stage: 'hr', action: 'approved', fromStatus, toStatus: 'HR_Approved', comment: dto.comment ?? dto.feedback, changes: { rating: dto.rating, feedback: dto.feedback, promotionRecommendation: dto.promotionRecommendation ?? '', salaryIncreasePercent: dto.salaryIncreasePercent ?? null, salaryIncreaseAmount: dto.salaryIncreaseAmount ?? null } } });
      await tx.appraisalReview.create({ data: { appraisalId: id, actorUserId: userId, stage: 'system', action: 'routed_to_management', fromStatus: 'HR_Approved', toStatus: 'Management_Approval_Pending' } });
      await tx.auditEvent.create({ data: { tenantId, actorUserId: userId, action: 'appraisal.hr.approve', entityType: 'EmployeeAppraisal', entityId: id, metadata: { fromStatus, toStatus: 'Management_Approval_Pending' } } });
    });
    await this.notifyRole(tenantId, ['MANAGEMENT_APPROVER'], 'Final appraisal approval pending', 'An HR-approved appraisal is awaiting management review.', '/management/appraisals');
    await this.notifyEmployee(tenantId, row.employeeId, 'HR approved your appraisal', 'Your appraisal has moved to final management approval.', `/ess/appraisals/${id}`);
    return { id, status: 'Management_Approval_Pending' };
  }

  async hrReturn(userId: string, tenantId: string, id: string, dto: RevisionDto) {
    const row = await this.findAppraisal(tenantId, id);
    await this.assertNotSubject(userId, tenantId, row.employeeId);
    if (row.status !== 'HR_Review_Pending') throw new ConflictException('This appraisal is not awaiting HR review.');
    const result = await this.returnForRevision(tenantId, userId, row, 'hr', 'hr', dto.comment);
    const employee = await this.prisma.employee.findUnique({ where: { id: row.employeeId }, select: { userId: true } });
    await this.notify(tenantId, employee?.userId, 'Appraisal clarification requested', dto.comment, `/ess/appraisals/${id}`);
    return result;
  }

  async hrReject(userId: string, tenantId: string, id: string, dto: DecisionDto) {
    const row = await this.findAppraisal(tenantId, id);
    await this.assertNotSubject(userId, tenantId, row.employeeId);
    if (row.status !== 'HR_Review_Pending') throw new ConflictException('This appraisal is not awaiting HR review.');
    const result = await this.move(tenantId, userId, row, 'Rejected', 'hr', 'rejected', dto.comment ?? '');
    await this.notifyEmployee(tenantId, row.employeeId, 'Appraisal rejected', dto.comment ?? 'Your appraisal was rejected during HR review.', `/ess/appraisals/${id}`);
    return result;
  }

  async managementQueue(tenantId: string, canSeeSensitive: boolean) {
    const rows = await this.prisma.employeeAppraisal.findMany({
      where: { tenantId, status: 'Management_Approval_Pending' },
      include: { employee: { include: { department: true } }, cycle: true, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'asc' },
    });
    return rows.map((row) => this.hrView(row, canSeeSensitive));
  }

  async managementDecision(userId: string, tenantId: string, id: string, approve: boolean, dto: DecisionDto) {
    const row = await this.findAppraisal(tenantId, id);
    await this.assertNotSubject(userId, tenantId, row.employeeId);
    if (row.status !== 'Management_Approval_Pending') throw new ConflictException('This appraisal is not awaiting management approval.');
    const status: Status = approve ? 'Completed' : 'Rejected';
    const result = await this.move(tenantId, userId, row, status, 'management', approve ? 'approved' : 'rejected', dto.comment ?? '', approve ? { completedAt: new Date(), managementFeedback: dto.comment ?? '', finalRating: row.hrRating } : { managementFeedback: dto.comment ?? '' });
    await this.notifyEmployee(tenantId, row.employeeId, approve ? 'Final appraisal completed' : 'Appraisal recommendation rejected', dto.comment ?? (approve ? 'Your appraisal has been finalized.' : 'Management rejected the final recommendation.'), `/ess/appraisals/${id}`);
    return result;
  }

  async summary(tenantId: string, scope: 'employee' | 'manager' | 'hr' | 'management', userId: string) {
    const manager = scope === 'manager' ? await this.employeeByUser(userId, tenantId) : null;
    const employee = scope === 'employee' ? await this.employeeByUser(userId, tenantId, true) : null;
    if (scope === 'employee' && !employee) return { counts: {}, total: 0 };
    const where = {
      tenantId,
      ...(manager ? { managerEmployeeId: manager.id } : {}),
      ...(employee ? { employeeId: employee.id } : {}),
    };
    const groups = await this.prisma.employeeAppraisal.groupBy({ by: ['status'], where, _count: { _all: true } });
    const counts: Record<string, number> = {};
    for (const group of groups) counts[group.status] = group._count._all;
    if (scope === 'hr' || scope === 'management') {
      const rows = await this.prisma.employeeAppraisal.findMany({ where, include: { employee: { include: { department: true } } } });
      const byDepartment = new Map<string, { department: string; count: number; ratingTotal: number; ratingCount: number }>();
      for (const row of rows) {
        const department = row.employee.department?.name ?? 'Unassigned';
        const item = byDepartment.get(department) ?? { department, count: 0, ratingTotal: 0, ratingCount: 0 };
        item.count += 1;
        if (row.finalRating != null) { item.ratingTotal += Number(row.finalRating); item.ratingCount += 1; }
        byDepartment.set(department, item);
      }
      return {
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        departments: [...byDepartment.values()].map((item) => ({ department: item.department, count: item.count, averageFinalRating: item.ratingCount ? Number((item.ratingTotal / item.ratingCount).toFixed(2)) : null })),
        ...(scope === 'management' ? {
          promotionRecommendations: rows.filter((row) => Boolean(row.promotionRecommendation)).length,
          salaryRevisionSummary: {
            recommendations: rows.filter((row) => row.salaryIncreasePercent != null || row.salaryIncreaseAmount != null).length,
            proposedIncreaseAmount: rows.reduce((total, row) => total + Number(row.salaryIncreaseAmount ?? 0), 0),
            averageIncreasePercent: (() => {
              const values = rows.filter((row) => row.salaryIncreasePercent != null).map((row) => Number(row.salaryIncreasePercent));
              return values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null;
            })(),
          },
        } : {}),
      };
    }
    return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  }

  async detailForHr(tenantId: string, id: string, canSeeSensitive: boolean) {
    const row = await this.findAppraisal(tenantId, id, {
      employee: { include: { department: true } },
      cycle: true,
      kpiResponses: { include: { cycleKpi: true } },
      reviews: { include: { actor: { select: { email: true } } }, orderBy: { createdAt: 'asc' } },
    });
    return this.hrView(row, canSeeSensitive);
  }

  async rejectManager(userId: string, tenantId: string, id: string, dto: DecisionDto) {
    const row = await this.requireManagerPending(userId, tenantId, id);
    const result = await this.move(tenantId, userId, row, 'Rejected', 'manager', 'rejected', dto.comment ?? '');
    await this.notifyEmployee(tenantId, row.employeeId, 'Appraisal rejected', dto.comment ?? 'Your appraisal was rejected during manager review.', `/ess/appraisals/${id}`);
    return result;
  }

  private async ownedAppraisal(userId: string, tenantId: string, id: string) {
    const employee = await this.employeeByUser(userId, tenantId);
    const row = await this.prisma.employeeAppraisal.findFirst({ where: { id, tenantId, employeeId: employee.id } });
    if (!row) throw new NotFoundException('Appraisal not found.');
    return row;
  }

  private async employeeByUser(userId: string, tenantId: string, allowMissing = false) {
    const employee = await this.prisma.employee.findFirst({ where: { userId, tenantId } });
    if (!employee && !allowMissing) throw new ForbiddenException('No employee profile is linked to this account.');
    return employee!;
  }

  private async findAppraisal(tenantId: string, id: string, include: object = {}) {
    const row = await this.prisma.employeeAppraisal.findFirst({ where: { id, tenantId }, include: include as never });
    if (!row) throw new NotFoundException('Appraisal not found.');
    return row;
  }

  private async requireManagerPending(userId: string, tenantId: string, id: string) {
    const manager = await this.employeeByUser(userId, tenantId);
    const row = await this.findAppraisal(tenantId, id);
    if (row.employeeId === manager.id) throw new ForbiddenException('You cannot review your own appraisal.');
    if (row.managerEmployeeId !== manager.id) throw new ForbiddenException('This appraisal is not assigned to you.');
    if (row.status !== 'Manager_Review_Pending') throw new ConflictException('This appraisal is not awaiting manager review.');
    return row;
  }

  private async assertNotSubject(userId: string, tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { userId, tenantId }, select: { id: true } });
    if (employee?.id === employeeId) throw new ForbiddenException('You cannot take an approval action on your own appraisal.');
  }

  private async move(tenantId: string, userId: string, row: { id: string; status: string; employeeId: string }, toStatus: Status, stage: string, action: string, comment: string, extra: object = {}) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeAppraisal.updateMany({ where: { id: row.id, tenantId, status: row.status as never }, data: { status: toStatus as never, ...extra } as never });
      if (!changed.count) throw new ConflictException('This appraisal was updated by another reviewer. Refresh and try again.');
      await tx.appraisalReview.create({ data: { appraisalId: row.id, actorUserId: userId, stage, action, fromStatus: row.status, toStatus, comment } });
      await tx.auditEvent.create({ data: { tenantId, actorUserId: userId, action: `appraisal.${stage}.${action}`, entityType: 'EmployeeAppraisal', entityId: row.id, metadata: { fromStatus: row.status, toStatus } } });
    });
    return { id: row.id, status: toStatus };
  }

  private async returnForRevision(tenantId: string, userId: string, row: { id: string; status: string; employeeId: string }, stage: string, returnStage: string, comment: string) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeAppraisal.updateMany({
        where: { id: row.id, tenantId, status: row.status as never },
        data: { status: 'Revision_Requested', revisionReturnStage: returnStage },
      });
      if (!changed.count) throw new ConflictException('This appraisal was updated by another reviewer.');
      await tx.appraisalReview.create({ data: { appraisalId: row.id, actorUserId: userId, stage, action: 'revision_requested', fromStatus: row.status, toStatus: 'Revision_Requested', comment } });
      await tx.auditEvent.create({ data: { tenantId, actorUserId: userId, action: `appraisal.${stage}.revision_requested`, entityType: 'EmployeeAppraisal', entityId: row.id, metadata: { fromStatus: row.status, toStatus: 'Revision_Requested', returnStage } } });
    });
    return { id: row.id, status: 'Revision_Requested' };
  }

  private async notifyEmployee(tenantId: string, employeeId: string, title: string, body: string, href: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
    return this.notify(tenantId, employee?.userId, title, body, href);
  }

  private async notifyRole(tenantId: string, roles: string[], title: string, body: string, href: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'ACTIVE', roles: { some: { role: { code: { in: roles }, tenantId } } } },
      select: { id: true },
    });
    for (const user of users) await this.notify(tenantId, user.id, title, body, href);
  }

  private async notify(tenantId: string, userId: string | undefined | null, title: string, body: string, href: string) {
    if (!userId) return;
    await this.notifications.notify({ tenantId, userId, title, body, href, kind: 'appraisal' });
  }

  private async audit(tenantId: string, actorUserId: string, action: string, entityId: string, metadata: object) {
    await this.prisma.auditEvent.create({ data: { tenantId, actorUserId, action, entityType: 'AppraisalCycle', entityId, metadata } });
  }

  private employeeView(row: any) {
    const released = row.status === 'Completed';
    return {
      id: row.id, cycle: row.cycle, status: row.status, goals: row.goals, achievements: row.achievements,
      selfFeedback: row.selfFeedback,
      ...(released ? {
        managerFeedback: row.managerFeedback, managerStrengths: row.managerStrengths,
        managerImprovementAreas: row.managerImprovementAreas, managerRating: row.managerRating,
        hrFeedback: row.hrFeedback, hrRating: row.hrRating,
      } : {}),
      submittedAt: row.submittedAt, completedAt: row.completedAt,
      kpiResponses: row.kpiResponses.map((response: any) => released ? response : ({
        cycleKpiId: response.cycleKpiId, cycleKpi: response.cycleKpi,
        selfRating: response.selfRating, selfComment: response.selfComment,
      })),
      history: row.reviews.map((review: any) => ({
        stage: review.stage, action: review.action, status: review.toStatus, createdAt: review.createdAt,
        ...(review.action === 'revision_requested' ? { comment: review.comment } : {}),
      })),
    };
  }

  private managerView(row: any) {
    return {
      id: row.id, status: row.status, employee: row.employee, cycle: row.cycle, goals: row.goals,
      achievements: row.achievements, selfFeedback: row.selfFeedback, managerFeedback: row.managerFeedback,
      managerStrengths: row.managerStrengths, managerImprovementAreas: row.managerImprovementAreas,
      managerRating: row.managerRating, kpiResponses: row.kpiResponses,
      history: row.reviews.map((review: any) => ({ stage: review.stage, action: review.action, status: review.toStatus, createdAt: review.createdAt })),
    };
  }

  private hrView(row: any, canSeeSensitive: boolean) {
    const result = {
      id: row.id, status: row.status, updatedAt: row.updatedAt, submittedAt: row.submittedAt, completedAt: row.completedAt, employee: row.employee, cycle: row.cycle, goals: row.goals,
      achievements: row.achievements, selfFeedback: row.selfFeedback, managerFeedback: row.managerFeedback,
      managerStrengths: row.managerStrengths, managerImprovementAreas: row.managerImprovementAreas,
      managerRating: row.managerRating, hrFeedback: row.hrFeedback, hrRating: row.hrRating,
      managementFeedback: row.managementFeedback, finalRating: row.finalRating,
      kpiResponses: row.kpiResponses,
      history: canSeeSensitive ? row.reviews : row.reviews.map((review: any) => ({ stage: review.stage, action: review.action, fromStatus: review.fromStatus, toStatus: review.toStatus, createdAt: review.createdAt })),
    };
    return canSeeSensitive ? {
      ...result,
      promotionRecommendation: row.promotionRecommendation,
      salaryIncreasePercent: row.salaryIncreasePercent,
      salaryIncreaseAmount: row.salaryIncreaseAmount,
    } : result;
  }

  private date(value: string) {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private todayIndia() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  }
}
