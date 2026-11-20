export type AttendanceSlice = { date: string; status: string; explicitAbsent?: boolean };

export type LeaveSlice = {
  code: string;
  status: string;
  fromDate: string;
  toDate: string;
  halfStart: boolean;
  halfEnd: boolean;
};

export type AttendancePay = {
  workingDays: number;
  present: number;
  paidLeave: number;
  unpaidLeave: number;
  payableDays: number;
  unmarkedDays: number;
  missingPunchDays: number;
  pendingLeaveDays: number;
  note: string;
};

function isWeekend(iso: string) {
  const dow = new Date(`${iso}T12:00:00.000Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

function halves(value: number) {
  return Math.round(value * 2) / 2;
}

function leaveUnits(date: string, leave: LeaveSlice) {
  if (date < leave.fromDate || date > leave.toDate) return 0;
  if (leave.fromDate === leave.toDate) return leave.halfStart ? 0.5 : 1;
  if (date === leave.fromDate && leave.halfStart) return 0.5;
  if (date === leave.toDate && leave.halfEnd) return 0.5;
  return 1;
}

export function buildAttendancePay(input: {
  dates: string[];
  holidays: string[];
  attendance: AttendanceSlice[];
  leaves: LeaveSlice[];
}): AttendancePay {
  const holidays = new Set(input.holidays);
  const attendance = new Map(input.attendance.map((day) => [day.date, day]));
  const working = input.dates.filter((date) => !isWeekend(date) && !holidays.has(date));
  let present = 0;
  let paidLeave = 0;
  let unpaidLeave = 0;
  let unmarkedDays = 0;
  let missingPunchDays = 0;
  let pendingLeaveDays = 0;

  for (const date of working) {
    let paid = 0;
    let unpaid = 0;
    for (const leave of input.leaves) {
      const units = leaveUnits(date, leave);
      if (!units) continue;
      if (leave.status === 'Pending') {
        pendingLeaveDays += units;
        unpaid += units;
        continue;
      }
      if (leave.status !== 'Approved') continue;
      if (leave.code === 'LOP') unpaid += units;
      else paid += units;
    }
    paid = Math.min(1, paid);
    unpaid = Math.min(1 - paid, unpaid);
    let remaining = 1 - paid - unpaid;
    const row = attendance.get(date);
    const status = row?.status === 'absent' && !row.explicitAbsent ? undefined : row?.status;
    if (remaining > 0 && !status) {
      present += remaining;
      unmarkedDays += remaining;
    } else if (remaining > 0 && (status === 'present' || status === 'holiday' || status === 'weekend')) {
      present += remaining;
    } else if (remaining > 0 && status === 'half_day') {
      const worked = Math.min(remaining, 0.5);
      present += worked;
      unpaid += remaining - worked;
    } else if (remaining > 0 && status === 'leave') {
      paid += remaining;
    } else if (remaining > 0 && status === 'missing_punch') {
      unpaid += remaining;
      missingPunchDays += remaining;
    } else if (remaining > 0) {
      unpaid += remaining;
    }
    paidLeave += paid;
    unpaidLeave += unpaid;
  }

  present = halves(present);
  paidLeave = halves(paidLeave);
  unpaidLeave = halves(unpaidLeave);
  const payableDays = halves(present + paidLeave);
  const notes: string[] = [];
  if (unmarkedDays > 0) {
    notes.push(
      `${halves(unmarkedDays)} working day(s) have no attendance row and are counted present until HR marks them.`,
    );
  }
  if (missingPunchDays > 0) {
    notes.push(`${halves(missingPunchDays)} missing punch day(s) are unpaid until the punch is corrected.`);
  }
  if (pendingLeaveDays > 0) {
    notes.push(`${halves(pendingLeaveDays)} pending leave day(s) are deducted from salary until the leave is approved.`);
  }
  return {
    workingDays: working.length,
    present,
    paidLeave,
    unpaidLeave,
    payableDays,
    unmarkedDays: halves(unmarkedDays),
    missingPunchDays: halves(missingPunchDays),
    pendingLeaveDays: halves(pendingLeaveDays),
    note: notes.join(' '),
  };
}
