import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ReimbursementService } from '../reimbursement/reimbursement.service';
import {
  computeSalary,
  fyPosition,
  presentPayLine,
  resolveStructure,
  specialAllowanceFromCtc,
  statutoryOutsideFixed,
  type MonthAdjustments,
  type PriorPay,
  type ResolvedStructure,
} from './salary-calc';
import { buildPayslipPdf, payslipFileName } from './payslip-pdf';
import { buildStatement, type StatementLine } from './salary-statement';
import type { AuthUser } from '../auth/current-user.decorator';
import type { BankFileDto, ReconcilePayoutDto, RetryPayoutDto, SaveMonthDto, SaveStructureDto } from './dto/salary.dto';

type StructureRow = {
  monthlyGross: number;
  basic: number;
  hra: number;
  da: number;
  otherAllowances: number;
  pfOnActual: boolean;
  taxRegime: string;
  ptMonthly: number;
  annualDeductions: number;
  rentPaidAnnual: number;
  isMetro: boolean;
  ytdTaxable: number;
  ytdTds: number;
  ytdPt: number;
};

const PAYROLL_CONTROL_ROLES = ['HRH', 'HR_HEAD', 'SYS', 'SECURITY_ADMIN'];

function canControlPayroll(roles: string[]) {
  return roles.some((role) => PAYROLL_CONTROL_ROLES.includes(role));
}

