import { apiFetch } from './api';

export type ReportSummary = {
  headcount: number;
  onLeave: number;
  pendingLeave: number;
  pendingCorrections: number;
  unmatchedPunches: number;
  openTickets: number;
  attendanceExceptions: number;
  year: number;
  month: number;
};

export type WorkflowQueue = {
  id: string;
  name: string;
  stuck: number;
  href: string;
};

export function fetchReportSummary() {
  return apiFetch<ReportSummary>('/reports/summary');
}

export function fetchWorkflowQueues() {
  return apiFetch<{ queues: WorkflowQueue[] }>('/reports/workflows');
}
