import {
  addDays,
  businessDateFor,
  parseHm,
  shiftBounds,
  todayIso,
  weekdayIndex,
  zonedParts,
  type ShiftClock,
} from './clock';

export type PunchDirectionName =
  | 'IN'
  | 'OUT'
  | 'BREAK_OUT'
  | 'BREAK_IN'
  | 'OT_IN'
  | 'OT_OUT';

export type SummaryPunch = {
  at: Date;
  direction: PunchDirectionName | null;
};

export type DayStatusName =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'holiday'
  | 'leave'
  | 'weekend'
  | 'missing_punch';

export type DayPolicy = {
  graceMinutes: number;
  halfDayMaxMinutes: number;
  duplicateWindowMinutes: number;
};

export type ShiftRule = ShiftClock & { breakMinutes: number };

export type SummaryInput = {
  timeZone: string;
  businessDate: string;
  now: Date;
  shift: ShiftRule | null;
  policy: DayPolicy;
  holiday: boolean;
  overrideStatus: 'present' | 'absent' | 'leave' | null;
  punches: SummaryPunch[];
};

export type DaySummary = {
  status: DayStatusName;
  firstInAt: Date | null;
  lastOutAt: Date | null;
  workMinutes: number | null;
  lateMinutes: number | null;
  earlyMinutes: number | null;
  breakMinutes: number | null;
  missingPunch: boolean;
  persist: boolean;
};

export function canRebuild(periodLocked: boolean, force: boolean) {
  return force || !periodLocked;
}

export function directionFromStatus(code: number): PunchDirectionName | null {
  switch (code) {
    case 0:
      return 'IN';
    case 1:
      return 'OUT';
    case 2:
      return 'BREAK_OUT';
    case 3:
      return 'BREAK_IN';
    case 4:
      return 'OT_IN';
    case 5:
      return 'OT_OUT';
    default:
      return null;
  }
}

function collapse(punches: SummaryPunch[], windowMinutes: number) {
  const sorted = [...punches].sort((a, b) => a.at.getTime() - b.at.getTime());
  const kept: SummaryPunch[] = [];
  for (const punch of sorted) {
    const previous = kept[kept.length - 1];
    const close =
      previous &&
      punch.at.getTime() - previous.at.getTime() < windowMinutes * 60_000 &&
      punch.direction === previous.direction;
    if (close) continue;
    kept.push(punch);
  }
  return kept;
}

function assignDirections(punches: SummaryPunch[]) {
  if (punches.length === 0) return punches;
  if (punches.every((punch) => punch.direction)) return punches;
  if (punches.length === 1) return [{ ...punches[0], direction: 'IN' as const }];
  return punches.map((punch, index) => {
    if (index === 0) return { ...punch, direction: 'IN' as const };
    if (index === punches.length - 1) return { ...punch, direction: 'OUT' as const };
    return { ...punch, direction: null };
  });
}

export function summarizeDay(input: SummaryInput): DaySummary {
  const kept = assignDirections(
    collapse(input.punches, input.policy.duplicateWindowMinutes),
  ).filter((punch) => punch.direction);
  const directed = kept as Array<SummaryPunch & { direction: PunchDirectionName }>;

  let sawBreak = false;
  let workMs = 0;
  let breakMs = 0;
  let openWork: Date | null = null;
  let openBreak: Date | null = null;
  let firstInAt: Date | null = null;
  let lastOutAt: Date | null = null;

  for (const punch of directed) {
    if (punch.direction === 'IN' || punch.direction === 'OT_IN') {
      if (!firstInAt) firstInAt = punch.at;
      if (!openWork) openWork = punch.at;
    } else if (punch.direction === 'BREAK_OUT') {
      sawBreak = true;
      if (openWork) {
        workMs += punch.at.getTime() - openWork.getTime();
        openWork = null;
      }
      openBreak = punch.at;
    } else if (punch.direction === 'BREAK_IN') {
      sawBreak = true;
      if (openBreak) {
        breakMs += punch.at.getTime() - openBreak.getTime();
        openBreak = null;
      }
      if (!openWork) openWork = punch.at;
    } else if (punch.direction === 'OUT' || punch.direction === 'OT_OUT') {
      lastOutAt = punch.at;
      if (openWork) {
        workMs += punch.at.getTime() - openWork.getTime();
        openWork = null;
      }
    }
  }

  const bounds = input.shift
    ? shiftBounds(input.businessDate, input.shift, input.timeZone)
    : null;
  const closed = isClosed(input, bounds?.end ?? null);
  const missingPunch = openWork != null && closed;

  let workMinutes = directed.length ? Math.max(0, Math.round(workMs / 60_000)) : null;
  let breakMinutes = directed.length ? Math.max(0, Math.round(breakMs / 60_000)) : null;
  if (!sawBreak && firstInAt && lastOutAt && input.shift) {
    const span = Math.round((lastOutAt.getTime() - firstInAt.getTime()) / 60_000);
    breakMinutes = input.shift.breakMinutes;
    workMinutes = Math.max(0, span - input.shift.breakMinutes);
  }

  if (openWork && !closed) {
    workMinutes = null;
    breakMinutes = null;
  }

  const lateMinutes = lateOf(firstInAt, bounds?.start ?? null, input);
  const earlyMinutes = earlyOf(lastOutAt, bounds?.end ?? null, input);
  const weekend = weekdayIndex(input.businessDate, input.timeZone) % 6 === 0;
  const noPunches = directed.length === 0;

  let status: DayStatusName = 'present';
  let persist = true;
  if (input.holiday) status = 'holiday';
  else if (input.overrideStatus === 'leave') status = 'leave';
  else if (input.overrideStatus === 'absent') status = 'absent';
  else if (noPunches && weekend) status = 'weekend';
  else if (noPunches && !closed) persist = false;
  else if (noPunches) status = 'absent';
  else if (missingPunch) status = 'missing_punch';
  else if (input.overrideStatus === 'present') status = 'present';
  else if (workMinutes != null && workMinutes < input.policy.halfDayMaxMinutes) status = 'half_day';
  else status = 'present';

  return {
    status,
    firstInAt,
    lastOutAt,
    workMinutes,
    lateMinutes,
    earlyMinutes,
    breakMinutes,
    missingPunch,
    persist,
  };
}

function isClosed(input: SummaryInput, shiftEnd: Date | null) {
  const today = todayIso(input.timeZone, input.now);
  if (input.businessDate < today) return true;
  if (input.businessDate > today) return false;
  if (!shiftEnd) return false;
  const cutoff = shiftEnd.getTime() + input.policy.graceMinutes * 60_000;
  return input.now.getTime() >= cutoff;
}

function lateOf(firstIn: Date | null, shiftStart: Date | null, input: SummaryInput) {
  if (!firstIn || !shiftStart) return null;
  const late = Math.round((firstIn.getTime() - shiftStart.getTime()) / 60_000);
  return Math.max(0, late - input.policy.graceMinutes);
}

function earlyOf(lastOut: Date | null, shiftEnd: Date | null, input: SummaryInput) {
  if (!lastOut || !shiftEnd) return null;
  const early = Math.round((shiftEnd.getTime() - lastOut.getTime()) / 60_000);
  return Math.max(0, early - input.policy.graceMinutes);
}

export function resolveBusinessDate(
  instant: Date,
  timeZone: string,
  shift: ShiftClock | null,
) {
  return businessDateFor(instant, timeZone, shift);
}

export function minutesOf(instant: Date, timeZone: string) {
  const parts = zonedParts(instant, timeZone);
  return parseHm(`${parts.hour}:${parts.minute}`);
}

export { addDays };
