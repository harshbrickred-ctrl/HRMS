import { formatSalary, type SalaryStatement, type SheetRow } from './salaryApi';
import './salary.css';

function MoneyTable({ title, rows, net, netYtd }: { title: string; rows: SheetRow[]; net?: number; netYtd?: number }) {
  return (
    <div className="salary-scroll">
      <table className="salary-table">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Component</th>
            <th>This month</th>
            <th>Year to date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.id}-${row.label}`}>
              <td>{row.id}</td>
              <td>{row.label}</td>
              <td>{formatSalary(row.month)}</td>
              <td>{formatSalary(row.ytd)}</td>
            </tr>
          ))}
          {net != null && netYtd != null ? (
            <tr>
              <td>NET-02</td>
              <td>Net pay</td>
              <td>{formatSalary(net)}</td>
              <td>{formatSalary(netYtd)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function SalarySheet({ statement }: { statement: SalaryStatement }) {
  const failed = statement.checks.filter((check) => !check.ok);
  return (
    <section className="salary-sheet">
      <h2>Payslip for {statement.month}</h2>
      <p className="salary-note">{statement.paidDaysNote} Employer PF, ESI, EDLI and gratuity are not deducted from the employee.</p>
      <div className="salary-sheet-grid">
        <MoneyTable title="Earnings (SAL-20)" rows={statement.earnings} />
        <MoneyTable
          title="Deductions (NET-01)"
          rows={statement.deductions}
          net={statement.netPay}
          netYtd={statement.netPayYtd}
        />
        <MoneyTable title="Employer cost (SAL-22)" rows={statement.employer} />
        <div className="salary-scroll">
          <table className="salary-table">
            <caption>Form 130 preview (paid to date)</caption>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Line</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {statement.form130.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.label}</td>
                  <td>{formatSalary(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className={failed.length ? 'ess-alert' : 'salary-note'}>
        {failed.length
          ? failed.map((check) => `${check.id}: ${check.detail}`).join(' ')
          : 'Payslip checks V-02 through V-09 and the YTD roll-forward passed.'}
      </p>
    </section>
  );
}
