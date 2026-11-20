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
  insurance?: number;
  pfOnActual?: boolean;
  taxRegime?: TaxRegime;
  ptMonthly?: number;
  annualDeductions?: number;
  rentPaidAnnual?: number;
  isMetro?: boolean;
  /** CTC for the year, in rupees. 12 LPA is 1200000. Monthly pay is this divided by 12. */
  ctc?: number;
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
  insurance: number;
  pfOnActual: boolean;
  taxRegime: TaxRegime;
  ptMonthly: number;
  annualDeductions: number;
  rentPaidAnnual: number;
  isMetro: boolean;
};

export type MonthAdjustments = {
  lopDays?: number;
  bonus?: number;
  overtime?: number;
  incentive?: number;
  arrears?: number;
  reimbursement?: number;
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
  reimbursement: number;
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
  lossOfPay: number;
  insurance: number;
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

export function gratuityFromBasic(basic: number) {
  return rupees((Math.max(0, basic) / 30) * 26);
}

export function leaveEncashmentFromBasic(basic: number) {
  return rupees((Math.max(0, basic) / 20) * 10);
}

/** Employee PF is 12% of basic, and basic above ₹25,000 does not increase it (₹25,000 × 12% = ₹3,000). */
export function pfFromBasic(basic: number) {
  return rupees((Math.min(Math.max(0, basic), 25_000) * 12) / 100);
}

export const STATUTORY_BONUS_FIXED = 1_400;

/** Special allowance = monthly CTC − basic − HRA − statutory bonus. PF is a deduction, not part of this. */
export function specialAllowanceFromCtc(annualCtc: number, basic: number, hra: number, statutoryBonus: number) {
  const monthlyCtc = rupees(Math.max(0, annualCtc) / 12);
  return rupees(monthlyCtc - basic - hra - statutoryBonus);
}

export function structureFromCtc(ctc: number) {
  const annualCtc = rupees(ctc);
  if (annualCtc <= 0) throw new Error('Enter CTC.');
  const monthlyCtc = rupees(annualCtc / 12);
  const basic = rupees(monthlyCtc * 0.5);
  const hra = rupees(basic * 0.5);
  const statutoryBonus = STATUTORY_BONUS_FIXED;
  const pf = pfFromBasic(basic);
  const special = specialAllowanceFromCtc(annualCtc, basic, hra, statutoryBonus);
  if (special < 0) {
    throw new Error('CTC is too low for basic, HRA and the ₹1,400 statutory bonus.');
  }
  const monthlyGross = basic + hra + special + statutoryBonus;
  return {
    ctc: annualCtc,
    monthlyGross,
    basic,
    hra,
    da: 0,
    otherAllowances: 0,
    special,
    statutoryBonus,
    dailyAllowance: 0,
    gratuityMonthly: gratuityFromBasic(basic),
    leaveEncashment: leaveEncashmentFromBasic(basic),
    pf,
  };
}

export function resolveStructure(input: StructureInput): ResolvedStructure {
  if (input.ctc != null && input.ctc > 0) {
    const shaped = structureFromCtc(input.ctc);
    const taxRegime: TaxRegime = input.taxRegime === 'old' ? 'old' : 'new';
    return {
      monthlyGross: shaped.monthlyGross,
      basic: shaped.basic,
      hra: shaped.hra,
      da: 0,
      otherAllowances: 0,
      special: shaped.special,
      statutoryBonus: shaped.statutoryBonus,
      dailyAllowance: 0,
      gratuityMonthly: shaped.gratuityMonthly,
      leaveEncashment: shaped.leaveEncashment,
      insurance: Math.max(0, rupees(input.insurance ?? 0)),
      pfOnActual: false,
      taxRegime,
      ptMonthly: Math.max(0, rupees(input.ptMonthly ?? 0)),
      annualDeductions: Math.max(0, rupees(input.annualDeductions ?? 0)),
      rentPaidAnnual: Math.max(0, rupees(input.rentPaidAnnual ?? 0)),
      isMetro: Boolean(input.isMetro),
    };
  }
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
    gratuityMonthly: gratuityFromBasic(basic),
    leaveEncashment: leaveEncashmentFromBasic(basic),
    insurance: Math.max(0, rupees(input.insurance ?? 0)),
    pfOnActual: Boolean(input.pfOnActual),
    taxRegime,
    ptMonthly: Math.max(0, rupees(input.ptMonthly ?? 0)),
    annualDeductions: Math.max(0, rupees(input.annualDeductions ?? 0)),
    rentPaidAnnual: Math.max(0, rupees(input.rentPaidAnnual ?? 0)),
    isMetro: Boolean(input.isMetro),
  };
}

