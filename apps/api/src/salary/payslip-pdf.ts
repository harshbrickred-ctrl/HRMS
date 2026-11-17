export type PayslipAmount = { label: string; full: number; actual: number };
export type PayslipDeduction = { label: string; actual: number };

export type PayslipPdfInput = {
  companyName: string;
  month: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  location: string;
  bankName: string;
  bankAccount: string;
  paidDays: number;
  lopDays: number;
  earnings: PayslipAmount[];
  deductions: PayslipDeduction[];
  totalEarningsFull: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  printedAt: Date;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

export function payslipMonthLabel(month: string) {
  const [year, m] = month.split('-').map(Number);
  const name = new Date(Date.UTC(year, (m || 1) - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
  return `${name} ${year}`;
}

export function payslipFileName(month: string) {
  const [year, m] = month.split('-');
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1];
  return `Payslip_${short ?? month}_${year}.pdf`;
}

export function inrWords(amount: number) {
  const value = Math.round(Math.abs(amount));
  if (value === 0) return 'Zero';
  const crore = Math.floor(value / 10_000_000);
  const lakh = Math.floor((value % 10_000_000) / 100_000);
  const thousand = Math.floor((value % 100_000) / 1000);
  const hundred = Math.floor((value % 1000) / 100);
  const rest = value % 100;
  const parts: string[] = [];
  if (crore) parts.push(`${belowHundred(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(belowHundred(rest));
  return parts.join(' ');
}

function belowHundred(value: number) {
  if (value < 20) return ONES[value];
  const ten = Math.floor(value / 10);
  const one = value % 10;
  return one ? `${TENS[ten]} ${ONES[one]}` : TENS[ten];
}

export function buildPayslipPdf(input: PayslipPdfInput) {
  const ops: string[] = [];
  const left = 28;
  const right = PAGE_W - 28;
  const mid = 308;

  const text = (x: number, yFromTop: number, size: number, font: 'F1' | 'F2', value: string) => {
    const y = PAGE_H - yFromTop;
    ops.push(`BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(value)}) Tj ET`);
  };
  const center = (yFromTop: number, size: number, font: 'F1' | 'F2', value: string) => {
    text((PAGE_W - textWidth(value, size)) / 2, yFromTop, size, font, value);
  };
  const rightText = (edge: number, yFromTop: number, size: number, font: 'F1' | 'F2', value: string) => {
    text(edge - textWidth(value, size), yFromTop, size, font, value);
  };
  const hline = (x1: number, x2: number, yFromTop: number) => {
    const y = PAGE_H - yFromTop;
    ops.push(`${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l 0.6 w 0 0 0 RG S`);
  };
  const vline = (x: number, y1: number, y2: number) => {
    ops.push(`${x.toFixed(2)} ${(PAGE_H - y1).toFixed(2)} m ${x.toFixed(2)} ${(PAGE_H - y2).toFixed(2)} l 0.6 w 0 0 0 RG S`);
  };

  const boxTop = 24;
  center(46, 12, 'F2', input.companyName || 'Company');
  center(64, 11, 'F2', `Payslip for the month of ${payslipMonthLabel(input.month)}`);

  const details: Array<[string, string, string, string]> = [
    ['Name:', show(input.employeeName), 'Employee No:', show(input.employeeCode)],
    ['Joining Date:', '-', 'Bank Name:', show(input.bankName)],
    ['Designation:', show(input.designation), 'Bank Account No:', show(input.bankAccount)],
    ['Grade:', '-', 'PAN Number:', '-'],
    ['Department:', show(input.department), 'PF UAN:', '-'],
    ['Location:', show(input.location), '', ''],
    ['Effective Work Days:', String(input.paidDays), '', ''],
    ['LOP:', String(input.lopDays), '', ''],
  ];
  let y = 92;
  for (const [leftLabel, leftValue, rightLabel, rightValue] of details) {
    text(36, y, 9, 'F1', leftLabel);
    text(158, y, 9, 'F1', leftValue);
    if (rightLabel) {
      text(mid + 8, y, 9, 'F1', rightLabel);
      text(452, y, 9, 'F1', rightValue);
    }
    y += 14;
  }
  const detailBottom = y + 4;
  hline(left, right, 78);
  hline(left, right, detailBottom);
  vline(mid, 78, detailBottom);

  y = detailBottom + 16;
  text(36, y, 9, 'F2', 'Earnings');
  rightText(250, y, 9, 'F2', 'Full');
  rightText(300, y, 9, 'F2', 'Actual');
  text(mid + 8, y, 9, 'F2', 'Deductions');
  rightText(right - 8, y, 9, 'F2', 'Actual');
  const tableHead = y - 4;
  y += 16;
  const rowCount = Math.max(input.earnings.length, input.deductions.length, 1);
  for (let index = 0; index < rowCount; index += 1) {
    const earning = input.earnings[index];
    const deduction = input.deductions[index];
    if (earning) {
      text(36, y, 9, 'F1', earning.label);
      rightText(250, y, 9, 'F1', money(earning.full));
      rightText(300, y, 9, 'F1', money(earning.actual));
    }
    if (deduction) {
      text(mid + 8, y, 9, 'F1', deduction.label);
      rightText(right - 8, y, 9, 'F1', money(deduction.actual));
    }
    y += 14;
  }
  const tableBottom = y + 2;
  hline(left, right, tableHead);
  hline(left, right, tableBottom);
  vline(mid, tableHead, tableBottom + 22);

  y = tableBottom + 16;
  text(36, y, 10, 'F1', 'Total Earnings:INR.');
  rightText(250, y, 9, 'F1', money(input.totalEarningsFull));
  rightText(300, y, 9, 'F1', money(input.totalEarnings));
  text(mid + 8, y, 10, 'F1', 'Total Deductions:INR.');
  rightText(right - 8, y, 9, 'F1', money(input.totalDeductions));
  hline(left, right, y + 8);

  y += 26;
  text(36, y, 9, 'F1', 'Net Pay for the month ( Total Earnings - Total Deductions ):');
  text(360, y, 9, 'F2', money(input.netPay));
  y += 16;
  const words = input.netPay < 0 ? `Minus ${inrWords(input.netPay)}` : inrWords(input.netPay);
  text(36, y, 9, 'F2', `(Rupees ${words} Only)`);
  y += 22;
  center(y, 9, 'F1', 'This is a system generated payslip and does not require signature.');
  const boxBottom = y + 16;
  hline(left, right, boxTop);
  hline(left, right, boxBottom);
  vline(left, boxTop, boxBottom);
  vline(right, boxTop, boxBottom);

  text(36, PAGE_H - 28, 9, 'F1', `Print Date:${printStamp(input.printedAt)}`);
  return buildPdf(ops.join('\n'));
}

function show(value: string) {
  const text = value.trim();
  return text || '-';
}

function money(amount: number) {
  return String(Math.round(amount));
}

function printStamp(date: Date) {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return formatted.replace(',', '').replace(/\b(am|pm)\b/i, (part) => part.toUpperCase());
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function textWidth(value: string, size: number) {
  let width = 0;
  for (const char of value) {
    if (char === ' ') width += 0.28;
    else if (char >= '0' && char <= '9') width += 0.56;
    else if (/[A-Z]/.test(char)) width += 0.66;
    else width += 0.5;
  }
  return width * size;
}

function buildPdf(stream: string) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  let trailer = `xref\n0 ${objects.length + 1}\n`;
  trailer += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    trailer += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body + trailer);
}