@Injectable()
export class SalaryService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly reimbursements: ReimbursementService,
  ) {}

  async onModuleInit() {
    await this.ensureTables();
  }

  async list(tenantId: string, month: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      include: { salaryStructure: true },
      orderBy: { employeeCode: 'asc' },
    });
    const { fyStart } = fyPosition(month);
    const [lines, history, attendanceByEmployee, reimbursementByEmployee] = await Promise.all([
      this.prisma.salaryLine.findMany({ where: { tenantId, month } }),
      this.prisma.salaryLine.findMany({ where: { tenantId, month: { gte: fyStart, lte: month } } }),
      this.attendance.payByEmployee(tenantId, month),
      this.reimbursements.amountsForMonth(tenantId, month),
    ]);
    const byEmployee = new Map(lines.map((line) => [line.employeeId, line]));
    const historyByEmployee = new Map<string, typeof lines>();
    for (const line of history) {
      const bucket = historyByEmployee.get(line.employeeId) ?? [];
      bucket.push(line);
      historyByEmployee.set(line.employeeId, bucket);
    }
    return {
      employees: employees.map((employee) => {
      const stored = byEmployee.get(employee.id) ?? null;
      const structure = employee.salaryStructure;
      const structureStatutory = structure?.statutoryBonus ?? 0;
      const historyStored = historyByEmployee.get(employee.id) ?? [];
      const attendance = attendanceByEmployee.get(employee.id) ?? null;
      const reimbursement = reimbursementByEmployee.get(employee.id) ?? 0;
      const storedLine = freshenUnpaidLine(structure, stored, month, attendance, historyStored, reimbursement);
      const line = storedLine ?? previewPayLine(structure, month, attendance, historyStored, reimbursement);
      const historyLines = historyStored.map((item) =>
        item.month === month && line ? line : presentPayLine(item, structureStatutory),
      );
      return {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        designation: employee.designation,
        structure,
        line,
        attendance: attendanceByEmployee.get(employee.id) ?? null,
        statement:
          line && structure
            ? buildStatement(
                asStatementLine(line),
                historyLines.map(asStatementLine),
                structure.taxRegime === 'old' ? 'old' : 'new',
                structure.annualDeductions,
                structure.pfOnActual,
                {
                  rentPaidAnnual: structure.rentPaidAnnual,
                  isMetro: structure.isMetro,
                  monthlyBasic: structure.basic,
                  monthlyHra: structure.hra,
                  monthlyDa: structure.da,
                },
              )
            : null,
      };
    }),
      approved: Boolean(
        (
          await this.prisma.payrollMonth.findUnique({
            where: { tenantId_month: { tenantId, month } },
          })
        )?.approved,
      ),
      locked: lines.length > 0 && lines.every((line) => line.status === 'locked'),
    };
  }

  async saveStructure(tenantId: string, employeeId: string, dto: SaveStructureDto) {
    await this.requireEmployee(tenantId, employeeId);
    const { special: _special, ...resolved } = this.parseStructure(dto);
    const ctc = dto.ctc && dto.ctc > 0 ? dto.ctc : undefined;
    return this.prisma.salaryStructure.upsert({
      where: { employeeId },
      create: { tenantId, employeeId, ...resolved, ...this.opening(dto), ...(ctc ? { ctc } : {}) },
      update: { ...resolved, ...this.opening(dto), ...(ctc ? { ctc } : {}) },
    });
  }

  async saveMonth(tenantId: string, employeeId: string, dto: SaveMonthDto) {
    await this.requireEmployee(tenantId, employeeId);
    await this.assertUnlocked(tenantId, employeeId, dto.month);
    return this.writeLine(tenantId, employeeId, dto.month, dto);
  }

  async generate(tenantId: string, month: string) {
    const already = await this.prisma.salaryLine.count({
      where: { tenantId, month, submittedToFinance: true },
    });
    if (already) throw new BadRequestException('This month is already generated.');
    const structures = await this.prisma.salaryStructure.findMany({
      where: { tenantId },
    });
    let generated = 0;
    let skippedLocked = 0;
    const errors: Array<{ employeeId: string; message: string }> = [];
    for (const structure of structures) {
      const existing = await this.prisma.salaryLine.findUnique({
        where: { tenantId_employeeId_month: { tenantId, employeeId: structure.employeeId, month } },
      });
      if (existing?.status === 'locked' || existing?.paymentStatus === 'paid' || existing?.paymentStatus === 'direct') {
        skippedLocked += 1;
        continue;
      }
      try {
        const source = existing ? presentPayLine(existing, structure.statutoryBonus) : null;
        await this.writeLine(
          tenantId,
          structure.employeeId,
          month,
          {
            lopDays: source?.lopDays,
            bonus: source?.bonus,
            overtime: source?.overtime,
            incentive: source?.incentive,
            arrears: source?.arrears,
            loanRecovery: source?.loanRecovery,
            advanceRecovery: source?.advanceRecovery,
            otherDeduction: source?.otherDeduction,
          },
          { sendToFinance: true },
        );
        generated += 1;
      } catch (error) {
        errors.push({
          employeeId: structure.employeeId,
          message: error instanceof Error ? error.message : 'Could not generate salary',
        });
      }
    }
    await this.prisma.payrollMonth.upsert({
      where: { tenantId_month: { tenantId, month } },
      create: { tenantId, month, approved: false },
      update: { approved: false, approvedAt: null },
    });
    return { month, generated, skippedLocked, errors };
  }

  async approvePayroll(tenantId: string, actor: AuthUser, month: string) {
    if (!canControlPayroll(actor.roles)) throw new ForbiddenException('HR Head has to approve this payroll.');
    const ready = await this.prisma.salaryLine.count({
      where: { tenantId, month, submittedToFinance: true },
    });
    if (!ready) throw new BadRequestException('Generate the month before approving it.');
    const existing = await this.prisma.payrollMonth.findUnique({
      where: { tenantId_month: { tenantId, month } },
    });
    if (existing?.approved) throw new BadRequestException('This month is already approved.');
    const batch = await this.prisma.payrollMonth.upsert({
      where: { tenantId_month: { tenantId, month } },
      create: { tenantId, month, approved: true, approvedAt: new Date() },
      update: { approved: true, approvedAt: new Date() },
    });
    return { month, approved: batch.approved, approvedAt: batch.approvedAt, employees: ready };
  }

  async payout(tenantId: string, month: string) {
    const batch = await this.prisma.payrollMonth.findUnique({
      where: { tenantId_month: { tenantId, month } },
    });
    const rows = await this.payoutRows(tenantId, month);
    const payable = rows.filter((row) => row.eligible && row.paymentStatus !== 'failed');
    return {
      month,
      approved: Boolean(batch?.approved),
      approvedAt: batch?.approvedAt ?? null,
      totalEmployees: rows.length,
      totalNet: rows.reduce((sum, row) => sum + row.netPay, 0),
      eligibleNet: payable.reduce((sum, row) => sum + row.netPay, 0),
      rows,
    };
  }

  async bankFile(tenantId: string, dto: BankFileDto) {
    const batch = await this.prisma.payrollMonth.findUnique({
      where: { tenantId_month: { tenantId, month: dto.month } },
    });
    if (!batch?.approved) throw new BadRequestException('HR Head has to approve this payroll first.');
    const rows = (await this.payoutRows(tenantId, dto.month)).filter((row) =>
      dto.employeeIds.includes(row.employeeId),
    );
    if (!rows.length) throw new BadRequestException('Select at least one employee.');
    const blocked = rows.filter((row) => !row.eligible || row.paymentStatus === 'paid');
    if (blocked.length) {
      throw new BadRequestException(
        `${blocked.map((row) => row.employeeCode).join(', ')} cannot be included. Bank details are missing or the salary is already paid.`,
      );
    }
    await this.releasePendingDirect(
      tenantId,
      dto.month,
      rows.filter((row) => row.paymentStatus === 'direct'),
    );
    await this.prisma.salaryLine.updateMany({
      where: { tenantId, month: dto.month, employeeId: { in: rows.map((row) => row.employeeId) } },
      data: { paymentStatus: 'file', payoutGenerated: true, status: 'payout' },
    });
    const file = bankFileCsv(dto.template, dto.month, rows);
    return { ...file, rows: rows.map((row) => ({ ...row, paymentStatus: 'file' })) };
  }

  async reconcile(tenantId: string, dto: ReconcilePayoutDto) {
    for (const update of dto.updates) {
      const line = await this.prisma.salaryLine.findFirst({
        where: { tenantId, month: dto.month, employeeId: update.employeeId, submittedToFinance: true },
      });
      if (!line) throw new NotFoundException('Payroll line not found.');
      if (update.status === 'paid') {
        const utr = (update.utr ?? '').trim();
        if (!utr) throw new BadRequestException('Enter the bank UTR before marking salary paid.');
        if (line.paymentStatus !== 'file' && line.paymentStatus !== 'failed') {
          throw new BadRequestException('Generate the bank file before recording a payment.');
        }
        await this.prisma.salaryLine.update({
          where: { id: line.id },
          data: { paymentStatus: 'paid', utr, status: 'paid' },
        });
      } else {
        await this.prisma.salaryLine.update({
          where: { id: line.id },
          data: { paymentStatus: 'failed', utr: '', status: 'failed' },
        });
      }
    }
    return this.payout(tenantId, dto.month);
  }

  async retryPayout(tenantId: string, dto: RetryPayoutDto) {
    await this.prisma.salaryLine.updateMany({
      where: {
        tenantId,
        month: dto.month,
        employeeId: { in: dto.employeeIds },
        paymentStatus: 'failed',
      },
      data: { paymentStatus: 'pending', payoutGenerated: false, utr: '', status: 'submitted' },
    });
    return this.payout(tenantId, dto.month);
  }

  async generatePayout(tenantId: string, month: string) {
    return this.payout(tenantId, month);
  }

  async setLocked(tenantId: string, actor: AuthUser, month: string, locked: boolean) {
    if (!canControlPayroll(actor.roles)) throw new ForbiddenException('HR Head has to lock this payroll.');
    if (locked) {
      const existing = await this.prisma.salaryLine.findMany({
        where: { tenantId, month },
        select: { status: true },
      });
      if (existing.length > 0 && existing.every((line) => line.status === 'locked')) {
        throw new BadRequestException('This month is already locked.');
      }
    }
    const result = await this.prisma.salaryLine.updateMany({
      where: { tenantId, month },
      data: { status: locked ? 'locked' : 'draft' },
    });
    return { month, locked, count: result.count };
  }

  async upload(tenantId: string, kind: 'structure' | 'month', csv: string, month?: string) {
    if (kind === 'month' && !month) throw new BadRequestException('Choose the payroll month.');
    const rows = parseCsv(csv);
    const errors: Array<{ row: number; message: string }> = [];
    let updated = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      try {
        const code = row.employeeCode || row.employee_code || row.code;
        if (!code) throw new Error('employeeCode is required.');
        const employee = await this.prisma.employee.findUnique({
          where: { tenantId_employeeCode: { tenantId, employeeCode: code } },
        });
        if (!employee) throw new Error(`No employee with code ${code}.`);
        if (kind === 'structure') {
          const dto = structureFromCsv(row);
          await this.saveStructure(tenantId, employee.id, dto);
        } else {
          await this.saveMonth(tenantId, employee.id, {
            month: month!,
            lopDays: integer(row.lopDays),
            bonus: integer(row.bonus),
            overtime: integer(row.overtime),
            incentive: integer(row.incentive),
            arrears: integer(row.arrears),
            loanRecovery: integer(row.loanRecovery),
            advanceRecovery: integer(row.advanceRecovery),
            otherDeduction: integer(row.otherDeduction),
          });
        }
        updated += 1;
      } catch (error) {
        errors.push({
          row: index + 2,
          message: error instanceof Error ? error.message : 'Could not read this row.',
        });
      }
    }
    return { updated, errors };
  }

  async mine(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { salaryStructure: true },
    });
    if (!employee) return { structure: null, lines: [], statement: null };
    const lines = await this.prisma.salaryLine.findMany({
      where: { employeeId: employee.id },
      orderBy: { month: 'desc' },
    });
    const paidLines = lines.filter((line) => line.paymentStatus === 'paid');
    const latest = lines[0];
    const structure = employee.salaryStructure;
    const { fyStart } = latest ? fyPosition(latest.month) : { fyStart: '' };
    const fyLines = latest ? lines.filter((line) => line.month >= fyStart && line.month <= latest.month) : [];
    const attendance = latest ? (await this.attendance.payByEmployee(employee.tenantId, latest.month)).get(employee.id) : null;
    const reimbursement =
      latest && latest.paymentStatus !== 'paid' && latest.paymentStatus !== 'direct'
        ? await this.reimbursements.amountFor(employee.tenantId, employee.id, latest.month)
        : 0;
    const current = latest
      ? freshenUnpaidLine(structure, latest, latest.month, attendance ?? null, fyLines, reimbursement)
      : null;
    return {
      structure: employee.salaryStructure
        ? {
            monthlyGross: employee.salaryStructure.monthlyGross,
            basic: employee.salaryStructure.basic,
            hra: employee.salaryStructure.hra,
            da: employee.salaryStructure.da,
            otherAllowances: employee.salaryStructure.otherAllowances,
            special:
              employee.salaryStructure.ctc > 0
                ? specialAllowanceFromCtc(
                    employee.salaryStructure.ctc,
                    employee.salaryStructure.basic,
                    employee.salaryStructure.hra,
                    employee.salaryStructure.statutoryBonus,
                  )
                : employee.salaryStructure.monthlyGross -
                  employee.salaryStructure.basic -
                  employee.salaryStructure.hra -
                  employee.salaryStructure.da -
                  employee.salaryStructure.otherAllowances -
                  employee.salaryStructure.statutoryBonus -
                  employee.salaryStructure.dailyAllowance,
            taxRegime: employee.salaryStructure.taxRegime,
          }
        : null,
      lines: paidLines,
      payslip: current
        ? {
            month: current.month,
            gross: current.gross,
            deductions: current.gross - current.netPay,
            netPay: current.netPay,
            paidDays: current.paidDays,
            paid: current.paymentStatus === 'paid',
          }
        : null,
      statement:
        current && structure
          ? buildStatement(
              asStatementLine(current),
              fyLines.map((line) => asStatementLine(line.month === current.month ? current : line)),
              structure.taxRegime === 'old' ? 'old' : 'new',
              structure.annualDeductions,
              structure.pfOnActual,
              {
                rentPaidAnnual: structure.rentPaidAnnual,
                isMetro: structure.isMetro,
                monthlyBasic: structure.basic,
                monthlyHra: structure.hra,
                monthlyDa: structure.da,
              },
            )
          : null,
    };
  }

  async payslipPdf(userId: string, month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('Choose a valid month.');
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { salaryStructure: true, department: true, location: true, tenant: true },
    });
    if (!employee) throw new NotFoundException('Employee profile not found.');
    const line = await this.prisma.salaryLine.findFirst({
      where: { employeeId: employee.id, month, paymentStatus: 'paid' },
    });
    if (!line) throw new NotFoundException('Payslip is available after the salary is marked paid.');
    const structure = employee.salaryStructure;
    const fullSpecial = structure
      ? structure.ctc > 0
        ? specialAllowanceFromCtc(structure.ctc, structure.basic, structure.hra, structure.statutoryBonus)
        : structure.monthlyGross -
          structure.basic -
          structure.hra -
          structure.da -
          structure.otherAllowances -
          structure.statutoryBonus -
          structure.dailyAllowance
      : line.special;
    const earningRows = [
      ['BASIC', structure?.basic ?? line.basic, line.basic],
      ['HRA', structure?.hra ?? line.hra, line.hra],
      ['DEARNESS ALLOWANCE', structure?.da ?? line.da, line.da],
      [
        'SPECIAL ALLOWANCE',
        fullSpecial,
        fullSpecial,
      ],
      ['OTHER ALLOWANCES', structure?.otherAllowances ?? line.otherAllowances, line.otherAllowances],
      ['STATUTORY BONUS', structure?.statutoryBonus ?? line.statutoryBonus, line.statutoryBonus],
      ['DAILY ALLOWANCE', structure?.dailyAllowance ?? line.dailyAllowance, line.dailyAllowance],
      ['BONUS', line.bonus, line.bonus],
      ['OVERTIME', line.overtime, line.overtime],
      ['INCENTIVE', line.incentive, line.incentive],
      ['ARREARS', line.arrears, line.arrears],
      ['REIMBURSEMENT', line.reimbursement ?? 0, line.reimbursement ?? 0],
    ]
      .filter(([, full, actual]) => full !== 0 || actual !== 0)
      .map(([label, full, actual]) => ({ label: String(label), full: Number(full), actual: Number(actual) }));
    const deductionRows = [
      ['PF', line.eePf],
      ['INSURANCE', line.insurance ?? 0],
      ['ESI', line.eeEsi],
      ['PROFESSIONAL TAX', line.pt],
      ['INCOME TAX', line.tds],
      ['LOAN RECOVERY', line.loanRecovery],
      ['ADVANCE RECOVERY', line.advanceRecovery],
      ['OTHER DEDUCTION', line.otherDeduction],
    ]
      .filter(([, actual]) => actual !== 0)
      .map(([label, actual]) => ({ label: String(label), actual: Number(actual) }));
    const bytes = buildPayslipPdf({
      companyName: employee.tenant.name,
      month,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeCode: employee.employeeCode,
      designation: employee.designation,
      department: employee.department?.name ?? '',
      location: employee.location?.name ?? '',
      bankName: employee.bankName,
      bankAccount: employee.bankAccountNumber,
      paidDays: line.paidDays,
      lopDays: line.lopDays,
      earnings: earningRows,
      deductions: deductionRows,
      totalEarningsFull: earningRows.reduce((sum, row) => sum + row.full, 0),
      totalEarnings: line.gross,
      totalDeductions: line.gross - line.netPay,
      netPay: line.netPay,
      printedAt: new Date(),
    });
    return { bytes, fileName: payslipFileName(month) };
  }

  private async releasePendingDirect(
    tenantId: string,
    month: string,
    rows: Array<{ employeeId: string; employeeCode: string }>,
  ) {
    if (!rows.length) return;
    const codes = new Map(rows.map((row) => [row.employeeId, row.employeeCode]));
    const open = await this.prisma.salaryTransferTransaction.findMany({
      where: {
        tenantId,
        month,
        employeeId: { in: rows.map((row) => row.employeeId) },
        status: { in: ['pending', 'initiated', 'in_progress'] },
      },
      include: { batch: true },
    });
    const locked = open.filter((tx) => tx.batch.status !== 'pending' || tx.status !== 'pending');
    if (locked.length) {
      const names = [...new Set(locked.map((tx) => codes.get(tx.employeeId) ?? tx.employeeId))];
      throw new BadRequestException(
        `${names.join(', ')} already has a direct transfer in progress. Finish or reject that batch before a bank file.`,
      );
    }
    if (!open.length) return;
    await this.prisma.salaryTransferTransaction.updateMany({
      where: { id: { in: open.map((tx) => tx.id) } },
      data: { status: 'skipped', skipReason: 'Moved to a bank file.' },
    });
    const batchIds = [...new Set(open.map((tx) => tx.batchId))];
    for (const batchId of batchIds) {
      const transactions = await this.prisma.salaryTransferTransaction.findMany({ where: { batchId } });
      const payable = transactions.filter((tx) => tx.status === 'pending');
      await this.prisma.salaryTransferBatch.update({
        where: { id: batchId },
        data: {
          willPayCount: payable.length,
          skippedCount: transactions.filter((tx) => tx.status === 'skipped').length,
          totalAmount: payable.reduce((sum, tx) => sum + tx.amount, 0),
          status: payable.length === 0 ? 'rejected' : 'pending',
        },
      });
    }
  }

  private async payoutRows(tenantId: string, month: string) {
    const lines = await this.prisma.salaryLine.findMany({
      where: { tenantId, month, submittedToFinance: true },
      include: { employee: true },
      orderBy: { employee: { employeeCode: 'asc' } },
    });
    return lines.map((line) => ({
      employeeId: line.employeeId,
      employeeCode: line.employee.employeeCode,
      name: `${line.employee.firstName} ${line.employee.lastName}`.trim(),
      bankName: line.employee.bankName,
      ifscCode: line.employee.ifscCode,
      bankAccountNumber: line.employee.bankAccountNumber,
      netPay: line.netPay,
      payoutGenerated: line.payoutGenerated,
      paymentStatus: line.paymentStatus,
      utr: line.utr,
      eligible: bankReady(line.employee.ifscCode, line.employee.bankAccountNumber),
    }));
  }

  private async writeLine(
    tenantId: string,
    employeeId: string,
    month: string,
    adjustments: MonthAdjustments,
    options?: { sendToFinance?: boolean },
  ) {
    const structure = await this.prisma.salaryStructure.findUnique({ where: { employeeId } });
    if (!structure || structure.tenantId !== tenantId) {
      throw new BadRequestException('Save a salary structure before generating pay.');
    }
    const resolved = resolveStructure({
      ...structure,
      taxRegime: structure.taxRegime === 'old' ? 'old' : 'new',
    });
    const prior = await this.priorPay(tenantId, employeeId, month, structure);
    const attendance = (await this.attendance.payByEmployee(tenantId, month)).get(employeeId);
    const reimbursement = await this.reimbursements.amountFor(tenantId, employeeId, month);
    const breakdown = computeSalary(
      resolved,
      month,
      { ...adjustments, reimbursement },
      prior,
      attendance ? { workingDays: attendance.workingDays, payableDays: attendance.payableDays } : undefined,
    );
    if (attendance?.note) {
      breakdown.warning = [breakdown.warning, attendance.note].filter(Boolean).join(' ');
    }
    const previous = await this.prisma.salaryLine.findUnique({
      where: { tenantId_employeeId_month: { tenantId, employeeId, month } },
      select: { submittedToFinance: true, payoutGenerated: true, status: true, paymentStatus: true },
    });
    if (previous?.paymentStatus === 'paid' || previous?.paymentStatus === 'direct') {
      throw new BadRequestException('This salary is already in a bank transfer.');
    }
    const submittedToFinance = Boolean(options?.sendToFinance || previous?.submittedToFinance);
    const payoutGenerated = submittedToFinance ? false : Boolean(previous?.payoutGenerated);
    const { lossOfPay: _lossOfPay, ...payable } = breakdown;
    const data = {
      tenantId,
      employeeId,
      month,
      ...payable,
      monthDays: Math.round(breakdown.monthDays),
      paidDays: Math.round(breakdown.paidDays),
      lopDays: Math.round(breakdown.lopDays),
      submittedToFinance,
      payoutGenerated,
      paymentStatus: submittedToFinance ? 'pending' : previous?.paymentStatus ?? 'pending',
      utr: submittedToFinance ? '' : undefined,
      status: previous?.status === 'locked' ? 'locked' : submittedToFinance ? 'submitted' : 'draft',
    };
    const saved = await this.prisma.salaryLine.upsert({
      where: { tenantId_employeeId_month: { tenantId, employeeId, month } },
      create: data,
      update: data,
    });
    await this.reimbursements.assign(tenantId, employeeId, month);
    return saved;
  }

  private async priorPay(
    tenantId: string,
    employeeId: string,
    month: string,
    structure: StructureRow,
  ): Promise<PriorPay> {
    const { fyStart } = fyPosition(month);
    const lines = await this.prisma.salaryLine.findMany({
      where: { tenantId, employeeId, month: { gte: fyStart, lt: month } },
    });
    return lines.reduce<PriorPay>(
      (sum, line) => ({
        taxableRegular: sum.taxableRegular + line.fixedGross,
        taxableExtras:
          sum.taxableExtras +
          line.bonus +
          statutoryOutsideFixed(line) +
          line.overtime +
          line.incentive +
          line.arrears,
        tdsRegular: sum.tdsRegular + line.tdsRegular,
        tdsExtra: sum.tdsExtra + line.tdsExtra,
        pt: sum.pt + line.pt,
      }),
      {
        taxableRegular: structure.ytdTaxable,
        taxableExtras: 0,
        tdsRegular: structure.ytdTds,
        tdsExtra: 0,
        pt: structure.ytdPt,
      },
    );
  }

  private parseStructure(dto: SaveStructureDto): ResolvedStructure {
    try {
      return resolveStructure({
        monthlyGross: dto.monthlyGross,
        basic: dto.basic,
        hra: dto.hra,
        da: dto.da,
        otherAllowances: dto.otherAllowances,
        dailyAllowance: dto.dailyAllowance,
        statutoryBonus: dto.statutoryBonus,
        ctc: dto.ctc,
        gratuityMonthly: dto.gratuityMonthly,
        leaveEncashment: dto.leaveEncashment,
        insurance: dto.insurance,
        pfOnActual: dto.pfOnActual,
        taxRegime: dto.taxRegime,
        ptMonthly: dto.ptMonthly,
        annualDeductions: dto.annualDeductions,
        rentPaidAnnual: dto.rentPaidAnnual,
        isMetro: dto.isMetro,
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid salary structure.');
    }
  }

  private opening(dto: SaveStructureDto) {
    return {
      ytdTaxable: dto.ytdTaxable ?? 0,
      ytdTds: dto.ytdTds ?? 0,
      ytdPt: dto.ytdPt ?? 0,
    };
  }

  private async requireEmployee(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async assertUnlocked(tenantId: string, employeeId: string, month: string) {
    const existing = await this.prisma.salaryLine.findUnique({
      where: { tenantId_employeeId_month: { tenantId, employeeId, month } },
    });
    if (existing?.status === 'locked') {
      throw new BadRequestException('This month is locked. Unlock it before changing salary.');
    }
  }

  private async ensureTables() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SalaryStructure" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "monthlyGross" INTEGER NOT NULL,
        "basic" INTEGER NOT NULL,
        "hra" INTEGER NOT NULL,
        "da" INTEGER NOT NULL DEFAULT 0,
        "otherAllowances" INTEGER NOT NULL DEFAULT 0,
        "statutoryBonus" INTEGER NOT NULL DEFAULT 0,
        "gratuityMonthly" INTEGER NOT NULL DEFAULT 0,
        "leaveEncashment" INTEGER NOT NULL DEFAULT 0,
        "pfOnActual" BOOLEAN NOT NULL DEFAULT false,
        "taxRegime" TEXT NOT NULL DEFAULT 'new',
        "ptMonthly" INTEGER NOT NULL DEFAULT 0,
        "annualDeductions" INTEGER NOT NULL DEFAULT 0,
        "ytdTaxable" INTEGER NOT NULL DEFAULT 0,
        "ytdTds" INTEGER NOT NULL DEFAULT 0,
        "ytdPt" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SalaryLine" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "month" TEXT NOT NULL,
        "monthDays" INTEGER NOT NULL,
        "paidDays" INTEGER NOT NULL,
        "lopDays" INTEGER NOT NULL DEFAULT 0,
        "basic" INTEGER NOT NULL,
        "hra" INTEGER NOT NULL,
        "da" INTEGER NOT NULL,
        "special" INTEGER NOT NULL,
        "otherAllowances" INTEGER NOT NULL,
        "bonus" INTEGER NOT NULL DEFAULT 0,
        "statutoryBonus" INTEGER NOT NULL DEFAULT 0,
        "overtime" INTEGER NOT NULL DEFAULT 0,
        "incentive" INTEGER NOT NULL DEFAULT 0,
        "arrears" INTEGER NOT NULL DEFAULT 0,
        "leaveEncashment" INTEGER NOT NULL DEFAULT 0,
        "fixedGross" INTEGER NOT NULL,
        "gross" INTEGER NOT NULL,
        "pfWages" INTEGER NOT NULL,
        "eePf" INTEGER NOT NULL,
        "erPf" INTEGER NOT NULL,
        "erEps" INTEGER NOT NULL,
        "erEpf" INTEGER NOT NULL,
        "erEdli" INTEGER NOT NULL,
        "erAdmin" INTEGER NOT NULL,
        "eeEsi" INTEGER NOT NULL,
        "erEsi" INTEGER NOT NULL,
        "pt" INTEGER NOT NULL,
        "tds" INTEGER NOT NULL,
        "tdsRegular" INTEGER NOT NULL,
        "tdsExtra" INTEGER NOT NULL,
        "loanRecovery" INTEGER NOT NULL DEFAULT 0,
        "advanceRecovery" INTEGER NOT NULL DEFAULT 0,
        "otherDeduction" INTEGER NOT NULL DEFAULT 0,
        "netPay" INTEGER NOT NULL,
        "gratuityAccrual" INTEGER NOT NULL,
        "employerCost" INTEGER NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "submittedToFinance" BOOLEAN NOT NULL DEFAULT false,
        "payoutGenerated" BOOLEAN NOT NULL DEFAULT false,
        "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
        "utr" TEXT NOT NULL DEFAULT '',
        "warning" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SalaryLine_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "SalaryStructure_employeeId_key" ON "SalaryStructure"("employeeId")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SalaryStructure_tenantId_idx" ON "SalaryStructure"("tenantId")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "SalaryLine_tenantId_employeeId_month_key" ON "SalaryLine"("tenantId", "employeeId", "month")`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SalaryLine_tenantId_month_idx" ON "SalaryLine"("tenantId", "month")`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "statutoryBonus" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "dailyAllowance" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "dailyAllowance" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "statutoryInGross" BOOLEAN NOT NULL DEFAULT false`,
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE "SalaryStructure" SET "monthlyGross" = "monthlyGross" + "statutoryBonus", "statutoryInGross" = true WHERE "statutoryInGross" = false`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ALTER COLUMN "statutoryInGross" SET DEFAULT true`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "ctc" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "insurance" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "rentPaidAnnual" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "isMetro" BOOLEAN NOT NULL DEFAULT false`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "insurance" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "reimbursement" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "gratuityMonthly" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryStructure" ADD COLUMN IF NOT EXISTS "leaveEncashment" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "leaveEncashment" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE "SalaryLine"
       SET "gross" = "gross" - "leaveEncashment",
           "netPay" = "netPay" - "leaveEncashment",
           "employerCost" = "employerCost" - "leaveEncashment"
       WHERE "leaveEncashment" > 0
         AND "paymentStatus" NOT IN ('paid', 'direct')
         AND "gross" - "fixedGross" - "bonus" - "overtime" - "incentive" - "arrears" = "leaveEncashment"`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "statutoryBonus" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "loanRecovery" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "advanceRecovery" INTEGER NOT NULL DEFAULT 0`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "submittedToFinance" BOOLEAN NOT NULL DEFAULT false`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "payoutGenerated" BOOLEAN NOT NULL DEFAULT false`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'pending'`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "SalaryLine" ADD COLUMN IF NOT EXISTS "utr" TEXT NOT NULL DEFAULT ''`,
    );
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PayrollMonth" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "month" TEXT NOT NULL,
        "approved" BOOLEAN NOT NULL DEFAULT false,
        "approvedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PayrollMonth_pkey" PRIMARY KEY ("id")
      )
    `);
    await this.prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "PayrollMonth_tenantId_month_key" ON "PayrollMonth"("tenantId", "month")`,
    );
    await this.addForeignKey(
      'PayrollMonth_tenantId_fkey',
      `ALTER TABLE "PayrollMonth" ADD CONSTRAINT "PayrollMonth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE`,
    );
    await this.addForeignKey(
      'SalaryStructure_employeeId_fkey',
      `ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE`,
    );
    await this.addForeignKey(
      'SalaryStructure_tenantId_fkey',
      `ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE`,
    );
    await this.addForeignKey(
      'SalaryLine_employeeId_fkey',
      `ALTER TABLE "SalaryLine" ADD CONSTRAINT "SalaryLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE`,
    );
    await this.addForeignKey(
      'SalaryLine_tenantId_fkey',
      `ALTER TABLE "SalaryLine" ADD CONSTRAINT "SalaryLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE`,
    );
  }

  private async addForeignKey(_name: string, sql: string) {
    try {
      await this.prisma.$executeRawUnsafe(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/already exists/i.test(message)) return;
      throw error;
    }
  }
}

