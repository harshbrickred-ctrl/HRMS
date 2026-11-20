import { apiBlob, apiFetch } from '../lib/api';

export type ReimbursementClaim = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  expenseDate: string;
  days: number;
  amount: number;
  reason: string;
  receiptName: string;
  hasReceipt: boolean;
  status: string;
  salaryMonth: string;
  payMonth: string;
  createdAt: string;
  canDecide: boolean;
};

export type ReimbursementBoard = {
  mine: ReimbursementClaim[];
  approvals: ReimbursementClaim[];
  company: ReimbursementClaim[];
  canApprove: boolean;
};

export function fetchReimbursements() {
  return apiFetch<ReimbursementBoard>('/api/v1/reimbursements');
}

export function submitReimbursement(body: FormData) {
  return apiFetch<ReimbursementClaim>('/api/v1/reimbursements', { method: 'POST', body });
}

export function decideReimbursement(id: string, status: 'approved' | 'rejected') {
  return apiFetch<ReimbursementClaim>(`/api/v1/reimbursements/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function openReimbursementReceipt(id: string, fileName: string) {
  const blob = await apiBlob(`/api/v1/reimbursements/${id}/receipt`);
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank');
  if (!opened) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