/** Section 10(13A) HRA exemption — old regime only. */
export function hraExemption(
  annualBasic: number,
  annualDa: number,
  annualHra: number,
  rentPaidAnnual: number,
  isMetro: boolean,
) {
  const basicDa = Math.max(0, annualBasic) + Math.max(0, annualDa);
  const hra = Math.max(0, annualHra);
  const rent = Math.max(0, rentPaidAnnual);
  if (hra <= 0 || rent <= 0 || basicDa <= 0) return 0;
  const rentMinus10 = Math.max(0, rent - basicDa * 0.1);
  const cityCap = basicDa * (isMetro ? 0.5 : 0.4);
  return rupees(Math.min(hra, rentMinus10, cityCap));
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

export type SlabSlice = {
  from: number;
  to: number | null;
  percent: number;
  slice: number;
  tax: number;
};

export function slabSlices(taxable: number, regime: TaxRegime): SlabSlice[] {
  const slabs = regime === 'new' ? NEW_SLABS : OLD_SLABS;
  const rows: SlabSlice[] = [];
  let prev = 0;
  for (const [upper, percent] of slabs) {
    const slice = Math.max(0, Math.min(taxable, upper) - prev);
    if (slice > 0 || percent === 0) {
      rows.push({
        from: prev,
        to: Number.isFinite(upper) ? upper : null,
        percent,
        slice: rupees(slice),
        tax: rupees((slice * percent) / 100),
      });
    }
    prev = upper;
    if (taxable <= upper) break;
  }
  return rows;
}

export type TaxParts = {
  stdDed: number;
  chapter6: number;
  ptDed: number;
  exemptAllowances: number;
  taxable: number;
  slab: number;
  rebate: number;
  surcharge: number;
  cess: number;
  total: number;
  surchargeRate: number;
};

export type TaxBreakdownRow = {
  id: string;
  section: 'income' | 'deduction' | 'slab' | 'liability' | 'tds';
  label: string;
  amount: number;
  rate: string;
  formula: string;
};

export type TaxBreakdown = {
  regime: TaxRegime;
  rows: TaxBreakdownRow[];
};

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function formatBand(from: number, to: number | null) {
  if (to == null) return `${inr(from + 1)} and above`;
  if (from === 0) return `Up to ${inr(to)}`;
  return `${inr(from + 1)} – ${inr(to)}`;
}

export function taxParts(
  projectedSalary: number,
  regime: TaxRegime,
  annualDeductions: number,
  ptAnnual: number,
  exemptAllowances = 0,
): TaxParts {
  const salary = Math.max(0, projectedSalary);
  const exempt = regime === 'old' ? Math.max(0, exemptAllowances) : 0;
  const afterExempt = Math.max(0, salary - exempt);
  const stdDed = Math.min(afterExempt, regime === 'new' ? 75_000 : 50_000);
  /** Caller caps 80C at ₹1.5L; other Chapter VI-A sections can exceed that. */
  const chapter6 = regime === 'old' ? Math.max(0, annualDeductions) : 0;
  const ptDed = regime === 'old' ? Math.min(2_500, Math.max(0, ptAnnual)) : 0;
  const taxable = Math.round(Math.max(0, afterExempt - stdDed - chapter6 - ptDed) / 10) * 10;
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
    exemptAllowances: rupees(exempt),
    taxable,
    slab: rupees(slab),
    rebate: rupees(slab - afterRebate),
    surcharge: rupees(surcharge),
    cess,
    total: rupees(afterRebate + surcharge + cess),
    surchargeRate,
  };
}