function priorFromLines(
  lines: Array<{
    month: string;
    fixedGross: number;
    basic: number;
    hra: number;
    da: number;
    special: number;
    otherAllowances: number;
    bonus: number;
    statutoryBonus: number;
    overtime: number;
    incentive: number;
    arrears: number;
    tdsRegular: number;
    tdsExtra: number;
    pt: number;
  }>,
  month: string,
  structure: { ytdTaxable: number; ytdTds: number; ytdPt: number },
): PriorPay {
  const { fyStart } = fyPosition(month);
  return lines
    .filter((line) => line.month >= fyStart && line.month < month)
    .reduce<PriorPay>(
      (sum, line) => ({
        taxableRegular: sum.taxableRegular + line.fixedGross,
        taxableExtras:
          sum.taxableExtras +
          line.bonus +
          statutoryOutsideFixed(line) +
          line.overtime +
          line.incentive +
          line.arrears,
        tdsRegular: sum.tdsRegular + line.tdsRegular,
        tdsExtra: sum.tdsExtra + line.tdsExtra,
        pt: sum.pt + line.pt,
      }),
      {
        taxableRegular: structure.ytdTaxable,
        taxableExtras: 0,
        tdsRegular: structure.ytdTds,
        tdsExtra: 0,
        pt: structure.ytdPt,
      },
    );
}

