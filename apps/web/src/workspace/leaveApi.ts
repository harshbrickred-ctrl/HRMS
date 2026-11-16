import { apiFetch } from '../lib/api';

export type LeaveBalanceDto = {
  code: string;
  type: string;
  entitled: number;
  used: number;
  pending: number;
  available: number;
};

export type LeaveRequestDto = {
  id: string;
  employeeId: string;
  code: string;
  type: string;
  typeCode: string;
  startDate: string;
  endDate: string;
  days: number;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  fromHalfStart?: boolean;
  fromHalfEnd?: boolean;
  toHalfStart?: boolean;
  toHalfEnd?: boolean;
  reason: string;
  status: string;
  decisionNote: string;
  decidedAt: string | null;
  submittedAt: string;
  person?: { id: string; name: string; photo: string; employeeCode: string } | null;
};

export type MyLeave = {
  balances: LeaveBalanceDto[];
  requests: LeaveRequestDto[];
  holidays: Array<{ date: string; name: string }>;
};

/** Shown when the signed-in user has no balance rows yet, so Apply still lists types. */
export const LEAVE_TYPE_CATALOG: LeaveBalanceDto[] = [
  { code: 'CL', type: 'Casual Leave', entitled: 0, used: 0, pending: 0, available: 0 },
  { code: 'SL', type: 'Sick Leave', entitled: 0, used: 0, pending: 0, available: 0 },
  { code: 'EL', type: 'Earned Leave or Planned Leave', entitled: 0, used: 0, pending: 0, available: 0 },
  { code: 'CO', type: 'Comp-off', entitled: 0, used: 0, pending: 0, available: 0 },
  { code: 'WFH', type: 'Work From Home', entitled: 0, used: 0, pending: 0, available: 0 },
  { code: 'OBH', type: 'Optional - Birthday Holiday', entitled: 0, used: 0, pending: 0, available: 0 },
  { code: 'LOP', type: 'Loss of Pay', entitled: 0, used: 0, pending: 0, available: 0 },
];

export function fetchMyLeave() {
  return apiFetch<MyLeave>('/api/v1/leave/me');
}

export function leaveHalfLabel(request: {
  startDate: string;
  endDate: string;
  halfDayStart?: boolean;
  halfDayEnd?: boolean;
  fromHalfStart?: boolean;
  fromHalfEnd?: boolean;
  toHalfStart?: boolean;
  toHalfEnd?: boolean;
}) {
  const same = request.startDate.slice(0, 10) === request.endDate.slice(0, 10);
  const fromStart = Boolean(request.fromHalfStart);
  const fromEnd = Boolean(request.fromHalfEnd);
  const toStart = Boolean(request.toHalfStart);
  const toEnd = Boolean(request.toHalfEnd);
  if (!fromStart && !fromEnd && !toStart && !toEnd) {
    return request.halfDayStart || request.halfDayEnd ? 'Half day' : '';
  }
  if (same) {
    if (fromStart) return 'Half Day Start';
    if (fromEnd) return 'Half Day End';
    return 'Half day';
  }
  const parts: string[] = [];
  if (fromStart) parts.push('From Half Day Start');
  if (fromEnd) parts.push('From Half Day End');
  if (toStart) parts.push('To Half Day Start');
  if (toEnd) parts.push('To Half Day End');
  return parts.join(' · ');
}

export function applyLeaveRequest(input: {
  code: string;
  fromDate: string;
  toDate: string;
  halfDayStart?: boolean;
  halfDayEnd?: boolean;
  fromHalfStart?: boolean;
  fromHalfEnd?: boolean;
  toHalfStart?: boolean;
  toHalfEnd?: boolean;
  reason: string;
}) {
  return apiFetch<LeaveRequestDto>('/api/v1/leave/me/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function withdrawLeaveRequest(id: string) {
  return apiFetch<MyLeave>(`/api/v1/leave/me/requests/${id}/withdraw`, { method: 'POST' });
}

export function fetchTeamLeave() {
  return apiFetch<{ requests: LeaveRequestDto[] }>('/api/v1/leave/team');
}

export function fetchCompanyLeave() {
  return apiFetch<{ requests: LeaveRequestDto[] }>('/api/v1/leave/company');
}

export function applyLeaveForEmployee(input: {
  employeeId: string;
  code: string;
  fromDate: string;
  toDate: string;
  halfDayStart?: boolean;
  halfDayEnd?: boolean;
  fromHalfStart?: boolean;
  fromHalfEnd?: boolean;
  toHalfStart?: boolean;
  toHalfEnd?: boolean;
  reason: string;
}) {
  return apiFetch<LeaveRequestDto>('/api/v1/leave/company/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function leaveDecisionToast(status: string) {
  if (status === 'Rejected') {
    return { message: 'Leave rejected.', tone: 'danger' as const };
  }
  return { message: 'Leave accepted.', tone: 'ok' as const };
}

export function decideLeaveRequest(id: string, status: 'Approved' | 'Rejected', note?: string) {
  return apiFetch<LeaveRequestDto>(`/api/v1/leave/team/requests/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  });
}
