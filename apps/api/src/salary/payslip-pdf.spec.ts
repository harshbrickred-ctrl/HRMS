import { buildPayslipPdf, inrWords, payslipFileName, payslipMonthLabel } from './payslip-pdf';

describe('payslip pdf', () => {
  it('writes Indian rupee words without an extra and', () => {
    expect(inrWords(104439)).toBe('One Lakh Four Thousand Four Hundred Thirty Nine');
    expect(inrWords(48429)).toBe('Forty Eight Thousand Four Hundred Twenty Nine');
  });

  it('builds a one-page payslip in the salary slip layout', () => {
    const pdf = buildPayslipPdf({
      companyName: 'Brickred Systems',
      month: '2026-11',
      employeeName: 'Rohan Mehta',
      employeeCode: 'BR106',
      designation: 'Accountant',
      department: 'FINANCE',
      location: 'Delhi',
      bankName: 'ICICI Bank',
      bankAccount: '00440122334455',
      paidDays: 30,
      lopDays: 0,
      earnings: [
        { label: 'BASIC', full: 40000, actual: 40000 },
        { label: 'HRA', full: 16000, actual: 16000 },
        { label: 'SPECIAL ALLOWANCE', full: 4000, actual: 4000 },
      ],
      deductions: [
        { label: 'PF', actual: 1800 },
        { label: 'INCOME TAX', actual: 200 },
      ],
      totalEarningsFull: 60000,
      totalEarnings: 60000,
      totalDeductions: 2000,
      netPay: 58000,
      printedAt: new Date('2026-11-12T09:10:00.000Z'),
    });
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('Payslip for the month of November 2026');
    expect(text).toContain('Rohan Mehta');
    expect(text).toContain('BR106');
    expect(text).toContain('Total Earnings:INR.');
    expect(text).toContain('Rupees Fifty Eight Thousand Only');
    expect(text).toContain('This is a system generated payslip and does not require signature.');
    expect(payslipMonthLabel('2026-07')).toBe('July 2026');
    expect(payslipFileName('2026-11')).toBe('Payslip_Nov_2026.pdf');
  });
});