function freshenUnpaidLine<
  T extends {
    month: string;
    paymentStatus: string;
    lopDays: number;
    bonus: number;
    overtime: number;
    incentive: number;
    arrears: number;
    loanRecovery: number;
    advanceRecovery: number;
    otherDeduction: number;
    statutoryBonus: number;
    basic: number;
    hra: number;
    da: number;
    special: number;
    otherAllowances: number;
    monthDays: number;
    paidDays: number;
    fixedGross: number;
    tdsRegular: number;
    tdsExtra: number;
    pt: number;
  },
>(
  structure: {
    monthlyGross: number;
    basic: number;
    hra: number;
    da: number;
    otherAllowances: number;
    statutoryBonus: number;
    dailyAllowance: number;
    gratuityMonthly: number;
    leaveEncashment: number;
    pfOnActual: boolean;
    taxRegime: string;
    ptMonthly: number;
    annualDeductions: number;
    ytdTaxable: number;
    ytdTds: number;
    ytdPt: number;
    ctc?: number;
    insurance?: number;
  } | null,
  stored: T | null,
  month: string,
  attendance: { workingDays: number; payableDays: number; note?: string } | null,
  history: T[],
  reimbursement = 0,
): (T & { warning?: string }) | null {
  if (!stored) return null;
  if (!structure || stored.paymentStatus === 'paid' || stored.paymentStatus === 'direct') {
    return presentPayLine(stored, structure?.statutoryBonus ?? 0) as T & { warning?: string };
  }
  try {
    const resolved = resolveStructure({
      ...structure,
      taxRegime: structure.taxRegime === 'old' ? 'old' : 'new',
    });
    const breakdown = computeSalary(
      resolved,
      month,
      {
        lopDays: stored.lopDays,
        bonus: stored.bonus,
        overtime: stored.overtime,
        incentive: stored.incentive,
        arrears: stored.arrears,
        loanRecovery: stored.loanRecovery,
        advanceRecovery: stored.advanceRecovery,
        otherDeduction: stored.otherDeduction,
        reimbursement,
      },
      priorFromLines(history, month, structure),
      attendance && attendance.workingDays > 0
        ? { workingDays: attendance.workingDays, payableDays: attendance.payableDays }
        : undefined,
    );
    return {
      ...stored,
      ...breakdown,
      warning: [breakdown.warning, attendance?.note].filter(Boolean).join(' '),
    } as T & { warning?: string };
  } catch {
    return presentPayLine(stored, structure.statutoryBonus) as T & { warning?: string };
  }
}

