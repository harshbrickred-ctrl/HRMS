import { formatSalary, type SalaryStatement, type SheetRow } from './salaryApi';
import { TaxSheet } from './TaxSheet';
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
  const tax = statement.taxBreakdown;

  return (
    <div className="salary-sheet-stack">
      <section className="salary-sheet">
        <h2>Payslip for {statement.month}</h2>
        <p className="salary-note">
          Net pay {formatSalary(statement.netPay)}.
          {statement.lopDays
            ? ` Loss of pay: ${statement.lopDays} day${statement.lopDays === 1 ? '' : 's'} deducted.`
            : ' No loss of pay this month.'}{' '}
          This month is one month of the yearly CTC. {statement.paidDaysNote}
        </p>
        <div className="salary-sheet-grid">
          <MoneyTable title="Earnings (SAL-20)" rows={statement.earnings} />
          <MoneyTable
            title="Deductions (NET-01)"
            rows={statement.deductions}
            net={statement.netPay}
            netYtd={statement.netPayYtd}
          />
        </div>
        <p className={failed.length ? 'ess-alert' : 'salary-note'}>
          {failed.length
            ? failed.map((check) => `${check.id}: ${check.detail}`).join(' ')
            : 'Payslip checks V-02 through V-09 and the YTD roll-forward passed.'}
        </p>
      </section>

      {tax ? (
        <TaxSheet
          breakdown={tax}
          title={`Tax computation · ${statement.month}`}
          note={`${tax.regime === 'old' ? 'Old' : 'New'} regime · slab rates, formulas, and this month's TDS split.`}
        />
      ) : (
        <section className="salary-sheet tax-sheet">
          <h2>Tax computation · {statement.month}</h2>
          <p className="ess-alert">
            Tax breakdown did not load with this payslip. Refresh the salary page (Ctrl+Shift+R) so the latest tax
            table can load.
          </p>
          {statement.form130?.length ? (
            <div className="salary-scroll">
              <table className="salary-table tax-table">
                <caption>Form 130 amounts (refresh for full formulas)</caption>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Particulars</th>
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
          ) : null}
        </section>
      )}
    </div>
  );
}
