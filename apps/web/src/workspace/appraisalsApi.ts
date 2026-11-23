import { apiFetch } from '../lib/api';

export type AppraisalKpi = {
  cycleKpiId: string;
  cycleKpi: { id: string; title: string; description: string; category: string; weight: number; required: boolean };
  selfRating: number | null;
  selfComment: string;
  managerRating: number | null;
  managerComment: string;
};

export type Appraisal = {
  id: string;
  status: string;
  cycle: { id: string; name: string; status?: string; selfDeadline?: string; periodStart?: string; periodEnd?: string; kpis?: AppraisalKpi['cycleKpi'][] };
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string; designation: string; department?: { name: string } | null; manager?: { firstName: string; lastName: string } | null };
  updatedAt?: string;
  submittedAt?: string | null;
  goals?: unknown[];
  achievements?: unknown[];
  selfFeedback?: string;
  managerFeedback?: string;
  managerStrengths?: string;
  managerImprovementAreas?: string;
  managerRating?: number | null;
  hrFeedback?: string;
  hrRating?: number | null;
  managementFeedback?: string;
  completedAt?: string | null;
  finalRating?: number | null;
  promotionRecommendation?: string;
  salaryIncreasePercent?: number | null;
  salaryIncreaseAmount?: number | null;
  kpiResponses: AppraisalKpi[];
  history?: Array<{ stage: string; action: string; fromStatus?: string; status?: string; toStatus?: string; createdAt: string; comment?: string; actor?: string }>;
};

export function fetchMyAppraisals() {
  return apiFetch<{ current: Appraisal[]; previous: Appraisal[] }>('/api/v1/appraisals/me');
}

export function saveSelfAppraisal(id: string, body: object) {
  return apiFetch<Appraisal>(`/api/v1/appraisals/me/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function submitSelfAppraisal(id: string) {
  return apiFetch<{ id: string; status: string }>(`/api/v1/appraisals/me/${id}/submit`, { method: 'POST', body: '{}' });
}

export function fetchManagerAppraisals() {
  return apiFetch<Appraisal[]>('/api/v1/appraisals/manager');
}

export function saveManagerReview(id: string, body: object) {
  return apiFetch(`/api/v1/appraisals/manager/${id}/review`, { method: 'PUT', body: JSON.stringify(body) });
}

export function decideAppraisal(role: 'manager' | 'hr' | 'management', id: string, action: string, body: object = {}) {
  return apiFetch(`/api/v1/appraisals/${role}/${id}/${action}`, { method: 'POST', body: JSON.stringify(body) });
}

export function fetchHrAppraisals() {
  return apiFetch<Appraisal[]>('/api/v1/appraisals/hr');
}

export function fetchAdminAppraisals() {
  return apiFetch<Appraisal[]>('/api/v1/appraisals/admin');
}

export function fetchAdminAppraisal(id: string) {
  return apiFetch<Appraisal>(`/api/v1/appraisals/admin/${id}`);
}

export function saveHrReview(id: string, body: object) {
  return decideAppraisal('hr', id, 'approve', body);
}

export function fetchManagementAppraisals() {
  return apiFetch<Appraisal[]>('/api/v1/appraisals/management');
}

export function fetchAppraisalSummary(scope: 'me' | 'manager' | 'hr' | 'management') {
  return apiFetch<Record<string, unknown>>(`/api/v1/appraisal-reports/${scope}`);
}

export function fetchAppraisalCycles() {
  return apiFetch<Array<{ id: string; name: string; status: string; _count: { appraisals: number }; kpis: Array<{ id: string; title: string; weight: number }> }>>('/api/v1/appraisal-cycles');
}

export function createAppraisalCycle(body: object) {
  return apiFetch<{ id: string }>('/api/v1/appraisal-cycles', { method: 'POST', body: JSON.stringify(body) });
}

export function setAppraisalCycleKpis(id: string, kpis: object[]) {
  return apiFetch(`/api/v1/appraisal-cycles/${id}/kpis`, { method: 'PUT', body: JSON.stringify({ kpis }) });
}

export function launchAppraisalCycle(id: string) {
  return apiFetch(`/api/v1/appraisal-cycles/${id}/launch`, { method: 'POST', body: '{}' });
}

export function closeAppraisalCycle(id: string) {
  return apiFetch(`/api/v1/appraisal-cycles/${id}/close`, { method: 'POST', body: '{}' });
}
