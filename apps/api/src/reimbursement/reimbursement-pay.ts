export function nextMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Approved claims stay on the expense month until that salary is paid, then move to the next open month. */
export function reimbursementPayMonth(
  expenseMonth: string,
  salaryMonth: string,
  lines: Array<{ month: string; paymentStatus: string }>,
) {
  if (salaryMonth) return salaryMonth;
  let cursor = expenseMonth;
  for (let step = 0; step < 24; step += 1) {
    const line = lines.find((item) => item.month === cursor);
    if (!line || (line.paymentStatus !== 'paid' && line.paymentStatus !== 'direct')) return cursor;
    cursor = nextMonth(cursor);
  }
  return cursor;
}
