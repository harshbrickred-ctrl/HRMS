export type TaxRegime = 'new' | 'old';

export type StructureInput = {
  monthlyGross: number;
  basic?: number;
  hra?: number;
  da?: number;
  otherAllowances?: number;
  statutoryBonus?: number;
  dailyAllowance?: number;
  gratuityMonthly?: number;
  leaveEncashment?: number;
  pfOnActual?: boolean;
  taxRegime?: TaxRegime;
  ptMonthly?: number;
  annualDeductions?: number;
};

export type ResolvedStructure = {
  monthlyGross: number;
  basic: number;
  hra: number;
  da: number;
  otherAllowances: number;
  special: number;
  statutoryBonus: number;
  dailyAllowance: number;
  gratuityMonthly: number;
  leaveEncashment: number;
  pfOnActual: boolean;
  taxRegime: TaxRegime;
  ptMonthly: number;
  annualDeductions: number;
};

export type MonthAdjustments = {
  lopDays?: number;
  bonus?: number;
  overtime?: number;
  incentive?: number;
  arrears?: number;
  loanRecovery?: number;
  advanceRecovery?: number;
  otherDeduction?: number;
};

export type PriorPay = {
  taxableRegular: number;
  taxableExtras: number;
  tdsRegular: number;
  tdsExtra: number;
  pt: number;
};

export type SalaryBreakdown = {
  monthDays: number;
  paidDays: number;
  lopDays: number;
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
  fixedGross: number;
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
  netPay: number;
  gratuityAccrual: number;
  employerCost: number;
  warning: string;
};

const NEW_SLABS: Array<[number, number]> = [
  [400_000, 0],
  [800_000, 5],
  [1_200_000, 10],
  [1_600_000, 15],
  [2_000_000, 20],
  [2_400_000, 25],
  [Number.POSITIVE_INFINITY, 30],
];

const OLD_SLABS: Array<[number, number]> = [
  [250_000, 0],
  [500_000, 5],
  [1_000_000, 20],
  [Number.POSITIVE_INFINITY, 30],
];

export function rupees(value: number) {
  return Math.round(value);
}

/** Older paid lines kept statutory bonus outside fixed gross. New lines include it in monthly gross. */
export function statutoryOutsideFixed(line: {
  fixedGross: number;
  basic: number;
  hra: number;
  da: number;
  special: number;
  otherAllowances: number;
  statutoryBonus?: number;
}) {
  const statutory = line.statutoryBonus ?? 0;
  if (statutory <= 0) return 0;
  const withStatutory = line.basic + line.hra + line.da + line.special + line.otherAllowances + statutory;
  return line.fixedGross + 1 >= withStatutory ? 0 : statutory;
}

/** Older lines stored statutory bonus inside `bonus`. Split that for display and regeneration. */
export function presentPayLine<
  T extends { bonus: number; statutoryBonus?: number; monthDays: number; paidDays: number },
>(line: T, structureStatutory: number): T & { statutoryBonus: number } {
  const statutoryStored = line.statutoryBonus ?? 0;
  if (statutoryStored > 0) return { ...line, statutoryBonus: statutoryStored };
  const ratio = line.monthDays > 0 ? line.paidDays / line.monthDays : 0;
  const prorated = rupees(Math.max(0, structureStatutory) * ratio);
  const monthBonus = prorated > 0 && line.bonus >= prorated ? line.bonus - prorated : line.bonus;
  return { ...line, bonus: monthBonus, statutoryBonus: line.bonus - monthBonus };
}

export function monthDaysOf(month: string) {
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon, 0).getDate();
}

/** April = 1 … March = 12. Months left include the payroll month. */
export function fyPosition(month: string) {
  const [year, mon] = month.split('-').map(Number);
  const n = ((mon - 4 + 12) % 12) + 1;
  const startYear = mon >= 4 ? year : year - 1;
  return { n, monthsLeft: 13 - n, fyStart: `${startYear}-04` };
}

export function resolveStructure(input: StructureInput): ResolvedStructure {
  const monthlyGross = rupees(input.monthlyGross);
  if (monthlyGross < 0) throw new Error('Monthly gross cannot be negative.');
  const basic = input.basic == null || input.basic <= 0 ? rupees(monthlyGross * 0.5) : rupees(input.basic);
  const hra = input.hra == null ? rupees(basic * 0.4) : rupees(input.hra);
  const da = rupees(input.da ?? 0);
  const otherAllowances = rupees(input.otherAllowances ?? 0);
  const statutoryBonus = Math.max(0, rupees(input.statutoryBonus ?? 0));
  const dailyAllowance = Math.max(0, rupees(input.dailyAllowance ?? 0));
  const special = monthlyGross - basic - hra - da - otherAllowances - statutoryBonus - dailyAllowance;
  if (special < 0) {
    throw new Error('Special allowance would be negative. Lower basic, HRA, DA, other allowances, or statutory bonus.');
  }
  const taxRegime: TaxRegime = input.taxRegime === 'old' ? 'old' : 'new';
  return {
    monthlyGross,
    basic,
    hra,
    da,
    otherAllowances,
    special,
    statutoryBonus,
    dailyAllowance,
    gratuityMonthly: Math.max(0, rupees(input.gratuityMonthly ?? 0)),
    leaveEncashment: Math.max(0, rupees(input.leaveEncashment ?? 0)),
    pfOnActual: Boolean(input.pfOnActual),
    taxRegime,
    ptMonthly: Math.max(0, rupees(input.ptMonthly ?? 0)),
    annualDeductions: Math.max(0, rupees(input.annualDeductions ?? 0)),
  };
}

