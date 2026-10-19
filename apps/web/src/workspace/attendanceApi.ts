import { apiBlob, apiFetch } from '../lib/api';

export type AttendanceDayDto = {
  date: string;
  employeeId: string;
  status: 'present' | 'absent' | 'half_day' | 'holiday' | 'leave' | 'weekend' | 'missing_punch';
  checkIn: string | null;
  checkOut: string | null;
  workMinutes: number | null;
  lateMinutes: number | null;
  earlyMinutes: number | null;
  breakMinutes: number | null;
  missingPunch: boolean;
  note: string;
  locked: boolean;
};

export type AttendanceCorrectionDto = {
  id: string;
  employeeId: string;
  date: string;
  requestedStatus: string;
  checkIn: string | null;
  checkOut: string | null;
  reason: string;
  status: string;
  decisionNote: string;
  createdAt: string;
  person?: { id: string; name: string; employeeCode: string; photo: string } | null;
};

export type MyAttendance = {
  timeZone: string;
  webPunchEnabled: boolean;
  shift: { name: string; startTime: string; endTime: string; breakMinutes: number } | null;
  days: AttendanceDayDto[];
  corrections: AttendanceCorrectionDto[];
};

export type TeamAttendance = {
  exceptions: Array<AttendanceDayDto & { person: MyAttendance['days'][number] extends never ? never : AttendanceCorrectionDto['person'] }>;
  corrections: AttendanceCorrectionDto[];
};

export type AttendanceDevice = {
  id: string;
  serial: string;
  name: string;
  model: string;
  firmware: string;
  timeZone: string;
  directionMode: 'device' | 'inferred';
  locationId: string | null;
  locationName: string | null;
  lastSeenAt: string | null;
  hasCommKey: boolean;
  enrollments: Array<{
    id: string;
    pin: string;
    status: string;
    employeeId: string;
    employeeCode: string;
    name: string;
  }>;
};

export type HolidayDto = {
  id: string;
  date: string;
  name: string;
  locationId: string | null;
  locationName: string | null;
};

export type ShiftDto = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  overnight: boolean;
};

const UI_STATUS = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'HalfDay',
  holiday: 'Holiday',
  leave: 'Leave',
  weekend: 'Weekend',
  missing_punch: 'MissingPunch',
} as const;

export function uiStatus(status: AttendanceDayDto['status']) {
  return UI_STATUS[status];
}

export function fetchMyAttendance(year: number, month: number) {
  return apiFetch<MyAttendance>(`/api/v1/attendance/me?year=${year}&month=${month}`);
}

export function punchMe(direction: 'IN' | 'OUT') {
  return apiFetch<{ duplicate: boolean; day: AttendanceDayDto | null }>(
    '/api/v1/attendance/me/punches',
    { method: 'POST', body: JSON.stringify({ direction }) },
  );
}

export function requestAttendanceCorrection(input: {
  date: string;
  requestedStatus: 'present' | 'absent' | 'leave';
  reason: string;
  checkIn?: string;
  checkOut?: string;
}) {
  return apiFetch<AttendanceCorrectionDto>('/api/v1/attendance/me/corrections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchTeamAttendance(year: number, month: number) {
  return apiFetch<{
    exceptions: Array<AttendanceDayDto & { person: NonNullable<AttendanceCorrectionDto['person']> | null }>;
    corrections: AttendanceCorrectionDto[];
  }>(`/api/v1/attendance/team?year=${year}&month=${month}`);
}

export function decideCorrection(id: string, status: 'Approved' | 'Rejected', note?: string) {
  return apiFetch<AttendanceCorrectionDto>(`/api/v1/attendance/team/corrections/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  });
}

export function fetchAttendanceExceptions(year: number, month: number) {
  return apiFetch<
    Array<AttendanceDayDto & { person: NonNullable<AttendanceCorrectionDto['person']> | null }>
  >(`/api/v1/attendance/exceptions?year=${year}&month=${month}`);
}

export function fetchUnmatchedPunches() {
  return apiFetch<
    Array<{ id: string; pin: string; rawTimestamp: string; serial: string; deviceName: string | null }>
  >('/api/v1/attendance/unmatched');
}

export function mapUnmatchedPunch(id: string, employeeId: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/attendance/unmatched/${id}/map`, {
    method: 'POST',
    body: JSON.stringify({ employeeId }),
  });
}

export function fetchAttendancePeriod(year: number, month: number) {
  return apiFetch<{ year: number; month: number; status: 'open' | 'locked'; lockedAt: string | null }>(
    `/api/v1/attendance/periods/${year}/${month}`,
  );
}

export function lockAttendancePeriod(year: number, month: number) {
  return apiFetch<{ year: number; month: number; status: 'locked' }>(
    `/api/v1/attendance/periods/${year}/${month}/lock`,
    { method: 'POST' },
  );
}

export function fetchShifts() {
  return apiFetch<ShiftDto[]>('/api/v1/attendance/shifts');
}

export function fetchHolidays() {
  return apiFetch<HolidayDto[]>('/api/v1/attendance/holidays');
}

export function createHoliday(input: { date: string; name: string; locationId?: string }) {
  return apiFetch<HolidayDto>('/api/v1/attendance/holidays', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchDevices() {
  return apiFetch<{
    devices: AttendanceDevice[];
    operationLogs: Array<{ id: string; kind: string; raw: string; createdAt: string }>;
  }>('/api/v1/attendance/devices');
}

export function createDevice(input: {
  serial: string;
  name: string;
  locationId?: string;
  directionMode?: 'device' | 'inferred';
}) {
  return apiFetch<AttendanceDevice>('/api/v1/attendance/devices', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function enrollDevice(deviceId: string, employeeId: string, pin: string) {
  return apiFetch(`/api/v1/attendance/devices/${deviceId}/enrollments`, {
    method: 'POST',
    body: JSON.stringify({ employeeId, pin }),
  });
}

export function overrideDay(
  employeeId: string,
  date: string,
  input: { status: 'present' | 'absent' | 'leave'; reason: string; checkIn?: string; checkOut?: string },
) {
  return apiFetch<AttendanceDayDto | null>(
    `/api/v1/attendance/days/${employeeId}/${date}/override`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function downloadRegister(year: number, month: number) {
  const blob = await apiBlob(`/api/v1/attendance/register/${year}/${month}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-${year}-${String(month).padStart(2, '0')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
