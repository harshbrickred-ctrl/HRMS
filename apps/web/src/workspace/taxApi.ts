import { apiBlob, apiFetch } from '../lib/api';
import type { TaxBreakdown } from './salaryApi';

export type TaxLine = {
  id?: string;
  section: string;
  label: string;
  amount: number;
};

export type TaxDeclaration = {
  id?: string;
  fy: string;
  status: string;
  rentPaidAnnual: number;
  isMetro: boolean;
  decisionNote: string;
  decidedAt?: string | null;
  chapter6Total?: number;
  employeeCode?: string;
  employeeName?: string;
  lines: TaxLine[];
};

export type InvestmentProof = {
  id: string;
  fy: string;
  section: string;
  label: string;
  amount: number;
  fileName: string;
  status: string;
  decisionNote: string;
  createdAt: string;
  employeeCode?: string;
  employeeName?: string;
};

export type TaxRegimeRequest = {
  id: string;
  fromRegime: string;
  toRegime: string;
  reason: string;
  status: string;
  decisionNote: string;
  createdAt: string;
  employeeCode?: string;
  employeeName?: string;
};

export type TaxSummary = {
  fy: string;
  declaration: TaxDeclaration;
  proofs: InvestmentProof[];
  regimeRequest: TaxRegimeRequest | null;
  structure: {
    taxRegime: 'new' | 'old';
    annualDeductions: number;
    rentPaidAnnual: number;
    isMetro: boolean;
    basic: number;
    hra: number;
    da: number;
    monthlyGross: number;
  } | null;
  projectedStatement: {
    fy: string;
    month: string;
    form130: Array<{ id: string; label: string; amount: number }>;
    taxBreakdown?: TaxBreakdown;
  } | null;
};

export type TaxCompanyQueue = {
  declarations: TaxDeclaration[];
  proofs: InvestmentProof[];
  regimeChanges: TaxRegimeRequest[];
};

export function fetchTaxSummary(fy?: string) {
  const query = fy ? `?fy=${encodeURIComponent(fy)}` : '';
  return apiFetch<TaxSummary>(`/api/v1/tax/me/summary${query}`);
}

export function saveTaxDeclaration(body: {
  fy: string;
  rentPaidAnnual: number;
  isMetro: boolean;
  lines: TaxLine[];
}) {
  return apiFetch<TaxDeclaration>('/api/v1/tax/me/declaration', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function submitTaxDeclaration(fy: string) {
  return apiFetch<TaxDeclaration>('/api/v1/tax/me/declaration/submit', {
    method: 'POST',
    body: JSON.stringify({ fy }),
  });
}

export function uploadInvestmentProof(body: FormData) {
  return apiFetch<InvestmentProof>('/api/v1/tax/me/proofs', { method: 'POST', body });
}

export function deleteInvestmentProof(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/tax/me/proofs/${id}`, { method: 'DELETE' });
}

export function requestTaxRegimeChange(toRegime: 'new' | 'old', reason?: string) {
  return apiFetch<TaxRegimeRequest>('/api/v1/tax/me/regime-change', {
    method: 'POST',
    body: JSON.stringify({ toRegime, reason }),
  });
}

export function withdrawTaxRegimeChange(id: string) {
  return apiFetch<TaxRegimeRequest>(`/api/v1/tax/me/regime-change/${id}/withdraw`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function fetchTaxCompanyQueue() {
  return apiFetch<TaxCompanyQueue>('/api/v1/tax/company');
}

export function decideTaxDeclaration(id: string, status: 'approved' | 'rejected', note?: string) {
  return apiFetch<TaxDeclaration>(`/api/v1/tax/company/declarations/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  });
}

export function decideInvestmentProof(id: string, status: 'accepted' | 'rejected', note?: string) {
  return apiFetch<InvestmentProof>(`/api/v1/tax/company/proofs/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  });
}

export function decideTaxRegimeChange(id: string, status: 'approved' | 'rejected', note?: string) {
  return apiFetch<TaxRegimeRequest>(`/api/v1/tax/company/regime-change/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  });
}

export async function openInvestmentProof(id: string, fileName: string, hr = false) {
  const path = hr ? `/api/v1/tax/company/proofs/${id}/file` : `/api/v1/tax/me/proofs/${id}/file`;
  const blob = await apiBlob(path);
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

export const DEFAULT_TAX_LINES: TaxLine[] = [
  { section: '80C', label: 'PPF / ELSS / Life insurance', amount: 0 },
  { section: '80D', label: 'Health insurance', amount: 0 },
];