function pfWageBase(month: string, wages: number, pfOnActual: boolean) {
  if (pfOnActual) return wages;
  if (month === '2026-09') {
    const first = Math.min((wages * 16) / 30, (15_000 * 16) / 30);
    const second = Math.min((wages * 14) / 30, (25_000 * 14) / 30);
    return first + second;
  }
  const ceiling = month < '2026-09' ? 15_000 : 25_000;
  return Math.min(wages, ceiling);
}

function epsCap(month: string) {
  return month < '2026-09' ? 1_250 : 2_083;
}

function pfCeiling(month: string) {
  return month < '2026-09' ? 15_000 : 25_000;
}

function slabTax(taxable: number, slabs: Array<[number, number]>) {
  let tax = 0;
  let prev = 0;
  for (const [upper, percent] of slabs) {
    const slice = Math.max(0, Math.min(taxable, upper) - prev);
    tax += (slice * percent) / 100;
    prev = upper;
  }
  return tax;
}

export type TaxParts = {
  stdDed: number;
  chapter6: number;
  ptDed: number;
  taxable: number;
  slab: number;
  rebate: number;
  surcharge: number;
  cess: number;
  total: number;
};

export function taxParts(
  projectedSalary: number,
  regime: TaxRegime,
  annualDeductions: number,
  ptAnnual: number,
): TaxParts {
  const salary = Math.max(0, projectedSalary);
  const stdDed = Math.min(salary, regime === 'new' ? 75_000 : 50_000);
  const chapter6 = regime === 'old' ? Math.min(150_000, Math.max(0, annualDeductions)) : 0;
  const ptDed = regime === 'old' ? Math.min(2_500, Math.max(0, ptAnnual)) : 0;
  const taxable = Math.round(Math.max(0, salary - stdDed - chapter6 - ptDed) / 10) * 10;
  const slab = slabTax(taxable, regime === 'new' ? NEW_SLABS : OLD_SLABS);
  let afterRebate = slab;
  if (regime === 'new') {
    afterRebate = taxable <= 1_200_000 ? Math.max(0, slab - 60_000) : Math.min(slab, taxable - 1_200_000);
  } else if (taxable <= 500_000) {
    afterRebate = Math.max(0, slab - 12_500);
  }
  let surchargeRate = 0;
  if (taxable > 5_000_000 && taxable <= 10_000_000) surchargeRate = 0.1;
  else if (taxable > 10_000_000 && taxable <= 20_000_000) surchargeRate = 0.15;
  else if (taxable > 20_000_000 && taxable <= 50_000_000) surchargeRate = 0.25;
  else if (taxable > 50_000_000) surchargeRate = regime === 'old' ? 0.37 : 0.25;
  const surcharge = afterRebate * surchargeRate;
  const cess = rupees((afterRebate + surcharge) * 0.04);
  return {
    stdDed,
    chapter6,
    ptDed,
    taxable,
    slab: rupees(slab),
    rebate: rupees(slab - afterRebate),
    surcharge: rupees(surcharge),
    cess,
    total: rupees(afterRebate + surcharge + cess),
  };
}

export function annualTax(projectedSalary: number, regime: TaxRegime, annualDeductions: number, ptAnnual: number) {
  return taxParts(projectedSalary, regime, annualDeductions, ptAnnual).total;
}

