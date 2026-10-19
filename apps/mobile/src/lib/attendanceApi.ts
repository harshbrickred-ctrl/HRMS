import { apiFetch } from './api';

export type AttendanceDayDto = {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  note: string;
  missingPunch: boolean;
};

export type MyAttendance = {
  webPunchEnabled: boolean;
  days: AttendanceDayDto[];
  shift: { name: string; startTime: string; endTime: string } | null;
};

export function fetchMyAttendance(year: number, month: number) {
  return apiFetch<MyAttendance>(`/attendance/me?year=${year}&month=${month}`);
}

export function punchMe(direction: 'IN' | 'OUT') {
  return apiFetch<{ duplicate: boolean; day: AttendanceDayDto | null }>('/attendance/me/punches', {
    method: 'POST',
    body: JSON.stringify({ direction }),
  });
}

export function uiStatus(status: string) {
  const map: Record<string, string> = {
    present: 'Present',
    absent: 'Absent',
    half_day: 'Half day',
    holiday: 'Holiday',
    leave: 'Leave',
    weekend: 'Weekend',
    missing_punch: 'Missing punch',
  };
  return map[status] ?? status;
}
