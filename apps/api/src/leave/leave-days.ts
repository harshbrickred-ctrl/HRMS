import { addDays } from '../attendance/clock';

export function workingDaysBetween(
  start: string,
  end: string,
  holidayDates: string[],
  halfDayStart: boolean,
  halfDayEnd: boolean,
): number {
  const holidaySet = new Set(holidayDates);
  if (end < start) return 0;
  let days = 0;
  let cursor = start;
  while (cursor <= end) {
    const dow = new Date(`${cursor}T12:00:00.000Z`).getUTCDay();
    if (dow !== 0 && dow !== 6 && !holidaySet.has(cursor)) {
      days += 1;
    }
    cursor = addDays(cursor, 1);
  }
  if (days === 0) return 0;
  if (start === end && (halfDayStart || halfDayEnd)) return 0.5;
  let result = days;
  if (halfDayStart) result -= 0.5;
  if (halfDayEnd && start !== end) result -= 0.5;
  return Math.max(0.5, result);
}

export function eachWorkingDate(
  start: string,
  end: string,
  holidayDates: string[],
): string[] {
  const holidaySet = new Set(holidayDates);
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    const dow = new Date(`${cursor}T12:00:00.000Z`).getUTCDay();
    if (dow !== 0 && dow !== 6 && !holidaySet.has(cursor)) {
      dates.push(cursor);
    }
    cursor = addDays(cursor, 1);
  }
  return dates;
}
