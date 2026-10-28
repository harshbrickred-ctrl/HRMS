import { addDays } from '../attendance/clock';

function isWeekend(iso: string) {
  const dow = new Date(`${iso}T12:00:00.000Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

function hasWorkingDay(from: string, to: string, holidaySet: Set<string>) {
  if (to < from) return false;
  let cursor = from;
  while (cursor <= to) {
    if (!isWeekend(cursor) && !holidaySet.has(cursor)) return true;
    cursor = addDays(cursor, 1);
  }
  return false;
}

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
    if (!isWeekend(cursor) && !holidaySet.has(cursor)) days += 1;
    cursor = addDays(cursor, 1);
  }
  if (days === 0) return 0;
  cursor = addDays(start, 1);
  while (cursor < end) {
    if (
      isWeekend(cursor) &&
      hasWorkingDay(start, addDays(cursor, -1), holidaySet) &&
      hasWorkingDay(addDays(cursor, 1), end, holidaySet)
    ) {
      days += 1;
    }
    cursor = addDays(cursor, 1);
  }
  const oneHalf = halfDayStart !== halfDayEnd;
  if (!oneHalf) return days;
  if (start === end) return 0.5;
  return Math.max(0.5, days - 0.5);
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
