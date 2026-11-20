import { reimbursementPayMonth } from './reimbursement-pay';

describe('reimbursementPayMonth', () => {
  it('uses the expense month when that salary is still open', () => {
    expect(reimbursementPayMonth('2026-11', '', [])).toBe('2026-11');
    expect(
      reimbursementPayMonth('2026-10', '', [{ month: '2026-10', paymentStatus: 'pending' }]),
    ).toBe('2026-10');
  });

  it('keeps a claim on the month already written into salary', () => {
    expect(reimbursementPayMonth('2026-10', '2026-11', [])).toBe('2026-11');
  });

  it('moves the claim forward after the expense month is paid', () => {
    expect(
      reimbursementPayMonth('2026-10', '', [{ month: '2026-10', paymentStatus: 'paid' }]),
    ).toBe('2026-11');
    expect(
      reimbursementPayMonth('2026-10', '', [{ month: '2026-10', paymentStatus: 'direct' }]),
    ).toBe('2026-11');
  });
});