export function buildTaxBreakdown(
  projectedSalary: number,
  regime: TaxRegime,
  annualDeductions: number,
  ptAnnual: number,
  exemptAllowances = 0,
  opts: {
    ytdTds?: number;
    monthTds?: number;
    monthTdsRegular?: number;
    monthTdsExtra?: number;
    monthsLeft?: number;
    incomeLabel?: string;
  } = {},
): TaxBreakdown {
  const tax = taxParts(projectedSalary, regime, annualDeductions, ptAnnual, exemptAllowances);
  const salary = Math.max(0, projectedSalary);
  const stdCap = regime === 'new' ? 75_000 : 50_000;
  const rows: TaxBreakdownRow[] = [
    {
      id: 'TX-01',
      section: 'income',
      label: opts.incomeLabel ?? 'Gross salary (tax base)',
      amount: rupees(salary),
      rate: '—',
      formula: regime === 'new' ? 'Annual / YTD gross earnings' : 'Annual / YTD gross earnings before HRA exemption',
    },
  ];

  if (regime === 'old') {
    rows.push({
      id: 'TX-02',
      section: 'deduction',
      label: 'HRA exemption (Sec 10(13A))',
      amount: tax.exemptAllowances,
      rate: '—',
      formula: 'Min of: actual HRA, rent − 10% of basic+DA, 50%/40% of basic+DA (metro/non-metro)',
    });
  }

  rows.push(
    {
      id: 'TX-03',
      section: 'deduction',
      label: 'Standard deduction',
      amount: tax.stdDed,
      rate: '—',
      formula: `Min(salary after exemptions, ${inr(stdCap)}) · ${regime === 'new' ? 'New' : 'Old'} regime`,
    },
    {
      id: 'TX-04',
      section: 'deduction',
      label: 'Chapter VI-A (80C and others)',
      amount: tax.chapter6,
      rate: regime === 'old' ? '—' : '0%',
      formula: regime === 'old' ? 'Declared / approved deductions (old regime only)' : 'Not allowed under new regime',
    },
    {
      id: 'TX-05',
      section: 'deduction',
      label: 'Professional tax deduction',
      amount: tax.ptDed,
      rate: regime === 'old' ? '—' : '0%',
      formula: regime === 'old' ? 'Min(PT paid, ₹2,500) · old regime only' : 'Not allowed under new regime',
    },
    {
      id: 'TX-06',
      section: 'income',
      label: 'Taxable income',
      amount: tax.taxable,
      rate: '—',
      formula: 'Gross − HRA exempt − std ded − Ch. VI-A − PT (rounded to nearest ₹10)',
    },
  );

  const slices = slabSlices(tax.taxable, regime);
  slices.forEach((slice, index) => {
    rows.push({
      id: `TX-S${index + 1}`,
      section: 'slab',
      label: `Slab · ${formatBand(slice.from, slice.to)}`,
      amount: slice.tax,
      rate: `${slice.percent}%`,
      formula: `${inr(slice.slice)} × ${slice.percent}% = ${inr(slice.tax)}`,
    });
  });

  const rebateNote =
    regime === 'new'
      ? tax.taxable <= 1_200_000
        ? 'Sec 87A: rebate up to ₹60,000 when taxable ≤ ₹12L'
        : 'Marginal relief so tax ≤ (taxable − ₹12L)'
      : tax.taxable <= 500_000
        ? 'Sec 87A: rebate up to ₹12,500 when taxable ≤ ₹5L'
        : 'No rebate (taxable > ₹5L)';

  rows.push(
    {
      id: 'TX-07',
      section: 'liability',
      label: 'Tax on taxable income (before rebate)',
      amount: tax.slab,
      rate: 'slab',
      formula: 'Sum of all slab slices above',
    },
    {
      id: 'TX-08',
      section: 'liability',
      label: 'Rebate u/s 87A',
      amount: tax.rebate,
      rate: '—',
      formula: rebateNote,
    },
    {
      id: 'TX-09',
      section: 'liability',
      label: 'Surcharge',
      amount: tax.surcharge,
      rate: tax.surchargeRate ? `${tax.surchargeRate * 100}%` : '0%',
      formula:
        tax.surchargeRate > 0
          ? `(Tax after rebate) × ${tax.surchargeRate * 100}%`
          : 'Nil when taxable ≤ ₹50L',
    },
    {
      id: 'TX-10',
      section: 'liability',
      label: 'Health & education cess',
      amount: tax.cess,
      rate: '4%',
      formula: '(Tax after rebate + surcharge) × 4%',
    },
    {
      id: 'TX-11',
      section: 'liability',
      label: 'Total tax payable',
      amount: tax.total,
      rate: '—',
      formula: 'Tax after rebate + surcharge + cess',
    },
  );

  if (opts.ytdTds != null) {
    rows.push(
      {
        id: 'TX-12',
        section: 'tds',
        label: 'TDS deducted to date',
        amount: opts.ytdTds,
        rate: '—',
        formula: 'Sum of TDS on locked / draft salary lines this FY',
      },
      {
        id: 'TX-13',
        section: 'tds',
        label: 'Balance tax (shortfall / excess)',
        amount: tax.total - opts.ytdTds,
        rate: '—',
        formula: 'Total tax payable − TDS to date (negative = excess deducted)',
      },
    );
  }

  if (opts.monthTds != null) {
    const monthsLeft = opts.monthsLeft ?? 1;
    rows.push({
      id: 'TX-14',
      section: 'tds',
      label: 'This month TDS (total)',
      amount: opts.monthTds,
      rate: '—',
      formula: 'Regular TDS + extra TDS on bonus / OT / incentive / arrears',
    });
    if (opts.monthTdsRegular != null) {
      rows.push({
        id: 'TX-15',
        section: 'tds',
        label: 'This month · regular TDS',
        amount: opts.monthTdsRegular,
        rate: '—',
        formula: `Max(0, (annual tax on projected regular − prior regular TDS) ÷ ${monthsLeft} months left)`,
      });
    }
    if (opts.monthTdsExtra != null) {
      rows.push({
        id: 'TX-16',
        section: 'tds',
        label: 'This month · extra TDS',
        amount: opts.monthTdsExtra,
        rate: '—',
        formula: 'Max(0, tax on (regular+extras) − tax on regular − prior extra TDS)',
      });
    }
  }

  return { regime, rows };
}