function previewPayLine(
  structure: {
    monthlyGross: number;
    basic: number;
    hra: number;
    da: number;
    otherAllowances: number;
    statutoryBonus: number;
    dailyAllowance: number;
    gratuityMonthly: number;
    leaveEncashment: number;
    pfOnActual: boolean;
    taxRegime: string;
    ptMonthly: number;
    annualDeductions: number;
    ytdTaxable: number;
    ytdTds: number;
    ytdPt: number;
    ctc?: number;
    insurance?: number;
  } | null,
  month: string,
  attendance: { workingDays: number; payableDays: number; note?: string } | null,
  history: Parameters<typeof priorFromLines>[0],
  reimbursement = 0,
) {
  if (!structure) return null;
  try {
    const resolved = resolveStructure({
      ...structure,
      taxRegime: structure.taxRegime === 'old' ? 'old' : 'new',
    });
    const breakdown = computeSalary(
      resolved,
      month,
      { reimbursement },
      priorFromLines(history, month, structure),
      attendance && attendance.workingDays > 0
        ? { workingDays: attendance.workingDays, payableDays: attendance.payableDays }
        : undefined,
    );
    return {
      ...breakdown,
      month,
      status: 'preview',
      submittedToFinance: false,
      payoutGenerated: false,
      paymentStatus: 'pending',
      warning: [breakdown.warning, attendance?.note].filter(Boolean).join(' '),
    };
  } catch {
    return null;
  }
}

