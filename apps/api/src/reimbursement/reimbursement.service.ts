import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../auth/current-user.decorator';
import { reimbursementPayMonth } from './reimbursement-pay';

const HR_CODES = ['HRA', 'HRH', 'HRBP', 'HR_EXEC', 'HR_HEAD'];
const REVIEW_CODES = [...HR_CODES, 'FIN', 'ACC', 'FINANCE_READ', 'PAY', 'SYS', 'SECURITY_ADMIN', 'ADM'];
const SYS_CODES = ['SYS', 'SECURITY_ADMIN'];
const RECEIPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type ClaimRow = {
  id: string;
  employeeId: string;
  expenseDate: string;
  days: number;
  amount: number;
  reason: string;
  receiptName: string;
  status: string;
  salaryMonth: string;
  createdAt: Date;
  employee: {
    id: string;
    userId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    managerId: string | null;
  };
};

@Injectable()
export class ReimbursementService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ReimbursementClaim" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "expenseDate" TEXT NOT NULL,
        "days" INTEGER NOT NULL,
        "amount" INTEGER NOT NULL,
        "reason" TEXT NOT NULL,
        "receiptName" TEXT NOT NULL,
        "receiptType" TEXT NOT NULL,
        "receipt" BYTEA NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "salaryMonth" TEXT NOT NULL DEFAULT '',
        "decidedAt" TIMESTAMP(3),
        "decidedById" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ReimbursementClaim_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ReimbursementClaim_tenantId_status_idx" ON "ReimbursementClaim"("tenantId", "status")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ReimbursementClaim_employeeId_idx" ON "ReimbursementClaim"("employeeId")`,
    );
  }

  async list(actor: AuthUser) {
    const me = await this.actorEmployee(actor);
    const claims = await this.prisma.reimbursementClaim.findMany({
      where: { tenantId: actor.tenantId },
      omit: { receipt: true },
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });
    const lines = await this.prisma.salaryLine.findMany({
      where: { tenantId: actor.tenantId },
      select: { employeeId: true, month: true, paymentStatus: true },
    });
    const view = (claim: ClaimRow) => this.view(actor, me?.id ?? null, claim, lines);
    const mine = claims.filter((claim) => claim.employee.userId === actor.userId).map(view);
    const approvals = claims
      .filter((claim) => claim.status === 'pending' && this.canDecide(actor, me?.id ?? null, claim))
      .map(view);
    const company = this.canReview(actor.roles) ? claims.map(view) : [];
    const reports = me
      ? await this.prisma.employee.count({ where: { tenantId: actor.tenantId, managerId: me.id } })
      : 0;
    const canApprove = this.hasRole(actor.roles, SYS_CODES) || this.hasRole(actor.roles, HR_CODES) || reports > 0;
    return { mine, approvals, company, canApprove };
  }

  async create(
    actor: AuthUser,
    body: { expenseDate: string; days: string; amount: string; reason: string },
    file?: UploadFile,
  ) {
    const employee = await this.actorEmployee(actor);
    if (!employee) throw new BadRequestException('An employee profile is required to claim a reimbursement.');
    const expenseDate = (body.expenseDate ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) throw new BadRequestException('Enter the expense date.');
    const days = Number(body.days);
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new BadRequestException('Enter the number of days.');
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10_000_000) {
      throw new BadRequestException('Enter the reimbursement amount in rupees.');
    }
    const reason = (body.reason ?? '').trim();
    if (reason.length < 3 || reason.length > 500) throw new BadRequestException('Enter a reason.');
    const hasFile = Boolean(file?.buffer?.length);
    if (hasFile && !RECEIPT_TYPES.has(file!.mimetype)) {
      throw new BadRequestException('Upload a JPG, PNG, WEBP, or PDF receipt.');
    }
    const claim = await this.prisma.reimbursementClaim.create({
      data: {
        tenantId: actor.tenantId,
        employeeId: employee.id,
        expenseDate,
        days,
        amount,
        reason,
        receiptName: hasFile ? file!.originalname.slice(0, 180) || 'receipt' : '',
        receiptType: hasFile ? file!.mimetype : '',
        receipt: hasFile ? file!.buffer : Buffer.alloc(0),
      },
      include: { employee: true },
    });
    await this.notifyApprover(employee, claim.amount, expenseDate);
    return this.view(actor, employee.id, claim, []);
  }

  async decide(actor: AuthUser, id: string, status: 'approved' | 'rejected') {
    const claim = await this.prisma.reimbursementClaim.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { employee: true },
    });
    if (!claim) throw new NotFoundException('Reimbursement claim not found.');
    if (claim.status !== 'pending') throw new BadRequestException('This claim is already decided.');
    const me = await this.actorEmployee(actor);
    if (claim.employee.userId === actor.userId && !this.hasRole(actor.roles, SYS_CODES)) {
      throw new ForbiddenException('You cannot approve your own reimbursement.');
    }
    if (!this.canDecide(actor, me?.id ?? null, claim)) {
      throw new ForbiddenException('Only the manager can decide this reimbursement.');
    }
    const updated = await this.prisma.reimbursementClaim.update({
      where: { id: claim.id },
      data: { status, decidedAt: new Date(), decidedById: actor.userId },
      include: { employee: true },
    });
    if (updated.employee.userId) {
      await this.notifications.notify({
        tenantId: actor.tenantId,
        userId: updated.employee.userId,
        title: status === 'approved' ? 'Reimbursement approved' : 'Reimbursement rejected',
        body: `${this.rupees(updated.amount)} · ${updated.expenseDate}`,
        href: '/ess/reimbursements',
        kind: 'reimbursement',
      });
    }
    return this.view(actor, me?.id ?? null, updated, []);
  }

  async receipt(actor: AuthUser, id: string) {
    const claim = await this.prisma.reimbursementClaim.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { employee: true },
    });
    if (!claim) throw new NotFoundException('Receipt not found.');
    if (!claim.receiptName) throw new NotFoundException('No receipt was uploaded.');
    const me = await this.actorEmployee(actor);
    const allowed =
      claim.employee.userId === actor.userId ||
      this.canReview(actor.roles) ||
      this.canDecide(actor, me?.id ?? null, claim);
    if (!allowed) throw new ForbiddenException('You cannot open this receipt.');
    return {
      bytes: Buffer.from(claim.receipt),
      fileName: claim.receiptName,
      type: claim.receiptType,
    };
  }

  async amountFor(tenantId: string, employeeId: string, month: string) {
    const claims = await this.payableClaims(tenantId, employeeId, month);
    return claims.reduce((sum, claim) => sum + claim.amount, 0);
  }

  async amountsForMonth(tenantId: string, month: string) {
    const claims = await this.prisma.reimbursementClaim.findMany({
      where: { tenantId, status: 'approved' },
      omit: { receipt: true },
    });
    const lines = await this.prisma.salaryLine.findMany({
      where: { tenantId },
      select: { employeeId: true, month: true, paymentStatus: true },
    });
    const amounts = new Map<string, number>();
    for (const claim of claims) {
      const ownLines = lines.filter((line) => line.employeeId === claim.employeeId);
      if (reimbursementPayMonth(claim.expenseDate.slice(0, 7), claim.salaryMonth, ownLines) !== month) continue;
      amounts.set(claim.employeeId, (amounts.get(claim.employeeId) ?? 0) + claim.amount);
    }
    return amounts;
  }

  async assign(tenantId: string, employeeId: string, month: string) {
    const claims = await this.payableClaims(tenantId, employeeId, month);
    const ids = claims.filter((claim) => !claim.salaryMonth).map((claim) => claim.id);
    if (!ids.length) return;
    await this.prisma.reimbursementClaim.updateMany({
      where: { id: { in: ids } },
      data: { salaryMonth: month },
    });
  }

  private async payableClaims(tenantId: string, employeeId: string, month: string) {
    const [claims, lines] = await Promise.all([
      this.prisma.reimbursementClaim.findMany({
        where: { tenantId, employeeId, status: 'approved' },
        omit: { receipt: true },
      }),
      this.prisma.salaryLine.findMany({
        where: { tenantId, employeeId },
        select: { month: true, paymentStatus: true },
      }),
    ]);
    return claims.filter(
      (claim) => reimbursementPayMonth(claim.expenseDate.slice(0, 7), claim.salaryMonth, lines) === month,
    );
  }

  private async notifyApprover(
    employee: { id: string; tenantId: string; userId: string; firstName: string; lastName: string; managerId: string | null },
    amount: number,
    expenseDate: string,
  ) {
    const manager = employee.managerId
      ? await this.prisma.employee.findUnique({ where: { id: employee.managerId } })
      : null;
    if (manager?.userId && manager.userId !== employee.userId) {
      await this.notifications.notify({
        tenantId: employee.tenantId,
        userId: manager.userId,
        title: 'Reimbursement pending',
        body: `${employee.firstName} ${employee.lastName} · ${this.rupees(amount)} · ${expenseDate}`,
        href: '/ess/reimbursements',
        kind: 'reimbursement',
      });
      return;
    }
    const officers = await this.prisma.user.findMany({
      where: {
        tenantId: employee.tenantId,
        status: 'ACTIVE',
        id: { not: employee.userId },
        roles: { some: { role: { code: { in: HR_CODES } } } },
      },
      select: { id: true },
    });
    await Promise.all(
      officers.map((officer) =>
        this.notifications.notify({
          tenantId: employee.tenantId,
          userId: officer.id,
          title: 'Reimbursement pending',
          body: `${employee.firstName} ${employee.lastName} · ${this.rupees(amount)} · ${expenseDate}`,
          href: '/ess/reimbursements',
          kind: 'reimbursement',
        }),
      ),
    );
  }

  private view(
    actor: AuthUser,
    actorEmployeeId: string | null,
    claim: ClaimRow,
    lines: Array<{ employeeId: string; month: string; paymentStatus: string }>,
  ) {
    const ownLines = lines.filter((line) => line.employeeId === claim.employeeId);
    const payMonth = reimbursementPayMonth(claim.expenseDate.slice(0, 7), claim.salaryMonth, ownLines);
    return {
      id: claim.id,
      employeeId: claim.employeeId,
      employeeCode: claim.employee.employeeCode,
      employeeName: `${claim.employee.firstName} ${claim.employee.lastName}`.trim(),
      expenseDate: claim.expenseDate,
      days: claim.days,
      amount: claim.amount,
      reason: claim.reason,
      receiptName: claim.receiptName,
      hasReceipt: Boolean(claim.receiptName),
      status: claim.status,
      salaryMonth: claim.salaryMonth,
      payMonth,
      createdAt: claim.createdAt.toISOString(),
      canDecide: claim.status === 'pending' && this.canDecide(actor, actorEmployeeId, claim),
    };
  }

  private canDecide(actor: AuthUser, actorEmployeeId: string | null, claim: ClaimRow) {
    if (claim.employee.userId === actor.userId && !this.hasRole(actor.roles, SYS_CODES)) return false;
    if (this.hasRole(actor.roles, SYS_CODES)) return true;
    if (claim.employee.managerId && claim.employee.managerId === actorEmployeeId) return true;
    return !claim.employee.managerId && this.hasRole(actor.roles, HR_CODES);
  }

  private canReview(roles: string[]) {
    return this.hasRole(roles, REVIEW_CODES);
  }

  private hasRole(roles: string[], codes: string[]) {
    return roles.some((role) => codes.includes(role));
  }

  private async actorEmployee(actor: AuthUser) {
    return this.prisma.employee.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });
  }

  private rupees(amount: number) {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
}
