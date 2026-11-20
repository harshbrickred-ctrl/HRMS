import { apiBlob, apiFetch } from '../lib/api';

export type SalaryStructureDto = {
  ctc?: number;
  insurance?: number;
  monthlyGross: number;
  basic: number;
  hra: number;
  da: number;
  otherAllowances: number;
  statutoryBonus?: number;
  dailyAllowance: number;
  gratuityMonthly?: number;
  leaveEncashment?: number;
  pfOnActual: boolean;
  taxRegime: 'new' | 'old';
  ptMonthly: number;
  annualDeductions: number;
  rentPaidAnnual?: number;
  isMetro?: boolean;
  ytdTaxable: number;
  ytdTds: number;
  ytdPt: number;
};

export type SalaryLineDto = {
  id: string;
  month: string;
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
  status: string;
  submittedToFinance: boolean;
  payoutGenerated: boolean;
  warning: string;
};

export type SheetRow = { id: string; label: string; month: number; ytd: number };
export type FormRow = { id: string; label: string; amount: number };
export type CheckRow = { id: string; ok: boolean; detail: string };

export type TaxBreakdownRow = {
  id: string;
  section: 'income' | 'deduction' | 'slab' | 'liability' | 'tds';
  label: string;
  amount: number;
  rate: string;
  formula: string;
};

export type TaxBreakdown = {
  regime: 'new' | 'old';
  rows: TaxBreakdownRow[];
};

export type SalaryStatement = {
  month: string;
  paidDaysNote: string;
  earnings: SheetRow[];
  deductions: SheetRow[];
  netPay: number;
  lopDays?: number;
  netPayYtd: number;
  employer: SheetRow[];
  ytdMonths: Array<{ month: string; gross: number; deductions: number; net: number; pf: number; tds: number }>;
  form130: FormRow[];
  taxBreakdown?: TaxBreakdown;
  checks: CheckRow[];
};

export type SalaryRosterRow = {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string;
  structure: SalaryStructureDto | null;
  line: SalaryLineDto | null;
  statement: SalaryStatement | null;
  attendance: {
    workingDays: number;
    present: number;
    paidLeave: number;
    unpaidLeave: number;
    payableDays: number;
    unmarkedDays: number;
    missingPunchDays: number;
    pendingLeaveDays: number;
    note: string;
  } | null;
};

