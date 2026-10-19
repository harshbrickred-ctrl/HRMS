import { businessDateFor, wallToUtc } from './clock';
import { canRebuild, directionFromStatus, summarizeDay } from './day-math';

const tz = 'Asia/Kolkata';
const policy = { graceMinutes: 10, halfDayMaxMinutes: 300, duplicateWindowMinutes: 5 };
const general = {
  startTime: '09:00',
  endTime: '18:00',
  breakMinutes: 60,
  overnight: false,
};

function at(date: string, time: string) {
  return wallToUtc(date, time, tz);
}

describe('summarizeDay', () => {
  it('converts a Kolkata wall clock punch to UTC', () => {
    expect(at('2026-10-15', '09:00').toISOString()).toBe('2026-10-15T03:30:00.000Z');
  });

  it('keeps an overnight punch on the shift start date', () => {
    const night = {
      startTime: '22:00',
      endTime: '06:00',
      breakMinutes: 0,
      overnight: true,
    };
    expect(businessDateFor(at('2026-10-16', '05:00'), tz, night)).toBe('2026-10-15');
    expect(businessDateFor(at('2026-10-15', '22:30'), tz, night)).toBe('2026-10-15');
    const summary = summarizeDay({
      timeZone: tz,
      businessDate: '2026-10-15',
      now: at('2026-10-16', '12:00'),
      shift: night,
      policy,
      holiday: false,
      overrideStatus: null,
      punches: [
        { at: at('2026-10-15', '22:05'), direction: 'IN' },
        { at: at('2026-10-16', '06:00'), direction: 'OUT' },
      ],
    });
    expect(summary.status).toBe('present');
    expect(summary.workMinutes).toBe(475);
  });

  it('uses first and last punch when direction is inferred', () => {
    const summary = summarizeDay({
      timeZone: tz,
      businessDate: '2026-10-15',
      now: at('2026-10-16', '12:00'),
      shift: general,
      policy,
      holiday: false,
      overrideStatus: null,
      punches: [
        { at: at('2026-10-15', '09:06'), direction: null },
        { at: at('2026-10-15', '18:00'), direction: null },
      ],
    });
    expect(summary.status).toBe('present');
    expect(summary.lateMinutes).toBe(0);
    expect(summary.workMinutes).toBe(474);
  });

  it('trusts device in, break, and out directions', () => {
    const summary = summarizeDay({
      timeZone: tz,
      businessDate: '2026-10-15',
      now: at('2026-10-16', '12:00'),
      shift: general,
      policy,
      holiday: false,
      overrideStatus: null,
      punches: [
        { at: at('2026-10-15', '09:00'), direction: directionFromStatus(0) },
        { at: at('2026-10-15', '13:00'), direction: directionFromStatus(2) },
        { at: at('2026-10-15', '14:00'), direction: directionFromStatus(3) },
        { at: at('2026-10-15', '18:00'), direction: directionFromStatus(1) },
      ],
    });
    expect(summary.workMinutes).toBe(480);
    expect(summary.breakMinutes).toBe(60);
    expect(summary.status).toBe('present');
  });

  it('marks a holiday instead of an absence', () => {
    const summary = summarizeDay({
      timeZone: tz,
      businessDate: '2026-10-02',
      now: at('2026-10-03', '12:00'),
      shift: general,
      policy,
      holiday: true,
      overrideStatus: null,
      punches: [],
    });
    expect(summary.status).toBe('holiday');
    expect(summary.persist).toBe(true);
  });

  it('marks a past working day with no punches absent', () => {
    const summary = summarizeDay({
      timeZone: tz,
      businessDate: '2026-10-01',
      now: at('2026-10-03', '12:00'),
      shift: general,
      policy,
      holiday: false,
      overrideStatus: null,
      punches: [],
    });
    expect(summary.status).toBe('absent');
  });

  it('marks a short day as half day', () => {
    const summary = summarizeDay({
      timeZone: tz,
      businessDate: '2026-10-15',
      now: at('2026-10-16', '12:00'),
      shift: general,
      policy,
      holiday: false,
      overrideStatus: null,
      punches: [
        { at: at('2026-10-15', '09:00'), direction: 'IN' },
        { at: at('2026-10-15', '13:00'), direction: 'OUT' },
      ],
    });
    expect(summary.workMinutes).toBe(180);
    expect(summary.status).toBe('half_day');
  });

  it('applies a leave override without dropping punches', () => {
    const summary = summarizeDay({
      timeZone: tz,
      businessDate: '2026-10-15',
      now: at('2026-10-16', '12:00'),
      shift: general,
      policy,
      holiday: false,
      overrideStatus: 'leave',
      punches: [{ at: at('2026-10-15', '09:00'), direction: 'IN' }],
    });
    expect(summary.status).toBe('leave');
    expect(summary.firstInAt).not.toBeNull();
  });

  it('flags a missing punch only after the shift cutoff', () => {
    const open = summarizeDay({
      timeZone: tz,
      businessDate: '2026-10-15',
      now: at('2026-10-15', '12:00'),
      shift: general,
      policy,
      holiday: false,
      overrideStatus: null,
      punches: [{ at: at('2026-10-15', '09:12'), direction: 'IN' }],
    });
    expect(open.status).toBe('present');
    expect(open.missingPunch).toBe(false);
    expect(open.lateMinutes).toBe(2);

    const closed = summarizeDay({
      ...{
        timeZone: tz,
        businessDate: '2026-10-15',
        shift: general,
        policy,
        holiday: false,
        overrideStatus: null,
        punches: [{ at: at('2026-10-15', '09:12'), direction: 'IN' as const }],
      },
      now: at('2026-10-15', '18:11'),
    });
    expect(closed.status).toBe('missing_punch');
  });

  it('refuses a locked rebuild unless HR forces it', () => {
    expect(canRebuild(true, false)).toBe(false);
    expect(canRebuild(true, true)).toBe(true);
    expect(canRebuild(false, false)).toBe(true);
  });
});