function asStatementLine(
  line: Omit<StatementLine, 'lossOfPay' | 'insurance' | 'lopDays' | 'reimbursement' | 'tdsRegular' | 'tdsExtra'> & {
    lossOfPay?: number;
    insurance?: number;
    lopDays?: number;
    reimbursement?: number;
    tdsRegular?: number;
    tdsExtra?: number;
  },
): StatementLine {
  return {
    month: line.month,
    basic: line.basic,
    hra: line.hra,
    da: line.da,
    special: line.special,
    otherAllowances: line.otherAllowances,
    bonus: line.bonus,
    statutoryBonus: line.statutoryBonus ?? 0,
    dailyAllowance: line.dailyAllowance ?? 0,
    overtime: line.overtime,
    incentive: line.incentive,
    arrears: line.arrears,
    reimbursement: line.reimbursement ?? 0,
    leaveEncashment: line.leaveEncashment,
    gross: line.gross,
    pfWages: line.pfWages,
    eePf: line.eePf,
    erPf: line.erPf,
    erEps: line.erEps,
    erEpf: line.erEpf,
    erEdli: line.erEdli,
    erAdmin: line.erAdmin,
    eeEsi: line.eeEsi,
    erEsi: line.erEsi,
    pt: line.pt,
    tds: line.tds,
    tdsRegular: line.tdsRegular ?? 0,
    tdsExtra: line.tdsExtra ?? 0,
    loanRecovery: line.loanRecovery ?? 0,
    advanceRecovery: line.advanceRecovery ?? 0,
    otherDeduction: line.otherDeduction,
    lossOfPay: line.lossOfPay ?? 0,
    lopDays: line.lopDays ?? 0,
    insurance: line.insurance ?? 0,
    netPay: line.netPay,
    gratuityAccrual: line.gratuityAccrual,
    employerCost: line.employerCost,
  };
}