export function annualTax(
  projectedSalary: number,
  regime: TaxRegime,
  annualDeductions: number,
  ptAnnual: number,
  exemptAllowances = 0,
) {
  return taxParts(projectedSalary, regime, annualDeductions, ptAnnual, exemptAllowances).total;
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
  const basic = structure.basic;
  const hra = structure.hra;
  const da = structure.da;
  const otherAllowances = structure.otherAllowances;
  const fixedGross = structure.monthlyGross;
  const statutoryBonus = structure.statutoryBonus;
  const dailyAllowance = structure.dailyAllowance;
  const special = structure.special;
  const leaveEncashment = structure.leaveEncashment;
  const lossOfPay = monthDays === 0 ? 0 : rupees((structure.monthlyGross * lopDays) / monthDays);
  const bonus = rupees(adjustments.bonus ?? 0);
  const overtime = rupees(adjustments.overtime ?? 0);
  const incentive = rupees(adjustments.incentive ?? 0);
  const arrears = rupees(adjustments.arrears ?? 0);
  const reimbursement = Math.max(0, rupees(adjustments.reimbursement ?? 0));
  const extras = bonus + overtime + incentive + arrears;
  const gross = fixedGross + extras + reimbursement;

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

  const { n, monthsLeft } = fyPosition(month);
  const monthlyRegular = structure.monthlyGross;
  const monthsBefore = Math.max(0, n - 1);
  const exempt =
    structure.taxRegime === 'old'
      ? hraExemption(
          structure.basic * 12,
          structure.da * 12,
          structure.hra * 12,
          structure.rentPaidAnnual,
          structure.isMetro,
        )
      : 0;
  const ptAnnual = structure.taxRegime === 'old' ? Math.min(2_500, structure.ptMonthly * 12) : 0;

  /**
   * Mid-year first calc with blank brought-forward used to project only remaining
   * months (e.g. Nov→Mar ≈ ₹6.25L on a ₹15L CTC), so Sec 87A wiped TDS to ₹0.
   * When HR has not entered YTD, assume the current CTC rate from FY start and
   * that TDS was withheld evenly — monthly TDS then matches the full-year estimate
   * (₹15L new ≈ ₹8,125 / month).
   */
  let priorRegular = prior.taxableRegular;
  let priorTdsRegular = prior.tdsRegular;
  if (priorRegular === 0 && priorTdsRegular === 0 && monthsBefore > 0) {
    priorRegular = monthsBefore * monthlyRegular;
    const fullYearTax = annualTax(
      monthlyRegular * 12,
      structure.taxRegime,
      structure.annualDeductions,
      ptAnnual,
      exempt,
    );
    priorTdsRegular = rupees((fullYearTax * monthsBefore) / 12);
  }

  const projectedRegular =
    priorRegular + fixedGross + Math.max(0, monthsLeft - 1) * monthlyRegular;
  const projectedExtras = prior.taxableExtras + bonus + overtime + incentive + arrears;
  const taxRegular = annualTax(
    projectedRegular,
    structure.taxRegime,
    structure.annualDeductions,
    ptAnnual,
    exempt,
  );
  const taxAll = annualTax(
    projectedRegular + projectedExtras,
    structure.taxRegime,
    structure.annualDeductions,
    ptAnnual,
    exempt,
  );
  const tdsRegular = Math.max(0, rupees((taxRegular - priorTdsRegular) / monthsLeft));
  const tdsExtra = Math.max(0, rupees(taxAll - taxRegular - prior.tdsExtra));
  const tds = tdsRegular + tdsExtra;
  const loanRecovery = rupees(adjustments.loanRecovery ?? 0);
  const advanceRecovery = rupees(adjustments.advanceRecovery ?? 0);
  const otherDeduction = rupees(adjustments.otherDeduction ?? 0);
  const insurance = Math.max(0, rupees(structure.insurance ?? 0));
  const netPay = gross - eePf - eeEsi - pt - tds - loanRecovery - advanceRecovery - otherDeduction - lossOfPay - insurance;
  const gratuityAccrual = structure.gratuityMonthly;
  const employerCost = gross - lossOfPay + erPf + erEdli + erAdmin + erEsi + gratuityAccrual;
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
    reimbursement,
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
    lossOfPay,
    insurance,
    netPay,
    gratuityAccrual,
    employerCost,
    warning: warnings.join(' '),
  };
}
