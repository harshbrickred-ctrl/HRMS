import {
  annualTax,
  computeSalary,
  fyPosition,
  hraExemption,
  resolveStructure,
  structureFromCtc,
} from './salary-calc';
import { buildStatement } from './salary-statement';

describe('salary calc', () => {
  const structure = resolveStructure({
    monthlyGross: 120_000,
    basic: 60_000,
    hra: 30_000,
    da: 0,
    otherAllowances: 0,
    taxRegime: 'new',
    ptMonthly: 200,
  });

  it('splits a 50% basic and leaves special as the balance', () => {
    expect(structure.special).toBe(30_000);
    expect(resolveStructure({ monthlyGross: 100_000 }).basic).toBe(50_000);
  });

  it('uses full-year CTC for November TDS when brought-forward YTD is blank', () => {
    const shaped = resolveStructure({ ctc: 1_500_000, taxRegime: 'new' });
    expect(shaped.monthlyGross).toBe(125_000);
    const line = computeSalary(
      shaped,
      '2026-11',
      {},
      { taxableRegular: 0, taxableExtras: 0, tdsRegular: 0, tdsExtra: 0, pt: 0 },
    );
    expect(annualTax(1_500_000, 'new', 0, 0)).toBe(97_500);
    expect(line.tdsRegular).toBe(8_125);
    expect(line.tds).toBe(8_125);
  });

  it('matches the November 2026 worked example', () => {
    expect(fyPosition('2026-11').monthsLeft).toBe(5);
    expect(annualTax(1_440_000, 'new', 0, 0)).toBe(88_140);
    expect(annualTax(1_640_000, 'new', 0, 0)).toBe(119_340);

    const line = computeSalary(
      structure,
      '2026-11',
      { bonus: 200_000 },
      {
        taxableRegular: 7 * 120_000,
        taxableExtras: 0,
        tdsRegular: 7 * 7_345,
        tdsExtra: 0,
        pt: 7 * 200,
      },
    );

    expect(line.pfWages).toBe(25_000);
    expect(line.eePf).toBe(3_000);
    expect(line.erEps).toBe(2_083);
    expect(line.erEpf).toBe(917);
    expect(line.erEdli).toBe(125);
    expect(line.erAdmin).toBe(125);
    expect(line.tdsRegular).toBe(7_345);
    expect(line.tdsExtra).toBe(31_200);
    expect(line.tds).toBe(38_545);
    expect(line.gross).toBe(320_000);
    expect(line.netPay).toBe(278_255);
    expect(line.gratuityAccrual).toBe(52_000);
    expect(line.employerCost).toBe(375_250);

    const payslip = { ...line, month: '2026-11' };
    const statement = buildStatement(payslip, [payslip], 'new', 0, false);
    expect(statement.earnings.find((row) => row.id === 'SAL-20')?.month).toBe(320_000);
    expect(statement.earnings.find((row) => row.id === 'SAL-16')?.month).toBe(200_000);
    expect(statement.earnings.find((row) => row.id === 'SAL-18')).toBeUndefined();
    expect(statement.netPay).toBe(278_255);
    expect(statement.deductions.find((row) => row.id === 'PF-02')?.month).toBe(3_000);
    expect(statement.form130.find((row) => row.id === 'F-08')?.amount).toBe(320_000);
    expect(statement.checks.every((check) => check.ok)).toBe(true);
  });

  it('calculates gratuity and leave encashment from basic and keeps them out of gross', () => {
    const shaped = resolveStructure({
      monthlyGross: 100_000,
      basic: 50_000,
      hra: 20_000,
      statutoryBonus: 5_000,
      leaveEncashment: 2_000,
      gratuityMonthly: 1_500,
    });
    const line = computeSalary(
      shaped,
      '2026-11',
      {},
      { taxableRegular: 0, taxableExtras: 0, tdsRegular: 0, tdsExtra: 0, pt: 0 },
    );
    expect(shaped.special).toBe(25_000);
    expect(shaped.gratuityMonthly).toBe(43_333);
    expect(shaped.leaveEncashment).toBe(25_000);
    expect(line.special).toBe(25_000);
    expect(line.bonus).toBe(0);
    expect(line.statutoryBonus).toBe(5_000);
    expect(line.leaveEncashment).toBe(25_000);
    expect(line.fixedGross).toBe(100_000);
    expect(line.gross).toBe(100_000);
    expect(line.gratuityAccrual).toBe(43_333);
  });

  it('adds basic, HRA, special, statutory bonus and daily allowance, and leaves gratuity and leave encashment out of gross', () => {
    const shaped = resolveStructure({
      monthlyGross: 75_000,
      basic: 30_000,
      hra: 20_000,
      statutoryBonus: 10_000,
      dailyAllowance: 5_000,
      gratuityMonthly: 12_000,
      leaveEncashment: 20_000,
    });
    const line = computeSalary(
      shaped,
      '2026-11',
      {},
      { taxableRegular: 0, taxableExtras: 0, tdsRegular: 0, tdsExtra: 0, pt: 0 },
    );
    expect(shaped.special).toBe(10_000);
    expect(line.gross).toBe(75_000);
    expect(line.dailyAllowance).toBe(5_000);
    expect(line.gratuityAccrual).toBe(26_000);
    expect(line.leaveEncashment).toBe(15_000);
    expect(line.employerCost).toBeGreaterThan(line.gross);
  });

  it('pays a month bonus separately and deducts loan, advance, and other amounts', () => {
    const line = computeSalary(
      structure,
      '2026-11',
      { bonus: 2_000, overtime: 1_000, incentive: 2_000, loanRecovery: 1_000, advanceRecovery: 0, otherDeduction: 0 },
      { taxableRegular: 0, taxableExtras: 0, tdsRegular: 0, tdsExtra: 0, pt: 0 },
    );
    expect(line.bonus).toBe(2_000);
    expect(line.statutoryBonus).toBe(0);
    expect(line.overtime).toBe(1_000);
    expect(line.incentive).toBe(2_000);
    expect(line.gross).toBe(125_000);
    expect(line.loanRecovery).toBe(1_000);
    expect(line.advanceRecovery).toBe(0);
    expect(line.netPay).toBe(line.gross - line.eePf - line.eeEsi - line.pt - line.tds - 1_000);

    const payslip = { ...line, month: '2026-11' };
    const statement = buildStatement(payslip, [payslip], 'new', 0, false);
    expect(statement.earnings.find((row) => row.id === 'SAL-16')?.label).toBe('Bonus');
    expect(statement.earnings.find((row) => row.id === 'SAL-17')?.month).toBe(2_000);
    expect(statement.earnings.find((row) => row.id === 'SAL-15')?.month).toBe(1_000);
    expect(statement.deductions.find((row) => row.id === 'NET-02')?.month).toBe(1_000);
    expect(statement.deductions.find((row) => row.id === 'NET-03')).toBeUndefined();
    expect(statement.deductions.find((row) => row.id === 'NET-01')).toBeUndefined();
    expect(statement.checks.find((check) => check.id === 'V-02')?.ok).toBe(true);
  });

  it('prorates a month by payable working days from attendance', () => {
    const line = computeSalary(
      structure,
      '2026-11',
      {},
      { taxableRegular: 0, taxableExtras: 0, tdsRegular: 0, tdsExtra: 0, pt: 0 },
      { workingDays: 26, payableDays: 25 },
    );
    expect(line.monthDays).toBe(26);
    expect(line.paidDays).toBe(25);
    expect(line.lopDays).toBe(1);
    expect(line.basic).toBe(60_000);
    expect(line.fixedGross).toBe(120_000);
    expect(line.lossOfPay).toBe(Math.round(120_000 / 26));
    expect(line.netPay).toBe(line.gross - line.eePf - line.eeEsi - line.pt - line.tds - line.lossOfPay);
  });

  it('derives one month of pay from yearly CTC', () => {
    const shaped = structureFromCtc(1_200_000);
    expect(shaped.ctc).toBe(1_200_000);
    expect(shaped.basic).toBe(50_000);
    expect(shaped.hra).toBe(25_000);
    expect(shaped.pf).toBe(3_000);
    expect(shaped.statutoryBonus).toBe(1_400);
    expect(shaped.special).toBe(23_600);
    expect(shaped.gratuityMonthly).toBe(43_333);
    expect(shaped.leaveEncashment).toBe(25_000);
    expect(shaped.monthlyGross).toBe(1_00_000);
    expect(resolveStructure({ monthlyGross: 0, ctc: 1_200_000 }).special).toBe(23_600);
    const insured = resolveStructure({ monthlyGross: 0, ctc: 1_200_000, insurance: 2_000 });
    const line = computeSalary(
      insured,
      '2026-11',
      {},
      { taxableRegular: 0, taxableExtras: 0, tdsRegular: 0, tdsExtra: 0, pt: 0 },
    );
    expect(line.eePf).toBe(3_000);
    expect(line.insurance).toBe(2_000);
    expect(line.gross).toBe(100_000);
    expect(line.netPay).toBe(line.gross - line.eePf - line.eeEsi - line.pt - line.tds - line.insurance);
  });

  it('adds an approved reimbursement to gross and net without raising PF', () => {
    const shaped = structureFromCtc(1_200_000);
    const line = computeSalary(
      shaped,
      '2026-11',
      { reimbursement: 1_500 },
      { taxableRegular: 0, taxableExtras: 0, tdsRegular: 0, tdsExtra: 0, pt: 0 },
    );
    expect(line.reimbursement).toBe(1_500);
    expect(line.gross).toBe(101_500);
    expect(line.eePf).toBe(3_000);
    expect(line.netPay).toBe(line.gross - line.eePf - line.eeEsi - line.pt - line.tds - line.insurance);
  });

  it('rejects a structure whose components exceed gross', () => {
    expect(() => resolveStructure({ monthlyGross: 50_000, basic: 40_000, hra: 20_000 })).toThrow(
      /Special allowance/,
    );
  });

  it('computes section 10(13A) HRA exemption for old regime TDS', () => {
    expect(hraExemption(600_000, 0, 300_000, 360_000, true)).toBe(300_000);
    expect(hraExemption(600_000, 0, 300_000, 120_000, false)).toBe(60_000);

    const shaped = resolveStructure({
      monthlyGross: 100_000,
      basic: 50_000,
      hra: 25_000,
      taxRegime: 'old',
      annualDeductions: 150_000,
      rentPaidAnnual: 300_000,
      isMetro: true,
      ptMonthly: 200,
    });
    const withoutRent = resolveStructure({
      monthlyGross: 100_000,
      basic: 50_000,
      hra: 25_000,
      taxRegime: 'old',
      annualDeductions: 150_000,
      ptMonthly: 200,
    });
    const withHra = computeSalary(
      shaped,
      '2026-04',
      {},
      { taxableRegular: 0, taxableExtras: 0, tdsRegular: 0, tdsExtra: 0, pt: 0 },
    );
    const noHra = computeSalary(
      withoutRent,
      '2026-04',
      {},
      { taxableRegular: 0, taxableExtras: 0, tdsRegular: 0, tdsExtra: 0, pt: 0 },
    );
    expect(withHra.tds).toBeLessThan(noHra.tds);

    const statement = buildStatement(
      { ...withHra, month: '2026-04' },
      [{ ...withHra, month: '2026-04' }],
      'old',
      150_000,
      false,
      {
        rentPaidAnnual: 300_000,
        isMetro: true,
        monthlyBasic: 50_000,
        monthlyHra: 25_000,
        monthlyDa: 0,
      },
    );
    expect(statement.form130.find((row) => row.id === 'F-09')?.amount).toBeGreaterThan(0);
  });
});
