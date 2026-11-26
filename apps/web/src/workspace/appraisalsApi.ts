import { apiFetch } from '../lib/api';

export type AppraisalKpi = {
  cycleKpiId: string;
  cycleKpi: { id: string; title: string; subKpiName?: string; description: string; category: string; weight: number; subWeight?: number; required: boolean };
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
  return apiFetch<Array<{ id: string; name: string; status: string; periodStart: string; periodEnd: string; selfStart: string; selfDeadline: string; reviewDeadline: string; _count: { appraisals: number }; kpis: Array<{ id: string; title: string; category: string; weight: number; subKpiName?: string; subWeight?: number; required: boolean }> }>>('/api/v1/appraisal-cycles');
}

export function createAppraisalCycle(body: object) {
  return apiFetch<{ id: string }>('/api/v1/appraisal-cycles', { method: 'POST', body: JSON.stringify(body) });
}

export function updateAppraisalCycle(id: string, body: object) {
  return apiFetch(`/api/v1/appraisal-cycles/${id}`, { method: 'PUT', body: JSON.stringify(body) });
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

export type AssignmentEmployee = { id: string; employeeCode: string; employeeName: string; department: string; designation: string; reportingManagerCode: string; reportingManagerName: string };
export type AssignmentRequest = {
  mode: 'all' | 'department' | 'designation' | 'manager' | 'selected' | 'excel';
  filterValue?: string;
  selectedEmployeeCodes?: string[];
  excludedEmployeeCodes?: string[];
  rows?: Array<{ employeeCode: string; employeeName?: string; department?: string; designation?: string; reportingManagerCode?: string; include: string }>;
};
export type AssignmentPreview = { totalEligible: number; selectedCount: number; excludedCount: number; alreadyAssignedCount: number; toAssignCount: number; employees: Array<{ employeeCode: string; name: string; department: string; designation: string; managerCode: string; alreadyAssigned: boolean }>; excludedEmployees: Array<{ employeeCode: string; name: string }>; errors: Array<{ row: number; message: string }>; canConfirm: boolean };

export function fetchAppraisalAssignmentDirectory() {
  return apiFetch<{ employees: AssignmentEmployee[]; departments: string[]; designations: string[]; managers: Array<{ employeeCode: string; name: string }> }>('/api/v1/appraisal-cycles/assignment-directory');
}

export function previewAppraisalAssignments(cycleId: string, request: AssignmentRequest) {
  return apiFetch<AssignmentPreview>(`/api/v1/appraisal-cycles/${cycleId}/assignments/preview`, { method: 'POST', body: JSON.stringify(request) });
}

export function confirmAppraisalAssignments(cycleId: string, request: AssignmentRequest) {
  return apiFetch<{ cycleId: string; assignedCount: number; alreadyAssignedCount: number; excludedCount: number }>(`/api/v1/appraisal-cycles/${cycleId}/assignments/confirm`, { method: 'POST', body: JSON.stringify(request) });
}

export type AppraisalImportRequest = { cycleId: string; fileName: string; csv?: string; workbookBase64?: string };
export function previewAppraisalImport(body: AppraisalImportRequest) {
  return apiFetch<{ totalRows: number; validRows: number; invalidRows: number; totalEmployees?: number; totalCategories?: number; totalCheckpoints?: number; errors: Array<{ row: number; message: string }>; canImport: boolean }>('/api/v1/appraisal-cycles/imports/preview', { method: 'POST', body: JSON.stringify(body) });
}

export function confirmAppraisalImport(body: AppraisalImportRequest) {
  return apiFetch<{ importId: string; importedRows: number; employeesImported: number; appraisalRecordsCreated: number; skippedCount: number; failedRows: number }>('/api/v1/appraisal-cycles/imports/confirm', { method: 'POST', body: JSON.stringify(body) });
}

export function fetchAppraisalImportHistory() {
  return apiFetch<Array<{ id: string; fileName: string; status: string; totalRows: number; importedRows: number; failedRows: number; errors: Array<{ row: number; message: string }>; createdAt: string }>>('/api/v1/appraisal-cycles/imports');
}