export type MySalary = {
  structure: {
    monthlyGross: number;
    basic: number;
    hra: number;
    da: number;
    otherAllowances: number;
    special: number;
    taxRegime: string;
  } | null;
  lines: SalaryLineDto[];
  payslip?: {
    month: string;
    gross: number;
    deductions: number;
    netPay: number;
    paidDays: number;
    paid: boolean;
  } | null;
  statement: SalaryStatement | null;
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatSalary(amount: number) {
  return inr.format(amount);
}

export function currentSalaryMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function fetchSalaryMonth(month: string) {
  return apiFetch<{ employees: SalaryRosterRow[]; approved: boolean; locked: boolean }>(
    `/api/v1/salary/month?month=${encodeURIComponent(month)}`,
    { cache: 'no-store' },
  );
}

export function saveSalaryStructure(
  employeeId: string,
  body: Partial<SalaryStructureDto> & { monthlyGross: number; taxRegime: 'new' | 'old' },
) {
  return apiFetch<SalaryStructureDto>(`/api/v1/salary/structures/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function saveSalaryMonth(
  employeeId: string,
  body: {
    month: string;
    lopDays?: number;
    bonus?: number;
    overtime?: number;
    incentive?: number;
    arrears?: number;
    loanRecovery?: number;
    advanceRecovery?: number;
    otherDeduction?: number;
  },
) {
  return apiFetch<SalaryLineDto>(`/api/v1/salary/employees/${employeeId}/month`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function generateSalaries(month: string) {
  return apiFetch<{ month: string; generated: number; skippedLocked: number; errors: Array<{ message: string }> }>(
    '/api/v1/salary/generate',
    { method: 'POST', body: JSON.stringify({ month }) },
  );
}

export type PayoutRow = {
  employeeId: string;
  employeeCode: string;
  name: string;
  bankName: string;
  ifscCode: string;
  bankAccountNumber: string;
  netPay: number;
  payoutGenerated: boolean;
  paymentStatus: string;
  utr: string;
  eligible: boolean;
};

export type PayoutBatch = {
  month: string;
  approved: boolean;
  approvedAt: string | null;
  totalEmployees: number;
  totalNet: number;
  eligibleNet: number;
  rows: PayoutRow[];
};

export function fetchPayout(month: string) {
  return apiFetch<PayoutBatch>(`/api/v1/salary/payout?month=${month}`);
}

export function approvePayroll(month: string) {
  return apiFetch<{ month: string; approved: boolean; employees: number }>('/api/v1/salary/approve', {
    method: 'POST',
    body: JSON.stringify({ month }),
  });
}

export function createBankFile(month: string, template: string, employeeIds: string[]) {
  return apiFetch<{ template: string; fileName: string; csv: string; rows: PayoutRow[] }>('/api/v1/salary/payout/file', {
    method: 'POST',
    body: JSON.stringify({ month, template, employeeIds }),
  });
}

export function reconcilePayout(
  month: string,
  updates: Array<{ employeeId: string; status: 'paid' | 'failed'; utr?: string }>,
) {
  return apiFetch<PayoutBatch>('/api/v1/salary/payout/reconcile', {
    method: 'POST',
    body: JSON.stringify({ month, updates }),
  });
}

export function retryPayout(month: string, employeeIds: string[]) {
  return apiFetch<PayoutBatch>('/api/v1/salary/payout/retry', {
    method: 'POST',
    body: JSON.stringify({ month, employeeIds }),
  });
}

export type BankConnectionView = {
  bankCode: string;
  corporateId: string;
  accountLast4: string;
  mode: string;
  status: string;
  live: boolean;
};

export type TransferTransaction = {
  employeeId: string;
  employeeCode: string;
  name: string;
  amount: number;
  status: string;
  skipReason: string;
  utr: string;
};

export type TransferBatchView = {
  id: string;
  reference: string;
  month: string;
  status: string;
  willPayCount: number;
  skippedCount: number;
  totalAmount: number;
  createdById: string;
  createdByEmail: string;
  authorisedByEmail: string;
  canAuthorise: boolean;
  transactions: TransferTransaction[];
};

export type DirectPayout = {
  mode: string;
  configured: boolean;
  missing: string[];
  connection: BankConnectionView | null;
  batches: TransferBatchView[];
};

export function fetchDirectPayout(month: string) {
  return apiFetch<DirectPayout>(`/api/v1/salary/payout/direct?month=${month}`);
}

export function registerBank() {
  return apiFetch<BankConnectionView>('/api/v1/salary/payout/direct/register', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function createTransferBatch(month: string, employeeIds: string[]) {
  return apiFetch<TransferBatchView>('/api/v1/salary/payout/direct/batches', {
    method: 'POST',
    body: JSON.stringify({ month, employeeIds }),
  });
}

export function cancelTransferBatch(batchId: string) {
  return apiFetch<TransferBatchView>(`/api/v1/salary/payout/direct/batches/${batchId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function issueTransferOtp(batchId: string) {
  return apiFetch<{ confirmationCode: string; expiresAt: string }>(`/api/v1/salary/payout/direct/batches/${batchId}/otp`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function verifyTransferOtp(batchId: string, otp: string) {
  return apiFetch<TransferBatchView>(`/api/v1/salary/payout/direct/batches/${batchId}/verify`, {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });
}

export function authoriseTransfer(batchId: string, decision: 'approve' | 'reject') {
  return apiFetch<TransferBatchView>(`/api/v1/salary/payout/direct/batches/${batchId}/authorise`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}

export function syncTransfer(batchId: string) {
  return apiFetch<TransferBatchView>(`/api/v1/salary/payout/direct/batches/${batchId}/sync`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function lockSalaries(month: string, locked: boolean) {
  return apiFetch<{ count: number }>('/api/v1/salary/lock', {
    method: 'POST',
    body: JSON.stringify({ month, locked }),
  });
}

export function uploadSalaryCsv(kind: 'structure' | 'month', csv: string, month?: string) {
  return apiFetch<{ updated: number; errors: Array<{ row: number; message: string }> }>('/api/v1/salary/upload', {
    method: 'POST',
    body: JSON.stringify({ kind, csv, month }),
  });
}

export function fetchMySalary() {
  return apiFetch<MySalary>('/api/v1/salary/me');
}

export async function downloadSalarySlip(month: string) {
  const blob = await apiBlob(`/api/v1/salary/me/payslip/${month}`);
  const [year, m] = month.split('-');
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1];
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Payslip_${short ?? month}_${year}.pdf`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const SALARY_TEMPLATE = `employeeCode,monthlyGross,basic,hra,da,otherAllowances,pfOnActual,taxRegime,ptMonthly,annualDeductions,ytdTaxable,ytdTds,ytdPt
E001,120000,60000,30000,0,0,no,new,200,0,0,0,0
`;

export const SALARY_MONTH_TEMPLATE = `employeeCode,lopDays,bonus,overtime,incentive,arrears,loanRecovery,advanceRecovery,otherDeduction
E001,0,0,0,0,0,0,0,0
`;
