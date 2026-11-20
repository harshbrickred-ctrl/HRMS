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
import { buildTaxBreakdown, fyPosition, hraExemption, taxParts } from '../salary/salary-calc';
import type { SaveTaxDeclarationDto, TaxDecisionDto, TaxRegimeChangeDto } from './tax.dto';

const HR_CODES = ['HRA', 'HRH', 'HRBP', 'HR_EXEC', 'HR_HEAD', 'PAY', 'FIN', 'ACC', 'SYS', 'SECURITY_ADMIN'];
const PROOF_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const CHAPTER6_80C = new Set(['80C', '80CCD']);

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class TaxService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.ensureTables();
  }

  currentFy(month = this.payrollMonth()) {
    const { fyStart } = fyPosition(month);
    const startYear = Number(fyStart.slice(0, 4));
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
  }

  async summary(actor: AuthUser, fy?: string) {
    const employee = await this.requireEmployee(actor);
    const year = fy?.trim() || this.currentFy();
    const [declaration, proofs, regimeRequest, structure, projected] = await Promise.all([
      this.getDeclaration(actor.tenantId, employee.id, year),
      this.listProofs(actor.tenantId, employee.id, year),
      this.pendingRegime(actor.tenantId, employee.id),
      this.prisma.salaryStructure.findUnique({ where: { employeeId: employee.id } }),
      this.projectedStatement(actor.tenantId, employee.id, year),
    ]);
    return {
      fy: year,
      declaration,
      proofs,
      regimeRequest,
      structure: structure
        ? {
            taxRegime: structure.taxRegime === 'old' ? 'old' : 'new',
            annualDeductions: structure.annualDeductions,
            rentPaidAnnual: structure.rentPaidAnnual,
            isMetro: structure.isMetro,
            basic: structure.basic,
            hra: structure.hra,
            da: structure.da,
            monthlyGross: structure.monthlyGross,
          }
        : null,
      projectedStatement: projected,
    };
  }

  async getMyDeclaration(actor: AuthUser, fy?: string) {
    const employee = await this.requireEmployee(actor);
    const year = fy?.trim() || this.currentFy();
    return this.getDeclaration(actor.tenantId, employee.id, year);
  }

  async saveDeclaration(actor: AuthUser, dto: SaveTaxDeclarationDto) {
    const employee = await this.requireEmployee(actor);
    const fy = dto.fy.trim();
    this.assertFy(fy);
    const existing = await this.prisma.taxDeclaration.findUnique({
      where: { tenantId_employeeId_fy: { tenantId: actor.tenantId, employeeId: employee.id, fy } },
    });
    if (existing && (existing.status === 'submitted' || existing.status === 'approved')) {
      throw new BadRequestException('This declaration is locked. Withdraw or wait for HR to reject it.');
    }
    const lines = dto.lines.map((line) => ({
      section: line.section,
      label: line.label.trim(),
      amount: Math.max(0, Math.round(line.amount)),
    }));
    const saved = await this.prisma.taxDeclaration.upsert({
      where: { tenantId_employeeId_fy: { tenantId: actor.tenantId, employeeId: employee.id, fy } },
      create: {
        tenantId: actor.tenantId,
        employeeId: employee.id,
        fy,
        status: 'draft',
        rentPaidAnnual: Math.max(0, Math.round(dto.rentPaidAnnual)),
        isMetro: Boolean(dto.isMetro),
        lines: { create: lines },
      },
      update: {
        status: 'draft',
        rentPaidAnnual: Math.max(0, Math.round(dto.rentPaidAnnual)),
        isMetro: Boolean(dto.isMetro),
        decisionNote: '',
        decidedAt: null,
        decidedById: '',
        lines: {
          deleteMany: {},
          create: lines,
        },
      },
      include: { lines: true },
    });
    return this.viewDeclaration(saved);
  }

  async submitDeclaration(actor: AuthUser, fy: string) {
    const employee = await this.requireEmployee(actor);
    const year = fy.trim();
    this.assertFy(year);
    const existing = await this.prisma.taxDeclaration.findUnique({
      where: { tenantId_employeeId_fy: { tenantId: actor.tenantId, employeeId: employee.id, fy: year } },
      include: { lines: true },
    });
    if (!existing) throw new BadRequestException('Save a draft declaration before submitting.');
    if (existing.status === 'approved') throw new BadRequestException('This declaration is already approved.');
    if (existing.status === 'submitted') throw new BadRequestException('Already submitted for HR review.');
    const updated = await this.prisma.taxDeclaration.update({
      where: { id: existing.id },
      data: { status: 'submitted', decisionNote: '', decidedAt: null, decidedById: '' },
      include: { lines: true, employee: true },
    });
    await this.notifyHr(
      actor.tenantId,
      'Tax declaration submitted',
      `${updated.employee.firstName} ${updated.employee.lastName} · FY ${year}`,
      '/hr/tax',
    );
    return this.viewDeclaration(updated);
  }

  async listMyProofs(actor: AuthUser, fy?: string) {
    const employee = await this.requireEmployee(actor);
    return this.listProofs(actor.tenantId, employee.id, fy?.trim() || this.currentFy());
  }

  async uploadProof(
    actor: AuthUser,
    body: { fy: string; section: string; label: string; amount: string },
    file?: UploadFile,
  ) {
    const employee = await this.requireEmployee(actor);
    const fy = (body.fy ?? '').trim();
    this.assertFy(fy);
    const section = (body.section ?? '').trim().toUpperCase();
    if (!['80C', '80CCD', '80D', '80E', '80G', 'OTHER'].includes(section)) {
      throw new BadRequestException('Choose a valid tax section.');
    }
    const label = (body.label ?? '').trim();
    if (label.length < 1 || label.length > 120) throw new BadRequestException('Enter a proof label.');
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount < 0 || amount > 10_000_000) {
      throw new BadRequestException('Enter the proof amount in rupees.');
    }
    if (!file?.buffer?.length) throw new BadRequestException('Upload a JPG, PNG, WEBP, or PDF file.');
    if (!PROOF_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Upload a JPG, PNG, WEBP, or PDF file.');
    }
    const proof = await this.prisma.investmentProof.create({
      data: {
        tenantId: actor.tenantId,
        employeeId: employee.id,
        fy,
        section,
        label,
        amount,
        fileName: file.originalname.slice(0, 180) || 'proof',
        fileType: file.mimetype,
        file: file.buffer,
        status: 'pending',
      },
      include: { employee: true },
    });
    await this.notifyHr(
      actor.tenantId,
      'Investment proof uploaded',
      `${proof.employee.firstName} ${proof.employee.lastName} · ${label}`,
      '/hr/tax',
    );
    return this.viewProof(proof);
  }

  async deleteProof(actor: AuthUser, id: string) {
    const employee = await this.requireEmployee(actor);
    const proof = await this.prisma.investmentProof.findFirst({
      where: { id, tenantId: actor.tenantId, employeeId: employee.id },
    });
    if (!proof) throw new NotFoundException('Proof not found.');
    if (proof.status !== 'pending') throw new BadRequestException('Only pending proofs can be deleted.');
    await this.prisma.investmentProof.delete({ where: { id: proof.id } });
    return { ok: true };
  }

  async proofFile(actor: AuthUser, id: string) {
    const proof = await this.prisma.investmentProof.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { employee: true },
    });
    if (!proof) throw new NotFoundException('Proof not found.');
    const me = await this.actorEmployee(actor);
    const allowed =
      proof.employee.userId === actor.userId || this.canManage(actor.roles) || me?.id === proof.employee.managerId;
    if (!allowed) throw new ForbiddenException('You cannot open this proof.');
    return { bytes: Buffer.from(proof.file), fileName: proof.fileName, type: proof.fileType };
  }

  async requestRegimeChange(actor: AuthUser, dto: TaxRegimeChangeDto) {
    const employee = await this.requireEmployee(actor);
    const structure = await this.prisma.salaryStructure.findUnique({ where: { employeeId: employee.id } });
    const fromRegime = structure?.taxRegime === 'old' ? 'old' : 'new';
    if (fromRegime === dto.toRegime) {
      throw new BadRequestException('You are already on that tax regime.');
    }
    const pending = await this.pendingRegime(actor.tenantId, employee.id);
    if (pending) throw new BadRequestException('A regime change request is already pending.');
    const created = await this.prisma.taxRegimeChangeRequest.create({
      data: {
        tenantId: actor.tenantId,
        employeeId: employee.id,
        fromRegime,
        toRegime: dto.toRegime,
        reason: (dto.reason ?? '').trim().slice(0, 500),
        status: 'pending',
      },
      include: { employee: true },
    });
    await this.notifyHr(
      actor.tenantId,
      'Tax regime change requested',
      `${created.employee.firstName} ${created.employee.lastName} · ${fromRegime} → ${dto.toRegime}`,
      '/hr/tax',
    );
    return this.viewRegime(created);
  }

  async withdrawRegimeChange(actor: AuthUser, id: string) {
    const employee = await this.requireEmployee(actor);
    const request = await this.prisma.taxRegimeChangeRequest.findFirst({
      where: { id, tenantId: actor.tenantId, employeeId: employee.id },
    });
    if (!request) throw new NotFoundException('Request not found.');
    if (request.status !== 'pending') throw new BadRequestException('Only pending requests can be withdrawn.');
    const updated = await this.prisma.taxRegimeChangeRequest.update({
      where: { id: request.id },
      data: { status: 'withdrawn' },
      include: { employee: true },
    });
    return this.viewRegime(updated);
  }

  async companyQueue(actor: AuthUser) {
    if (!this.canManage(actor.roles)) throw new ForbiddenException('HR can review tax items.');
    const [declarations, proofs, regimes] = await Promise.all([
      this.prisma.taxDeclaration.findMany({
        where: { tenantId: actor.tenantId, status: 'submitted' },
        include: { lines: true, employee: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.investmentProof.findMany({
        where: { tenantId: actor.tenantId, status: 'pending' },
        omit: { file: true },
        include: { employee: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.taxRegimeChangeRequest.findMany({
        where: { tenantId: actor.tenantId, status: 'pending' },
        include: { employee: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      declarations: declarations.map((item) => this.viewDeclaration(item)),
      proofs: proofs.map((item) => this.viewProof(item)),
      regimeChanges: regimes.map((item) => this.viewRegime(item)),
    };
  }

  async decideDeclaration(actor: AuthUser, id: string, dto: TaxDecisionDto) {
    if (!this.canManage(actor.roles)) throw new ForbiddenException('HR can decide declarations.');
    const status = dto.status === 'accepted' ? 'approved' : dto.status;
    if (status !== 'approved' && status !== 'rejected') {
      throw new BadRequestException('Use approved or rejected.');
    }
    const declaration = await this.prisma.taxDeclaration.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { lines: true, employee: true },
    });
    if (!declaration) throw new NotFoundException('Declaration not found.');
    if (declaration.status !== 'submitted') throw new BadRequestException('Only submitted declarations can be decided.');
    const updated = await this.prisma.taxDeclaration.update({
      where: { id: declaration.id },
      data: {
        status,
        decisionNote: (dto.note ?? '').trim().slice(0, 500),
        decidedAt: new Date(),
        decidedById: actor.userId,
      },
      include: { lines: true, employee: true },
    });
    if (status === 'approved') {
      await this.syncStructureFromDeclaration(actor.tenantId, updated.employeeId, updated);
    }
    if (updated.employee.userId) {
      await this.notifications.notify({
        tenantId: actor.tenantId,
        userId: updated.employee.userId,
        title: status === 'approved' ? 'Tax declaration approved' : 'Tax declaration rejected',
        body: `FY ${updated.fy}`,
        href: '/ess/salary',
        kind: 'tax',
      });
    }
    return this.viewDeclaration(updated);
  }

  async decideProof(actor: AuthUser, id: string, dto: TaxDecisionDto) {
    if (!this.canManage(actor.roles)) throw new ForbiddenException('HR can decide proofs.');
    const status = dto.status === 'approved' ? 'accepted' : dto.status;
    if (status !== 'accepted' && status !== 'rejected') {
      throw new BadRequestException('Use accepted or rejected.');
    }
    const proof = await this.prisma.investmentProof.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { employee: true },
    });
    if (!proof) throw new NotFoundException('Proof not found.');
    if (proof.status !== 'pending') throw new BadRequestException('This proof is already decided.');
    const updated = await this.prisma.investmentProof.update({
      where: { id: proof.id },
      data: {
        status,
        decisionNote: (dto.note ?? '').trim().slice(0, 500),
        decidedAt: new Date(),
        decidedById: actor.userId,
      },
      include: { employee: true },
    });
    if (updated.employee.userId) {
      await this.notifications.notify({
        tenantId: actor.tenantId,
        userId: updated.employee.userId,
        title: status === 'accepted' ? 'Investment proof accepted' : 'Investment proof rejected',
        body: updated.label,
        href: '/ess/salary',
        kind: 'tax',
      });
    }
    return this.viewProof(updated);
  }

  async decideRegime(actor: AuthUser, id: string, dto: TaxDecisionDto) {
    if (!this.canManage(actor.roles)) throw new ForbiddenException('HR can decide regime changes.');
    const status = dto.status === 'accepted' ? 'approved' : dto.status;
    if (status !== 'approved' && status !== 'rejected') {
      throw new BadRequestException('Use approved or rejected.');
    }
    const request = await this.prisma.taxRegimeChangeRequest.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { employee: true },
    });
    if (!request) throw new NotFoundException('Request not found.');
    if (request.status !== 'pending') throw new BadRequestException('This request is already decided.');
    const updated = await this.prisma.taxRegimeChangeRequest.update({
      where: { id: request.id },
      data: {
        status,
        decisionNote: (dto.note ?? '').trim().slice(0, 500),
        decidedAt: new Date(),
        decidedById: actor.userId,
      },
      include: { employee: true },
    });
    if (status === 'approved') {
      const structure = await this.prisma.salaryStructure.findUnique({
        where: { employeeId: updated.employeeId },
      });
      if (!structure || structure.tenantId !== actor.tenantId) {
        throw new BadRequestException('Save a salary structure before approving a regime change.');
      }
      await this.prisma.salaryStructure.update({
        where: { employeeId: updated.employeeId },
        data: { taxRegime: updated.toRegime },
      });
    }
    if (updated.employee.userId) {
      await this.notifications.notify({
        tenantId: actor.tenantId,
        userId: updated.employee.userId,
        title: status === 'approved' ? 'Tax regime change approved' : 'Tax regime change rejected',
        body: `${updated.fromRegime} → ${updated.toRegime}`,
        href: '/ess/salary',
        kind: 'tax',
      });
    }
    return this.viewRegime(updated);
  }

  private async syncStructureFromDeclaration(
    tenantId: string,
    employeeId: string,
    declaration: {
      rentPaidAnnual: number;
      isMetro: boolean;
      lines: Array<{ section: string; amount: number }>;
    },
  ) {
    const structure = await this.prisma.salaryStructure.findUnique({ where: { employeeId } });
    if (!structure || structure.tenantId !== tenantId) {
      throw new BadRequestException('Save a salary structure before approving a declaration.');
    }
    const annualDeductions = this.chapter6Total(declaration.lines);
    await this.prisma.salaryStructure.update({
      where: { employeeId },
      data: {
        annualDeductions,
        rentPaidAnnual: declaration.rentPaidAnnual,
        isMetro: declaration.isMetro,
      },
    });
  }

  chapter6Total(lines: Array<{ section: string; amount: number }>) {
    let eightyC = 0;
    let other = 0;
    for (const line of lines) {
      const amount = Math.max(0, Math.round(line.amount));
      if (CHAPTER6_80C.has(line.section)) eightyC += amount;
      else other += amount;
    }
    return Math.min(150_000, eightyC) + other;
  }

  private async projectedStatement(tenantId: string, employeeId: string, fy: string) {
    const structure = await this.prisma.salaryStructure.findUnique({ where: { employeeId } });
    if (!structure || structure.tenantId !== tenantId) return null;
    const month = this.payrollMonth();
    const regime = structure.taxRegime === 'old' ? 'old' : 'new';
    const projected = structure.monthlyGross * 12;
    const exempt =
      regime === 'old'
        ? hraExemption(
            structure.basic * 12,
            structure.da * 12,
            structure.hra * 12,
            structure.rentPaidAnnual,
            structure.isMetro,
          )
        : 0;
    const ptAnnual = regime === 'old' ? Math.min(2_500, structure.ptMonthly * 12) : 0;
    const tax = taxParts(projected, regime, structure.annualDeductions, ptAnnual, exempt);
    const taxBreakdown = buildTaxBreakdown(projected, regime, structure.annualDeductions, ptAnnual, exempt, {
      incomeLabel: 'Gross salary (projected annual)',
      monthsLeft: fyPosition(month).monthsLeft,
    });
    return {
      fy,
      month,
      form130: [
        { id: 'F-08', label: 'Gross salary (projected)', amount: projected },
        { id: 'F-09', label: 'Exempt allowances (HRA)', amount: tax.exemptAllowances },
        { id: 'F-11', label: 'Standard deduction', amount: tax.stdDed },
        { id: 'F-11b', label: 'Professional tax deduction', amount: tax.ptDed },
        { id: 'F-15', label: 'Chapter VI-A deductions', amount: tax.chapter6 },
        { id: 'F-17', label: 'Taxable income', amount: tax.taxable },
        { id: 'F-18', label: 'Tax on taxable income', amount: tax.slab },
        { id: 'F-19', label: 'Rebate', amount: tax.rebate },
        { id: 'F-20', label: 'Surcharge', amount: tax.surcharge },
        { id: 'F-21', label: 'Health and education cess', amount: tax.cess },
        { id: 'F-22', label: 'Tax payable (projected)', amount: tax.total },
      ],
      taxBreakdown,
    };
  }

  private async getDeclaration(tenantId: string, employeeId: string, fy: string) {
    const row = await this.prisma.taxDeclaration.findUnique({
      where: { tenantId_employeeId_fy: { tenantId, employeeId, fy } },
      include: { lines: true },
    });
    return row ? this.viewDeclaration(row) : { fy, status: 'draft', rentPaidAnnual: 0, isMetro: false, lines: [], decisionNote: '' };
  }

  private async listProofs(tenantId: string, employeeId: string, fy: string) {
    const rows = await this.prisma.investmentProof.findMany({
      where: { tenantId, employeeId, fy },
      omit: { file: true },
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.viewProof(row));
  }

  private async pendingRegime(tenantId: string, employeeId: string) {
    const row = await this.prisma.taxRegimeChangeRequest.findFirst({
      where: { tenantId, employeeId, status: 'pending' },
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.viewRegime(row) : null;
  }

  private viewDeclaration(
    row: {
      id?: string;
      fy: string;
      status: string;
      rentPaidAnnual: number;
      isMetro: boolean;
      decisionNote: string;
      decidedAt?: Date | null;
      employee?: { employeeCode: string; firstName: string; lastName: string };
      lines: Array<{ id?: string; section: string; label: string; amount: number }>;
    },
  ) {
    return {
      id: row.id,
      fy: row.fy,
      status: row.status,
      rentPaidAnnual: row.rentPaidAnnual,
      isMetro: row.isMetro,
      decisionNote: row.decisionNote,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      chapter6Total: this.chapter6Total(row.lines),
      employeeCode: row.employee?.employeeCode,
      employeeName: row.employee ? `${row.employee.firstName} ${row.employee.lastName}`.trim() : undefined,
      lines: row.lines.map((line) => ({
        id: line.id,
        section: line.section,
        label: line.label,
        amount: line.amount,
      })),
    };
  }

  private viewProof(
    row: {
      id: string;
      fy: string;
      section: string;
      label: string;
      amount: number;
      fileName: string;
      status: string;
      decisionNote: string;
      createdAt: Date;
      employee?: { employeeCode: string; firstName: string; lastName: string };
    },
  ) {
    return {
      id: row.id,
      fy: row.fy,
      section: row.section,
      label: row.label,
      amount: row.amount,
      fileName: row.fileName,
      status: row.status,
      decisionNote: row.decisionNote,
      createdAt: row.createdAt.toISOString(),
      employeeCode: row.employee?.employeeCode,
      employeeName: row.employee ? `${row.employee.firstName} ${row.employee.lastName}`.trim() : undefined,
    };
  }

  private viewRegime(
    row: {
      id: string;
      fromRegime: string;
      toRegime: string;
      reason: string;
      status: string;
      decisionNote: string;
      createdAt: Date;
      employee?: { employeeCode: string; firstName: string; lastName: string };
    },
  ) {
    return {
      id: row.id,
      fromRegime: row.fromRegime,
      toRegime: row.toRegime,
      reason: row.reason,
      status: row.status,
      decisionNote: row.decisionNote,
      createdAt: row.createdAt.toISOString(),
      employeeCode: row.employee?.employeeCode,
      employeeName: row.employee ? `${row.employee.firstName} ${row.employee.lastName}`.trim() : undefined,
    };
  }

  private canManage(roles: string[]) {
    return roles.some((role) => HR_CODES.includes(role));
  }

  private async requireEmployee(actor: AuthUser) {
    const employee = await this.actorEmployee(actor);
    if (!employee) throw new BadRequestException('An employee profile is required.');
    return employee;
  }

  private async actorEmployee(actor: AuthUser) {
    return this.prisma.employee.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });
  }

  private async notifyHr(tenantId: string, title: string, body: string, href: string) {
    const officers = await this.prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        roles: { some: { role: { code: { in: ['HRA', 'HRH', 'HRBP', 'HR_EXEC', 'HR_HEAD', 'PAY'] } } } },
      },
      select: { id: true },
      take: 20,
    });
    await Promise.all(
      officers.map((officer) =>
        this.notifications.notify({
          tenantId,
          userId: officer.id,
          title,
          body,
          href,
          kind: 'tax',
        }),
      ),
    );
  }

  private assertFy(fy: string) {
    if (!/^\d{4}-\d{2}$/.test(fy)) throw new BadRequestException('FY must look like 2026-27.');
  }

  private payrollMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private async ensureTables() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TaxDeclaration" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "fy" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "rentPaidAnnual" INTEGER NOT NULL DEFAULT 0,
        "isMetro" BOOLEAN NOT NULL DEFAULT false,
        "decisionNote" TEXT NOT NULL DEFAULT '',
        "decidedAt" TIMESTAMP(3),
        "decidedById" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TaxDeclaration_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TaxDeclarationLine" (
        "id" TEXT NOT NULL,
        "declarationId" TEXT NOT NULL,
        "section" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "amount" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "TaxDeclarationLine_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "InvestmentProof" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "fy" TEXT NOT NULL,
        "section" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "amount" INTEGER NOT NULL DEFAULT 0,
        "fileName" TEXT NOT NULL,
        "fileType" TEXT NOT NULL,
        "file" BYTEA NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "decisionNote" TEXT NOT NULL DEFAULT '',
        "decidedAt" TIMESTAMP(3),
        "decidedById" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvestmentProof_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TaxRegimeChangeRequest" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "fromRegime" TEXT NOT NULL,
        "toRegime" TEXT NOT NULL,
        "reason" TEXT NOT NULL DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'pending',
        "decisionNote" TEXT NOT NULL DEFAULT '',
        "decidedAt" TIMESTAMP(3),
        "decidedById" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TaxRegimeChangeRequest_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "TaxDeclaration_tenantId_employeeId_fy_key" ON "TaxDeclaration"("tenantId", "employeeId", "fy")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "TaxDeclaration_tenantId_status_idx" ON "TaxDeclaration"("tenantId", "status")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "TaxDeclarationLine_declarationId_idx" ON "TaxDeclarationLine"("declarationId")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "InvestmentProof_tenantId_status_idx" ON "InvestmentProof"("tenantId", "status")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "InvestmentProof_tenantId_employeeId_fy_idx" ON "InvestmentProof"("tenantId", "employeeId", "fy")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "TaxRegimeChangeRequest_tenantId_status_idx" ON "TaxRegimeChangeRequest"("tenantId", "status")`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "rentPaidAnnual" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "isMetro" BOOLEAN NOT NULL DEFAULT false`,
    );
  }
}
