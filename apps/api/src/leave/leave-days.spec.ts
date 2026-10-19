import { eachWorkingDate, workingDaysBetween } from './leave-days';

describe('workingDaysBetween', () => {
  it('counts weekdays and skips holidays', () => {
    expect(workingDaysBetween('2026-10-19', '2026-10-23', ['2026-10-21'], false, false)).toBe(4);
  });

  it('supports a single half day', () => {
    expect(workingDaysBetween('2026-10-20', '2026-10-20', [], true, false)).toBe(0.5);
  });

  it('lists working dates for attendance leave', () => {
    expect(eachWorkingDate('2026-10-19', '2026-10-21', ['2026-10-20'])).toEqual([
      '2026-10-19',
      '2026-10-21',
    ]);
  });
});
