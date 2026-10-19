import { apiFetch } from '../lib/api';

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
  return apiFetch<ReportSummary>('/api/v1/reports/summary');
}

export function fetchWorkflowQueues() {
  return apiFetch<{ queues: WorkflowQueue[] }>('/api/v1/reports/workflows');
}
