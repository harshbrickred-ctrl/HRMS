import {
  buildTaxBreakdown,
  fyPosition,
  hraExemption,
  rupees,
  taxParts,
  type TaxBreakdown,
  type TaxRegime,
} from './salary-calc';

export type StatementLine = {
  month: string;
  basic: number;
  hra: number;
  da: number;
  special: number;
  otherAllowances: number;
  bonus: number;
  statutoryBonus: number;
  dailyAllowance: number;
  overtime: number;
  incentive: number;
  arrears: number;
  reimbursement: number;
  leaveEncashment: number;
  gross: number;
  pfWages: number;
  eePf: number;
  erPf: number;
  erEps: number;
  erEpf: number;
  erEdli: number;
  erAdmin: number;
  eeEsi: number;
  erEsi: number;
  pt: number;
  tds: number;
  tdsRegular: number;
  tdsExtra: number;
  loanRecovery: number;
  advanceRecovery: number;
  otherDeduction: number;
  lossOfPay: number;
  lopDays: number;
  insurance: number;
  netPay: number;
  gratuityAccrual: number;
  employerCost: number;
};

export type SheetRow = { id: string; label: string; month: number; ytd: number };
export type FormRow = { id: string; label: string; amount: number };
export type CheckRow = { id: string; ok: boolean; detail: string };

export type SalaryStatement = {
  month: string;
  paidDaysNote: string;
  earnings: SheetRow[];
  deductions: SheetRow[];
  netPay: number;
  lopDays: number;
  netPayYtd: number;
  employer: SheetRow[];
  ytdMonths: Array<{ month: string; gross: number; deductions: number; net: number; pf: number; tds: number }>;
  form130: FormRow[];
  taxBreakdown: TaxBreakdown;
  checks: CheckRow[];
};

type Totals = Record<keyof StatementLine, number>;

function sumLines(lines: StatementLine[]): Totals {
  const zero = {
    month: 0,
    basic: 0,
    hra: 0,
    da: 0,
    special: 0,
    otherAllowances: 0,
    bonus: 0,
    statutoryBonus: 0,
    dailyAllowance: 0,
    overtime: 0,
    incentive: 0,
    arrears: 0,
    reimbursement: 0,
    leaveEncashment: 0,
    gross: 0,
    pfWages: 0,
    eePf: 0,
    erPf: 0,
    erEps: 0,
    erEpf: 0,
    erEdli: 0,
    erAdmin: 0,
    eeEsi: 0,
    erEsi: 0,
    pt: 0,
    tds: 0,
    tdsRegular: 0,
    tdsExtra: 0,
    loanRecovery: 0,
    advanceRecovery: 0,
    otherDeduction: 0,
    lossOfPay: 0,
    lopDays: 0,
    insurance: 0,
    netPay: 0,
    gratuityAccrual: 0,
    employerCost: 0,
  };
  return lines.reduce((total, line) => {
    (Object.keys(zero) as Array<keyof Totals>).forEach((key) => {
      if (key === 'month') return;
      total[key] += line[key] ?? 0;
    });
    return total;
  }, zero);
}

function payslipSpecial(line: StatementLine) {
  return line.special;
}

function row(id: string, label: string, month: number, ytd: number, keepZero = false): SheetRow | null {
  if (!keepZero && month === 0 && ytd === 0) return null;
  return { id, label, month, ytd };
}

export type StatementTaxInput = {
  rentPaidAnnual?: number;
  isMetro?: boolean;
  monthlyBasic?: number;
  monthlyHra?: number;
  monthlyDa?: number;
};

