export type SalaryMonth = {
  month: string;
  earnings: number;
  deductions: number;
  net: number;
  pf: number;
  tds: number;
};

export type SalaryLine = {
  label: string;
  amount: number;
  status?: string;
  note?: string;
};

export const SALARY_FY = '2026-27';

export const SALARY_YTD = {
  months: [
    { month: 'Apr 2026', earnings: 80000, deductions: 9500, net: 70500, pf: 4800, tds: 4500 },
    { month: 'May 2026', earnings: 80000, deductions: 9500, net: 70500, pf: 4800, tds: 4500 },
    { month: 'Jun 2026', earnings: 80000, deductions: 9500, net: 70500, pf: 4800, tds: 4500 },
    { month: 'Jul 2026', earnings: 80000, deductions: 9700, net: 70300, pf: 4800, tds: 4700 },
    { month: 'Aug 2026', earnings: 80000, deductions: 9700, net: 70300, pf: 4800, tds: 4700 },
    { month: 'Sep 2026', earnings: 80000, deductions: 9100, net: 70900, pf: 4800, tds: 4100 },
  ] satisfies SalaryMonth[],
};

export function ytdTotals(months: SalaryMonth[]) {
  return months.reduce(
    (sum, month) => ({
      earnings: sum.earnings + month.earnings,
      deductions: sum.deductions + month.deductions,
      net: sum.net + month.net,
      pf: sum.pf + month.pf,
      tds: sum.tds + month.tds,
    }),
    { earnings: 0, deductions: 0, net: 0, pf: 0, tds: 0 },
  );
}

export const IT_STATEMENT: SalaryLine[] = [
  { label: 'Gross salary (projected)', amount: 960000 },
  { label: 'Standard deduction', amount: 75000 },
  { label: 'HRA exemption', amount: 96000 },
  { label: 'Taxable income', amount: 789000 },
  { label: 'Tax payable', amount: 54800 },
  { label: 'TDS deducted so far', amount: 27000 },
];

export const IT_DECLARATION: SalaryLine[] = [
  { label: '80C — PPF and ELSS', amount: 150000, status: 'Submitted', note: 'At the 80C limit' },
  { label: '80D — Health insurance', amount: 25000, status: 'Submitted' },
  { label: 'HRA — Rent paid', amount: 120000, status: 'Draft', note: 'Rent receipts still open' },
];

export const SALARY_LOANS = [
  {
    name: 'Salary advance',
    principal: 20000,
    outstanding: 10000,
    emi: 5000,
    nextDue: 'Oct 2026',
  },
  {
    name: 'Laptop loan',
    principal: 60000,
    outstanding: 42000,
    emi: 3500,
    nextDue: 'Oct 2026',
  },
];

export const REIMBURSEMENTS = [
  { title: 'Internet — Sep 2026', amount: 1500, status: 'Approved' },
  { title: 'Medical — Aug 2026', amount: 3200, status: 'Pending' },
  { title: 'Books — Jul 2026', amount: 800, status: 'Paid' },
];

export const INVESTMENT_PROOFS = [
  { name: '80C investment proof', status: 'Submitted', updated: '12 Sep 2026' },
  { name: '80D premium receipt', status: 'Submitted', updated: '12 Sep 2026' },
  { name: 'HRA rent receipts', status: 'Pending', updated: '—' },
];

export const SALARY_REVISION = {
  currentCtc: 960000,
  effectiveFrom: '1 Apr 2026',
  previous: {
    ctc: 840000,
    effectiveFrom: '1 Apr 2025',
    hikePercent: 14.3,
  },
};
