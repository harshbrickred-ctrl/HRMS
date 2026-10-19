export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export type ClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function zonedParts(instant: Date, timeZone: string): ClockParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(instant)) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

export function isoDate(parts: { year: number; month: number; day: number }) {
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

export function hhmmss(parts: { hour: number; minute: number; second: number }) {
  const hour = String(parts.hour).padStart(2, '0');
  const minute = String(parts.minute).padStart(2, '0');
  const second = String(parts.second).padStart(2, '0');
  return `${hour}:${minute}:${second}`;
}

export function todayIso(timeZone: string, now = new Date()) {
  return isoDate(zonedParts(now, timeZone));
}

export function localStamp(timeZone: string, now = new Date()) {
  const parts = zonedParts(now, timeZone);
  return `${isoDate(parts)} ${hhmmss(parts)}`;
}

export function parseHm(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return isoDate({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  });
}

export function dateOnlyUtc(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isoFromDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function withSeconds(time: string) {
  return time.length === 5 ? `${time}:00` : time;
}

/** Wall-clock time in `timeZone` converted to a UTC instant. */
export function wallToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = withSeconds(time).split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  let utc = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(utc), timeZone);
    const got = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const delta = target - got;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

export function weekdayIndex(iso: string, timeZone: string) {
  const noon = wallToUtc(iso, '12:00:00', timeZone);
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(noon);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** Devices copy the Date header onto their clock, so the header carries wall time. */
export function httpDateHeader(timeZone: string, now = new Date()) {
  const parts = zonedParts(now, timeZone);
  const stamped = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
  return stamped.toUTCString();
}

export type ShiftClock = {
  startTime: string;
  endTime: string;
  overnight: boolean;
};

export function businessDateFor(instant: Date, timeZone: string, shift: ShiftClock | null) {
  const parts = zonedParts(instant, timeZone);
  const date = isoDate(parts);
  if (!shift?.overnight) return date;
  const minutes = parts.hour * 60 + parts.minute;
  if (minutes <= parseHm(shift.endTime)) return addDays(date, -1);
  return date;
}

export function shiftBounds(date: string, shift: ShiftClock, timeZone: string) {
  const start = wallToUtc(date, shift.startTime, timeZone);
  const endDate =
    shift.overnight || parseHm(shift.endTime) <= parseHm(shift.startTime)
      ? addDays(date, 1)
      : date;
  const end = wallToUtc(endDate, shift.endTime, timeZone);
  return { start, end };
}

export function eachDate(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dates: string[] = [];
  for (let day = 1; day <= last; day += 1) {
    dates.push(isoDate({ year, month, day }));
  }
  return dates;
}