export function buildStatement(
  current: StatementLine,
  fyLines: StatementLine[],
  regime: TaxRegime,
  annualDeductions: number,
  pfOnActual: boolean,
  taxInput: StatementTaxInput = {},
): SalaryStatement {
  const through = fyLines.filter((line) => line.month <= current.month);
  if (!through.some((line) => line.month === current.month)) through.push(current);
  const ytd = sumLines(through);
  const monthsPaid = Math.max(1, through.length);
  const monthlyBasic = taxInput.monthlyBasic ?? rupees(ytd.basic / monthsPaid);
  const monthlyHra = taxInput.monthlyHra ?? rupees(ytd.hra / monthsPaid);
  const monthlyDa = taxInput.monthlyDa ?? rupees(ytd.da / monthsPaid);
  const annualExempt =
    regime === 'old'
      ? hraExemption(
          monthlyBasic * 12,
          monthlyDa * 12,
          monthlyHra * 12,
          taxInput.rentPaidAnnual ?? 0,
          Boolean(taxInput.isMetro),
        )
      : 0;
  const exemptAllowances = rupees((annualExempt * monthsPaid) / 12);
  const special = payslipSpecial(current);
  const lopLabel =
    current.lopDays > 0
      ? `Loss of pay (${current.lopDays} day${current.lopDays === 1 ? '' : 's'} deducted)`
      : 'Loss of pay';
  const earnings = [
    row('SAL-04', 'Basic', current.basic, ytd.basic, true),
    row('SAL-05', 'House rent allowance', current.hra, ytd.hra, true),
    row('DA', 'Dearness allowance', current.da, ytd.da),
    row('SAL-07', 'Special allowance', special, ytd.special, true),
    row('SAL-08', 'Other fixed allowances', current.otherAllowances, ytd.otherAllowances),
    row('SAL-15', 'Overtime', current.overtime, ytd.overtime),
    row('SAL-17', 'Incentive', current.incentive, ytd.incentive),
    row('SAL-16', 'Bonus', current.bonus, ytd.bonus),
    row('SAL-18', 'Statutory bonus', current.statutoryBonus, ytd.statutoryBonus),
    row('SAL-09', 'Daily allowance', current.dailyAllowance, ytd.dailyAllowance),
    row('SAL-19', 'Arrears', current.arrears, ytd.arrears),
    row('REIM-01', 'Reimbursement', current.reimbursement, ytd.reimbursement),
    row('SAL-20', 'Gross earnings', current.gross, ytd.gross, true),
  ].filter((item): item is SheetRow => Boolean(item));

  const deductions = [
    row('PF-02', 'Employee PF', current.eePf, ytd.eePf, true),
    row('INS-01', 'Insurance', current.insurance, ytd.insurance),
    row('ESI-03', 'Employee ESI', current.eeEsi, ytd.eeEsi),
    row('PT-01', 'Professional tax', current.pt, ytd.pt, true),
    row('TDS-20', 'TDS on salary', current.tds, ytd.tds, true),
    row('NET-02', 'Loan recovery', current.loanRecovery, ytd.loanRecovery),
    row('NET-03', 'Advance recovery', current.advanceRecovery, ytd.advanceRecovery),
    row('NET-01', 'Other deduction', current.otherDeduction, ytd.otherDeduction),
    row('LOP-01', lopLabel, current.lossOfPay, ytd.lossOfPay, true),
  ].filter((item): item is SheetRow => Boolean(item));

  const employer = [
    row('PF-03', 'Employer PF (12%)', current.erPf, ytd.erPf, true),
    row('PF-04', 'Employer pension (EPS)', current.erEps, ytd.erEps, true),
    row('PF-05', 'Employer EPF balance', current.erEpf, ytd.erEpf, true),
    row('PF-06', 'EDLI', current.erEdli, ytd.erEdli, true),
    row('PF-07', 'PF admin charge', current.erAdmin, ytd.erAdmin, true),
    row('ESI-04', 'Employer ESI', current.erEsi, ytd.erEsi),
    row('GR-02', 'Gratuity accrual', current.gratuityAccrual, ytd.gratuityAccrual, true),
    row('SAL-22', 'Employer cost', current.employerCost, ytd.employerCost, true),
  ].filter((item): item is SheetRow => Boolean(item));

  const ptAnnual = regime === 'old' ? Math.min(2_500, ytd.pt) : 0;
  const tax = taxParts(ytd.gross, regime, annualDeductions, ptAnnual, exemptAllowances);
  const salaryIncome = ytd.gross;
  const { monthsLeft } = fyPosition(current.month);
  const taxBreakdown = buildTaxBreakdown(ytd.gross, regime, annualDeductions, ptAnnual, exemptAllowances, {
    incomeLabel: 'Gross salary paid this year',
    ytdTds: ytd.tds,
    monthTds: current.tds,
    monthTdsRegular: current.tdsRegular,
    monthTdsExtra: current.tdsExtra,
    monthsLeft,
  });
  const form130: FormRow[] = [
    { id: 'F-08', label: 'Gross salary paid this year', amount: salaryIncome },
    { id: 'F-09', label: 'Exempt allowances (HRA)', amount: tax.exemptAllowances },
    { id: 'F-11', label: 'Standard deduction', amount: tax.stdDed },
    { id: 'F-11b', label: 'Professional tax deduction', amount: tax.ptDed },
    { id: 'F-15', label: 'Chapter VI-A deductions', amount: tax.chapter6 },
    { id: 'F-17', label: 'Taxable income', amount: tax.taxable },
    { id: 'F-18', label: 'Tax on taxable income', amount: tax.slab },
    { id: 'F-19', label: 'Rebate', amount: tax.rebate },
    { id: 'F-20', label: 'Surcharge', amount: tax.surcharge },
    { id: 'F-21', label: 'Health and education cess', amount: tax.cess },
    { id: 'F-22', label: 'Tax payable on salary paid to date', amount: tax.total },
    { id: 'F-25', label: 'TDS deducted to date', amount: ytd.tds },
    { id: 'F-26', label: 'Shortfall (positive) or excess TDS (negative)', amount: tax.total - ytd.tds },
  ];

  const employeeDeductions =
    current.eePf +
    current.eeEsi +
    current.pt +
    current.tds +
    current.loanRecovery +
    current.advanceRecovery +
    current.otherDeduction +
    current.lossOfPay +
    current.insurance;
  const ceiling = current.month < '2026-09' ? 15_000 : 25_000;
  const epsMax = current.month < '2026-09' ? 1_250 : 2_083;
  const checks: CheckRow[] = [
    {
      id: 'V-02',
      ok: current.gross - employeeDeductions === current.netPay,
      detail: 'Gross minus employee deductions equals net pay.',
    },
    {
      id: 'V-03',
      ok: current.netPay >= 0,
      detail: 'Net pay is not negative.',
    },
    {
      id: 'V-04',
      ok: special >= 0,
      detail: 'Special allowance is not negative.',
    },
    {
      id: 'V-05',
      ok: pfOnActual || current.pfWages <= ceiling,
      detail: `PF wages stay within the ₹${ceiling.toLocaleString('en-IN')} ceiling unless PF is on actual wages.`,
    },
    {
      id: 'V-06',
      ok: current.erPf === current.eePf && current.erEps <= epsMax && current.erEpf === current.erPf - current.erEps,
      detail: 'Employer PF equals employee PF, and EPS plus EPF equals that 12%.',
    },
    {
      id: 'V-08',
      ok: ytd.pt <= 2_500,
      detail: 'Professional tax this year is within the ₹2,500 cap.',
    },
    {
      id: 'V-09',
      ok: current.tds >= 0,
      detail: 'TDS for the month is not negative.',
    },
    {
      id: 'YTD-02',
      ok: through.reduce((sum, line) => sum + line.gross, 0) === ytd.gross,
      detail: 'Year-to-date gross is the sum of locked and draft lines, not a typed total.',
    },
  ];

  return {
    month: current.month,
    paidDaysNote: `${fyPosition(current.month).n} of 12 in the financial year.`,
    earnings,
    deductions,
    netPay: current.netPay,
    lopDays: current.lopDays,
    netPayYtd: ytd.netPay,
    employer,
    ytdMonths: [...through]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((line) => ({
        month: line.month,
        gross: line.gross,
        deductions:
          line.eePf +
          line.eeEsi +
          line.pt +
          line.tds +
          line.loanRecovery +
          line.advanceRecovery +
          line.otherDeduction +
          line.lossOfPay +
          line.insurance,
        net: line.netPay,
        pf: line.eePf,
        tds: line.tds,
      })),
    form130,
    taxBreakdown,
    checks,
  };
}
