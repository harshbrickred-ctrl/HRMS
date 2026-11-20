import { buildAttendancePay } from './pay-attendance';

describe('attendance pay', () => {
  const dates = [
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
    '2026-11-05',
    '2026-11-06',
    '2026-11-07',
    '2026-11-08',
  ];

  it('counts weekdays, present, paid leave and unpaid leave', () => {
    const sheet = buildAttendancePay({
      dates,
      holidays: ['2026-11-05'],
      attendance: [
        { date: '2026-11-02', status: 'present' },
        { date: '2026-11-03', status: 'present' },
        { date: '2026-11-04', status: 'half_day' },
        { date: '2026-11-06', status: 'absent', explicitAbsent: true },
      ],
      leaves: [
        {
          code: 'CL',
          status: 'Approved',
          fromDate: '2026-11-03',
          toDate: '2026-11-03',
          halfStart: true,
          halfEnd: false,
        },
      ],
    });
    expect(sheet.workingDays).toBe(4);
    expect(sheet.present).toBe(2);
    expect(sheet.paidLeave).toBe(0.5);
    expect(sheet.unpaidLeave).toBe(1.5);
    expect(sheet.payableDays).toBe(2.5);
  });

  it('deducts pending leave from payable days', () => {
    const sheet = buildAttendancePay({
      dates: ['2026-11-02'],
      holidays: [],
      attendance: [],
      leaves: [
        {
          code: 'LOP',
          status: 'Pending',
          fromDate: '2026-11-02',
          toDate: '2026-11-02',
          halfStart: false,
          halfEnd: false,
        },
      ],
    });
    expect(sheet.present).toBe(0);
    expect(sheet.unpaidLeave).toBe(1);
    expect(sheet.pendingLeaveDays).toBe(1);
    expect(sheet.payableDays).toBe(0);
  });

  it('keeps an automatic absent day payable until HR marks it absent', () => {
    const sheet = buildAttendancePay({
      dates: ['2026-11-02'],
      holidays: [],
      attendance: [{ date: '2026-11-02', status: 'absent' }],
      leaves: [],
    });
    expect(sheet.workingDays).toBe(1);
    expect(sheet.present).toBe(1);
    expect(sheet.payableDays).toBe(1);
    expect(sheet.unpaidLeave).toBe(0);
  });
});