export function computeSalary(
  structure: ResolvedStructure,
  month: string,
  adjustments: MonthAdjustments,
  prior: PriorPay,
  attendance?: { workingDays: number; payableDays: number },
): SalaryBreakdown {
  const calendarDays = monthDaysOf(month);
  const useAttendance = Boolean(attendance && attendance.workingDays > 0);
  const monthDays = useAttendance ? attendance!.workingDays : calendarDays;
  const lopDays = useAttendance
    ? Math.max(0, attendance!.workingDays - attendance!.payableDays)
    : Math.min(calendarDays, Math.max(0, rupees(adjustments.lopDays ?? 0)));
  const paidDays = monthDays - lopDays;
  const ratio = monthDays === 0 ? 0 : paidDays / monthDays;
  const basic = rupees(structure.basic * ratio);
  const hra = rupees(structure.hra * ratio);
  const da = rupees(structure.da * ratio);
  const otherAllowances = rupees(structure.otherAllowances * ratio);
  const fixedGross = rupees(structure.monthlyGross * ratio);
  const statutoryBonus = rupees(structure.statutoryBonus * ratio);
  const dailyAllowance = rupees(structure.dailyAllowance * ratio);
  const special = fixedGross - basic - hra - da - otherAllowances - statutoryBonus - dailyAllowance;
  const leaveEncashment = rupees(structure.leaveEncashment * ratio);
  const bonus = rupees(adjustments.bonus ?? 0);
  const overtime = rupees(adjustments.overtime ?? 0);
  const incentive = rupees(adjustments.incentive ?? 0);
  const arrears = rupees(adjustments.arrears ?? 0);
  const extras = bonus + overtime + incentive + arrears;
  const gross = fixedGross + extras;

  const rawPfWages = basic + da;
  const pfWages = pfWageBase(month, rawPfWages, structure.pfOnActual);
  const eePf = rupees((pfWages * 12) / 100);
  const erPf = eePf;
  const epsWages = Math.min(pfWages, pfCeiling(month));
  const erEps = Math.min(rupees((epsWages * 833) / 10_000), epsCap(month));
  const erEpf = erPf - erEps;
  const edliBase = Math.min(pfWages, pfCeiling(month));
  const erEdli = rupees((edliBase * 5) / 1000);
  const erAdmin = rupees((Math.min(pfWages, pfCeiling(month)) * 5) / 1000);

  const esiCovered = structure.monthlyGross <= 21_000;
  const esiWages = Math.max(0, gross - overtime);
  let eeEsi = 0;
  let erEsi = 0;
  if (esiCovered && esiWages > 0) {
    erEsi = Math.ceil((esiWages * 325) / 10_000);
    const daily = paidDays > 0 ? esiWages / paidDays : esiWages;
    eeEsi = daily <= 176 ? 0 : Math.ceil((esiWages * 75) / 10_000);
  }

  const ptRoom = Math.max(0, 2_500 - prior.pt);
  const pt = Math.min(structure.ptMonthly, ptRoom);

  const { monthsLeft } = fyPosition(month);
  const monthlyRegular = structure.monthlyGross;
  const projectedRegular =
    prior.taxableRegular + fixedGross + Math.max(0, monthsLeft - 1) * monthlyRegular;
  const projectedExtras = prior.taxableExtras + bonus + overtime + incentive + arrears;
  const taxRegular = annualTax(
    projectedRegular,
    structure.taxRegime,
    structure.annualDeductions,
    structure.taxRegime === 'old' ? Math.min(2_500, structure.ptMonthly * 12) : 0,
  );
  const taxAll = annualTax(
    projectedRegular + projectedExtras,
    structure.taxRegime,
    structure.annualDeductions,
    structure.taxRegime === 'old' ? Math.min(2_500, structure.ptMonthly * 12) : 0,
  );
  const tdsRegular = Math.max(0, rupees((taxRegular - prior.tdsRegular) / monthsLeft));
  const tdsExtra = Math.max(0, rupees(taxAll - taxRegular - prior.tdsExtra));
  const tds = tdsRegular + tdsExtra;
  const loanRecovery = rupees(adjustments.loanRecovery ?? 0);
  const advanceRecovery = rupees(adjustments.advanceRecovery ?? 0);
  const otherDeduction = rupees(adjustments.otherDeduction ?? 0);
  const netPay = gross - eePf - eeEsi - pt - tds - loanRecovery - advanceRecovery - otherDeduction;
  const gratuityAccrual =
    structure.gratuityMonthly > 0
      ? rupees(structure.gratuityMonthly * ratio)
      : rupees((structure.basic * 15) / 26 / 12);
  const employerCost = gross + erPf + erEdli + erAdmin + erEsi + gratuityAccrual;
  const warnings: string[] = [];
  if (special < 0) warnings.push('Prorated special allowance is negative.');
  if (netPay < 0) warnings.push('Net pay is negative. Carry the shortfall or reduce deductions.');

  return {
    monthDays,
    paidDays,
    lopDays,
    basic,
    hra,
    da,
    special,
    otherAllowances,
    bonus,
    statutoryBonus,
    dailyAllowance,
    overtime,
    incentive,
    arrears,
    leaveEncashment,
    fixedGross,
    gross,
    pfWages: rupees(pfWages),
    eePf,
    erPf,
    erEps,
    erEpf,
    erEdli,
    erAdmin,
    eeEsi,
    erEsi,
    pt,
    tds,
    tdsRegular,
    tdsExtra,
    loanRecovery,
    advanceRecovery,
    otherDeduction,
    netPay,
    gratuityAccrual,
    employerCost,
    warning: warnings.join(' '),
  };
}
