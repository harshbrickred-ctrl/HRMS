import { eachWorkingDate, workingDaysBetween } from './leave-days';

describe('workingDaysBetween', () => {
  it('counts weekdays and skips holidays', () => {
    expect(workingDaysBetween('2026-10-19', '2026-10-23', ['2026-10-21'], false, false)).toBe(4);
  });

  it('supports a single half day', () => {
    expect(workingDaysBetween('2026-10-20', '2026-10-20', [], true, false)).toBe(0.5);
    expect(workingDaysBetween('2026-10-20', '2026-10-20', [], false, true)).toBe(0.5);
  });

  it('sandwiches the weekend when leave covers Friday and Monday', () => {
    expect(workingDaysBetween('2026-10-23', '2026-10-26', [], false, false)).toBe(4);
    expect(workingDaysBetween('2026-10-23', '2026-10-23', [], false, false)).toBe(1);
    expect(workingDaysBetween('2026-10-26', '2026-10-26', [], false, false)).toBe(1);
    expect(workingDaysBetween('2026-10-23', '2026-10-25', [], false, false)).toBe(1);
  });

  it('counts a full day when both halves are selected or neither is', () => {
    expect(workingDaysBetween('2026-10-20', '2026-10-20', [], true, true)).toBe(1);
    expect(workingDaysBetween('2026-10-20', '2026-10-20', [], false, false)).toBe(1);
  });

  it('lists working dates for attendance leave', () => {
    expect(eachWorkingDate('2026-10-19', '2026-10-21', ['2026-10-20'])).toEqual([
      '2026-10-19',
      '2026-10-21',
    ]);
  });
});
