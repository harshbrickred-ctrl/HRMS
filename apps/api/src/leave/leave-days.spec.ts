import { eachWorkingDate, workingDaysBetween } from './leave-days';

describe('workingDaysBetween', () => {
  it('counts weekdays and skips holidays', () => {
    expect(workingDaysBetween('2026-10-19', '2026-10-23', ['2026-10-21'], false, false)).toBe(4);
  });

  it('supports a single half day', () => {
    expect(workingDaysBetween('2026-10-20', '2026-10-20', [], true, false)).toBe(0.5);
    expect(workingDaysBetween('2026-10-20', '2026-10-20', [], false, true)).toBe(0.5);
  });

  it('sandwiches the weekend only when earned leave covers Friday and Monday', () => {
    expect(workingDaysBetween('2026-10-23', '2026-10-26', [], false, false, true)).toBe(4);
    expect(workingDaysBetween('2026-10-23', '2026-10-26', [], false, false, false)).toBe(2);
    expect(workingDaysBetween('2026-10-23', '2026-10-23', [], false, false, true)).toBe(1);
    expect(workingDaysBetween('2026-10-26', '2026-10-26', [], false, false, true)).toBe(1);
    expect(workingDaysBetween('2026-10-23', '2026-10-25', [], false, false, true)).toBe(1);
  });

  it('counts a full day when both halves are selected or neither is on one day', () => {
    expect(workingDaysBetween('2026-10-20', '2026-10-20', [], true, true)).toBe(1);
    expect(workingDaysBetween('2026-10-20', '2026-10-20', [], false, false)).toBe(1);
  });

  it('lets a multi-day range take a half day on the start and the end', () => {
    expect(workingDaysBetween('2026-10-19', '2026-10-21', [], true, true)).toBe(2);
    expect(workingDaysBetween('2026-10-19', '2026-10-21', [], true, false)).toBe(2.5);
    expect(workingDaysBetween('2026-10-19', '2026-10-20', [], true, true)).toBe(1);
    expect(workingDaysBetween('2026-10-23', '2026-10-26', [], true, true, true)).toBe(3);
  });

  it('lists working dates for attendance leave', () => {
    expect(eachWorkingDate('2026-10-19', '2026-10-21', ['2026-10-20'])).toEqual([
      '2026-10-19',
      '2026-10-21',
    ]);
  });
});