function bankReady(ifsc: string, account: string) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase()) && /^\d{9,18}$/.test(account.replace(/\s/g, ''));
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function bankFileCsv(
  template: 'hdfc' | 'icici' | 'sbi' | 'axis',
  month: string,
  rows: Array<{ employeeCode: string; name: string; bankAccountNumber: string; ifscCode: string; netPay: number }>,
) {
  const [year, mon] = month.split('-');
  const label = new Date(Number(year), Number(mon) - 1, 1).toLocaleString('en-IN', { month: 'short' }).toUpperCase();
  const fileName = `${label}_${year}_SALARY.csv`;
  const lines = rows.map((row) => {
    const account = row.bankAccountNumber.replace(/\s/g, '');
    const ifsc = row.ifscCode.trim().toUpperCase();
    if (template === 'hdfc') {
      return [csvCell(row.name), account, ifsc, String(row.netPay), 'SALARY'].join(',');
    }
    if (template === 'icici') {
      return [csvCell(row.employeeCode), csvCell(row.name), account, ifsc, String(row.netPay)].join(',');
    }
    if (template === 'sbi') {
      return [csvCell(row.employeeCode), csvCell(row.name), account, ifsc, String(row.netPay)].join(',');
    }
    return [csvCell(row.name), account, ifsc, String(row.netPay)].join(',');
  });
  const header =
    template === 'hdfc'
      ? 'Beneficiary Name,Account Number,IFSC,Amount,Payment Type'
      : template === 'icici'
        ? 'EMP_CODE,NAME,AC_NO,IFSC,AMOUNT'
        : template === 'sbi'
          ? 'Employee Id,Name,Account,IFSC,Net Salary'
          : 'CustName,AccountNo,IFSC,Amount';
  return { template, fileName, csv: [header, ...lines].join('\n') };
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsv(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsv(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    return row;
  });
}

