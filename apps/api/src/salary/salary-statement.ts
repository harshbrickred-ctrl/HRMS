import { fyPosition, taxParts, type TaxRegime } from './salary-calc';

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
  loanRecovery: number;
  advanceRecovery: number;
  otherDeduction: number;
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
  netPayYtd: number;
  employer: SheetRow[];
  ytdMonths: Array<{ month: string; gross: number; deductions: number; net: number; pf: number; tds: number }>;
  form130: FormRow[];
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
    loanRecovery: 0,
    advanceRecovery: 0,
    otherDeduction: 0,
    netPay: 0,
    gratuityAccrual: 0,
    employerCost: 0,
  };
  return lines.reduce((total, line) => {
    (Object.keys(zero) as Array<keyof Totals>).forEach((key) => {
      if (key === 'month') return;
      total[key] += line[key];
    });
    return total;
  }, zero);
}

function row(id: string, label: string, month: number, ytd: number, keepZero = false): SheetRow | null {
  if (!keepZero && month === 0 && ytd === 0) return null;
  return { id, label, month, ytd };
}

export function buildStatement(
  current: StatementLine,
  fyLines: StatementLine[],
  regime: TaxRegime,
  annualDeductions: number,
  pfOnActual: boolean,
): SalaryStatement {
  const through = fyLines.filter((line) => line.month <= current.month);
  const ytd = sumLines(through);
  const earnings = [
    row('SAL-04', 'Basic', current.basic, ytd.basic, true),
    row('SAL-05', 'House rent allowance', current.hra, ytd.hra, true),
    row('DA', 'Dearness allowance', current.da, ytd.da),
    row('SAL-07', 'Special allowance', current.special, ytd.special, true),
    row('SAL-08', 'Other fixed allowances', current.otherAllowances, ytd.otherAllowances),
    row('SAL-15', 'Overtime', current.overtime, ytd.overtime),
    row('SAL-17', 'Incentive', current.incentive, ytd.incentive),
    row('SAL-16', 'Bonus', current.bonus, ytd.bonus),
    row('SAL-18', 'Statutory bonus', current.statutoryBonus, ytd.statutoryBonus),
    row('SAL-09', 'Daily allowance', current.dailyAllowance, ytd.dailyAllowance),
    row('SAL-19', 'Arrears', current.arrears, ytd.arrears),
    row('SAL-20', 'Gross earnings', current.gross, ytd.gross, true),
  ].filter((item): item is SheetRow => Boolean(item));

  const deductions = [
    row('PF-02', 'Employee PF', current.eePf, ytd.eePf, true),
    row('ESI-03', 'Employee ESI', current.eeEsi, ytd.eeEsi),
    row('PT-01', 'Professional tax', current.pt, ytd.pt, true),
    row('TDS-20', 'TDS on salary', current.tds, ytd.tds, true),
    row('NET-02', 'Loan recovery', current.loanRecovery, ytd.loanRecovery),
    row('NET-03', 'Advance recovery', current.advanceRecovery, ytd.advanceRecovery),
    row('NET-01', 'Other deduction', current.otherDeduction, ytd.otherDeduction),
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

  const tax = taxParts(ytd.gross, regime, annualDeductions, regime === 'old' ? Math.min(2_500, ytd.pt) : 0);
  const salaryIncome = ytd.gross;
  const balance = salaryIncome;
  const form130: FormRow[] = [
    { id: 'F-08', label: 'Gross salary paid this year', amount: salaryIncome },
    { id: 'F-09', label: 'Exempt allowances', amount: regime === 'new' ? 0 : 0 },
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
    current.eePf + current.eeEsi + current.pt + current.tds + current.loanRecovery + current.advanceRecovery + current.otherDeduction;
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
      ok: current.special >= 0,
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
    paidDaysNote: `${fyPosition(current.month).n} of 12 in the financial year. Form 130 here is the paid-to-date certificate, not the March original.`,
    earnings,
    deductions,
    netPay: current.netPay,
    netPayYtd: ytd.netPay,
    employer,
    ytdMonths: [...through]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((line) => ({
        month: line.month,
        gross: line.gross,
        deductions:
          line.eePf + line.eeEsi + line.pt + line.tds + line.loanRecovery + line.advanceRecovery + line.otherDeduction,
        net: line.netPay,
        pf: line.eePf,
        tds: line.tds,
      })),
    form130,
    checks,
  };
}
