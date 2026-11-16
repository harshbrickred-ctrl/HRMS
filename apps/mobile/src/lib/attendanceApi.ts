import { apiBlob, apiFetch } from './api';
import { saveBlob } from './files';

export type AttendanceDayDto = {
  date: string;
  employeeId?: string;
  status: 'present' | 'absent' | 'half_day' | 'holiday' | 'leave' | 'weekend' | 'missing_punch' | string;
  checkIn: string | null;
  checkOut: string | null;
  workMinutes?: number | null;
  lateMinutes?: number | null;
  earlyMinutes?: number | null;
  breakMinutes?: number | null;
  missingPunch: boolean;
  note: string;
  locked?: boolean;
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
  timeZone?: string;
  webPunchEnabled: boolean;
  shift: { name: string; startTime: string; endTime: string; breakMinutes?: number } | null;
  days: AttendanceDayDto[];
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

const UI_STATUS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half day',
  holiday: 'Holiday',
  leave: 'Leave',
  weekend: 'Weekend',
  missing_punch: 'Missing punch',
};

export function uiStatus(status: string) {
  return UI_STATUS[status] ?? status;
}

export function fetchMyAttendance(year: number, month: number) {
  return apiFetch<MyAttendance>(`/attendance/me?year=${year}&month=${month}`);
}

export function punchMe(direction: 'IN' | 'OUT', date?: string) {
  return apiFetch<{ duplicate: boolean; day: AttendanceDayDto | null }>('/attendance/me/punches', {
    method: 'POST',
    body: JSON.stringify({ direction, date }),
  });
}

export function requestAttendanceCorrection(input: {
  date: string;
  requestedStatus: 'present' | 'absent' | 'leave';
  reason: string;
  checkIn?: string;
  checkOut?: string;
}) {
  return apiFetch<AttendanceCorrectionDto>('/attendance/me/corrections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchTeamAttendance(year: number, month: number) {
  return apiFetch<{
    exceptions: Array<AttendanceDayDto & { person: NonNullable<AttendanceCorrectionDto['person']> | null }>;
    corrections: AttendanceCorrectionDto[];
  }>(`/attendance/team?year=${year}&month=${month}`);
}

export function decideCorrection(id: string, status: 'Approved' | 'Rejected', note?: string) {
  return apiFetch<AttendanceCorrectionDto>(`/attendance/team/corrections/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  });
}

export function fetchAttendanceExceptions(year: number, month: number) {
  return apiFetch<
    Array<AttendanceDayDto & { person: NonNullable<AttendanceCorrectionDto['person']> | null }>
  >(`/attendance/exceptions?year=${year}&month=${month}`);
}

export function fetchUnmatchedPunches() {
  return apiFetch<
    Array<{ id: string; pin: string; rawTimestamp: string; serial: string; deviceName: string | null }>
  >('/attendance/unmatched');
}

export function mapUnmatchedPunch(id: string, employeeId: string) {
  return apiFetch<{ ok: boolean }>(`/attendance/unmatched/${id}/map`, {
    method: 'POST',
    body: JSON.stringify({ employeeId }),
  });
}

export function fetchAttendancePeriod(year: number, month: number) {
  return apiFetch<{ year: number; month: number; status: 'open' | 'locked'; lockedAt: string | null }>(
    `/attendance/periods/${year}/${month}`,
  );
}

export function lockAttendancePeriod(year: number, month: number) {
  return apiFetch<{ year: number; month: number; status: 'locked' }>(
    `/attendance/periods/${year}/${month}/lock`,
    { method: 'POST' },
  );
}

export function fetchShifts() {
  return apiFetch<ShiftDto[]>('/attendance/shifts');
}

export function fetchHolidays() {
  return apiFetch<HolidayDto[]>('/attendance/holidays');
}

export function createHoliday(input: { date: string; name: string; locationId?: string }) {
  return apiFetch<HolidayDto>('/attendance/holidays', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchDevices() {
  return apiFetch<{
    devices: AttendanceDevice[];
    operationLogs: Array<{ id: string; kind: string; raw: string; createdAt: string }>;
  }>('/attendance/devices');
}

export function createDevice(input: {
  serial: string;
  name: string;
  locationId?: string;
  directionMode?: 'device' | 'inferred';
}) {
  return apiFetch<AttendanceDevice>('/attendance/devices', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function enrollDevice(deviceId: string, employeeId: string, pin: string) {
  return apiFetch(`/attendance/devices/${deviceId}/enrollments`, {
    method: 'POST',
    body: JSON.stringify({ employeeId, pin }),
  });
}

export function overrideDay(
  employeeId: string,
  date: string,
  input: { status: 'present' | 'absent' | 'leave'; reason: string; checkIn?: string; checkOut?: string },
) {
  return apiFetch<AttendanceDayDto | null>(`/attendance/days/${employeeId}/${date}/override`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function downloadRegister(year: number, month: number) {
  const blob = await apiBlob(`/attendance/register/${year}/${month}`);
  await saveBlob(blob, `attendance-${year}-${String(month).padStart(2, '0')}.csv`);
}