function splitCsv(line: string) {
  return line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

function integer(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid amount "${value}".`);
  return Math.round(parsed);
}

function optionalInteger(value: string | undefined) {
  if (!value) return undefined;
  return integer(value);
}

function structureFromCsv(row: Record<string, string>): SaveStructureDto {
  const regime = (row.taxRegime || 'new').toLowerCase();
  if (regime !== 'new' && regime !== 'old') throw new Error('taxRegime must be new or old.');
  return {
    monthlyGross: integer(row.monthlyGross),
    basic: optionalInteger(row.basic),
    hra: optionalInteger(row.hra),
    da: optionalInteger(row.da),
    otherAllowances: optionalInteger(row.otherAllowances),
    pfOnActual: ['yes', 'true', '1'].includes((row.pfOnActual || '').toLowerCase()),
    taxRegime: regime,
    ptMonthly: optionalInteger(row.ptMonthly),
    annualDeductions: optionalInteger(row.annualDeductions),
    rentPaidAnnual: optionalInteger(row.rentPaidAnnual),
    isMetro: ['yes', 'true', '1'].includes((row.isMetro || '').toLowerCase()),
    ytdTaxable: optionalInteger(row.ytdTaxable),
    ytdTds: optionalInteger(row.ytdTds),
    ytdPt: optionalInteger(row.ytdPt),
  };
}
