import { useEffect, useState } from 'react';
import { Download, IndianRupee } from 'lucide-react';
import { formatInr } from '../mock/EssDataContext';
import {
  INVESTMENT_PROOFS,
  IT_DECLARATION,
  IT_STATEMENT,
  REIMBURSEMENTS,
  SALARY_FY,
  SALARY_LOANS,
  SALARY_REVISION,
  SALARY_YTD,
  ytdTotals,
} from '../mock/salaryMock';
import { StatusChip } from '../components/StatusChip';
import { showToast } from '../../ui/toast';
import {
  downloadMyPayslip,
  fetchMyPayslips,
  type PayslipDto,
} from '../../workspace/payslipApi';
import { downloadSalarySlip, fetchMySalary, formatSalary, type MySalary } from '../../workspace/salaryApi';
import { SalarySheet } from '../../workspace/SalarySheet';

type Section =
  | 'payslips'
  | 'ytd'
  | 'statement'
  | 'declaration'
  | 'loans'
  | 'reimbursement'
  | 'proofs'
  | 'revision';

function slipMonth(month: string) {
  const [year, m] = month.split('-').map(Number);
  const name = new Date(Date.UTC(year, (m || 1) - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
  return `${name} ${year}`;
}

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'payslips', label: 'Payroll' },
  { id: 'ytd', label: 'YTD Reports' },
  { id: 'statement', label: 'IT Statement' },
  { id: 'declaration', label: 'IT Declaration' },
  { id: 'loans', label: 'Loans and advances' },
  { id: 'reimbursement', label: 'Reimbursement' },
  { id: 'proofs', label: 'Proof of Investment' },
  { id: 'revision', label: 'Salary revision' },
];

export function EssSalaryPage() {
  const [section, setSection] = useState<Section>('payslips');
  const [payslips, setPayslips] = useState<PayslipDto[]>([]);
  const [payroll, setPayroll] = useState<MySalary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const totals = ytdTotals(SALARY_YTD.months);

  useEffect(() => {
    fetchMyPayslips()
      .then((rows) => {
        setPayslips(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load payslips.'));
    fetchMySalary()
      .then(setPayroll)
      .catch(() => setPayroll(null));
  }, []);

  return (
    <div className="ess-section-stack">
      <header className="ess-leave-hero">
        <div className="ess-leave-hero-copy">
          <p className="ess-leave-kicker">
            <IndianRupee size={14} aria-hidden /> Pay
          </p>
          <h1>Salary</h1>
          <p className="ess-lead">
            Payroll, year-to-date and the Form 130 preview use the salary Finance generated. PDF files are separate. Sections without a generated payslip still show sample figures for FY {SALARY_FY}.
          </p>
        </div>
      </header>

      <div className="ess-salary-sections" role="tablist" aria-label="Salary sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={section === item.id}
            className={section === item.id ? 'is-active' : undefined}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'payslips' ? (
        <section className="ess-panel">
          <h2>Payroll</h2>
          <p className="ess-muted">Your payslip is ready to download after salary is marked paid.</p>
          {payroll?.lines.length ? (
            <ul className="ess-list">
              {payroll.lines.map((line) => (
                <li key={line.id} className="ess-list-item">
                  <strong>Payslip {slipMonth(line.month)}</strong>
                  <button
                    type="button"
                    className="ess-btn ess-btn-primary"
                    onClick={() => {
                      void downloadSalarySlip(line.month)
                        .then(() => {
                          setMessage('Payslip download started.');
                          showToast('Payslip download started.');
                        })
                        .catch((err: unknown) =>
                          setError(err instanceof Error ? err.message : 'Could not download the payslip.'),
                        );
                    }}
                  >
                    <Download size={16} /> Download payslip
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ess-empty">Your payslip appears here after salary is marked paid.</p>
          )}
          {payroll?.statement ? <SalarySheet statement={payroll.statement} /> : null}
          <h2>Payslip PDFs</h2>
          {error ? <p className="ess-alert">{error}</p> : null}
          {message ? <p className="ess-muted">{message}</p> : null}
          {payslips.length === 0 ? (
            <p className="ess-empty">No payslips have been uploaded for you yet.</p>
          ) : (
            <ul className="ess-list">
              {payslips.map((slip) => (
                <li key={slip.id} className="ess-list-item">
                  <div className="ess-leave-request-head">
                    <strong>{slip.label}</strong>
                    <span className="ess-muted">{slip.month}</span>
                  </div>
                  <span className="ess-muted">{slip.fileName}</span>
                  <button
                    type="button"
                    className="ess-btn ess-btn-primary"
                    onClick={() => {
                      void downloadMyPayslip(slip.id, slip.fileName)
                        .then(() => {
                          setMessage('Download started.');
                          showToast('Download started.');
                        })
                        .catch((err: unknown) =>
                          setError(err instanceof Error ? err.message : 'Download failed.'),
                        );
                    }}
                  >
                    <Download size={16} /> Download PDF
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {section === 'ytd' && payroll?.statement ? (
        <section className="ess-panel">
          <h2>Year to date</h2>
          <p className="ess-muted">Built from generated payroll lines. A correction is a new line, not an overwritten total.</p>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Earnings</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th>PF</th>
                  <th>TDS</th>
                </tr>
              </thead>
              <tbody>
                {payroll.statement.ytdMonths.map((month) => (
                  <tr key={month.month}>
                    <th>{month.month}</th>
                    <td>{formatSalary(month.gross)}</td>
                    <td>{formatSalary(month.deductions)}</td>
                    <td>{formatSalary(month.net)}</td>
                    <td>{formatSalary(month.pf)}</td>
                    <td>{formatSalary(month.tds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === 'ytd' && !payroll?.statement ? (
        <section className="ess-panel">
          <h2>Year to date · FY {SALARY_FY}</h2>
          <p className="ess-muted">Sample totals until Finance generates payroll.</p>
          <dl className="ess-salary-metrics">
            <div>
              <dt>Earnings</dt>
              <dd>{formatInr(totals.earnings)}</dd>
            </div>
            <div>
              <dt>Deductions</dt>
              <dd>{formatInr(totals.deductions)}</dd>
            </div>
            <div>
              <dt>Net pay</dt>
              <dd>{formatInr(totals.net)}</dd>
            </div>
            <div>
              <dt>PF</dt>
              <dd>{formatInr(totals.pf)}</dd>
            </div>
            <div>
              <dt>TDS</dt>
              <dd>{formatInr(totals.tds)}</dd>
            </div>
          </dl>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Earnings</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th>PF</th>
                  <th>TDS</th>
                </tr>
              </thead>
              <tbody>
                {SALARY_YTD.months.map((month) => (
                  <tr key={month.month}>
                    <th>{month.month}</th>
                    <td>{formatInr(month.earnings)}</td>
                    <td>{formatInr(month.deductions)}</td>
                    <td>{formatInr(month.net)}</td>
                    <td>{formatInr(month.pf)}</td>
                    <td>{formatInr(month.tds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === 'statement' && payroll?.statement ? (
        <AmountList
          title="Form 130 preview"
          note="From salary paid this year. The official certificate is issued after March."
          rows={payroll.statement.form130.map((row) => ({ label: `${row.id} ${row.label}`, amount: row.amount }))}
        />
      ) : null}

      {section === 'statement' && !payroll?.statement ? (
        <AmountList title="IT statement" note="Sample annual tax summary. Not a Form 16." rows={IT_STATEMENT} />
      ) : null}

      {section === 'declaration' ? (
        <AmountList title="IT declaration" note="Sample proposed investments for this year." rows={IT_DECLARATION} />
      ) : null}

      {section === 'loans' ? (
        <section className="ess-panel">
          <h2>Loans and advances</h2>
          <p className="ess-muted">Sample balances. Repayment is not collected here.</p>
          <ul className="ess-salary-cards">
            {SALARY_LOANS.map((loan) => (
              <li key={loan.name}>
                <strong>{loan.name}</strong>
                <dl>
                  <div>
                    <dt>Principal</dt>
                    <dd>{formatInr(loan.principal)}</dd>
                  </div>
                  <div>
                    <dt>Outstanding</dt>
                    <dd>{formatInr(loan.outstanding)}</dd>
                  </div>
                  <div>
                    <dt>EMI</dt>
                    <dd>{formatInr(loan.emi)}</dd>
                  </div>
                  <div>
                    <dt>Next due</dt>
                    <dd>{loan.nextDue}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {section === 'reimbursement' ? (
        <section className="ess-panel">
          <h2>Reimbursement</h2>
          <p className="ess-muted">Sample claims. Submitting a claim is not available yet.</p>
          <ul className="ess-list">
            {REIMBURSEMENTS.map((claim) => (
              <li key={claim.title} className="ess-list-item">
                <div className="ess-leave-request-head">
                  <strong>{claim.title}</strong>
                  <StatusChip status={claim.status} />
                </div>
                <span>{formatInr(claim.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {section === 'proofs' ? (
        <section className="ess-panel">
          <h2>Proof of investment</h2>
          <p className="ess-muted">Sample proof status. Files are not uploaded from this screen.</p>
          <ul className="ess-list">
            {INVESTMENT_PROOFS.map((proof) => (
              <li key={proof.name} className="ess-list-item">
                <div className="ess-leave-request-head">
                  <strong>{proof.name}</strong>
                  <StatusChip status={proof.status} />
                </div>
                <span className="ess-muted">Updated {proof.updated}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {section === 'revision' ? (
        <section className="ess-panel">
          <h2>Salary revision</h2>
          <p className="ess-muted">Sample compensation history.</p>
          <dl className="ess-salary-metrics">
            <div>
              <dt>Current CTC</dt>
              <dd>{formatInr(SALARY_REVISION.currentCtc)}</dd>
            </div>
            <div>
              <dt>Effective</dt>
              <dd>{SALARY_REVISION.effectiveFrom}</dd>
            </div>
            <div>
              <dt>Previous CTC</dt>
              <dd>{formatInr(SALARY_REVISION.previous.ctc)}</dd>
            </div>
            <div>
              <dt>Hike</dt>
              <dd>{SALARY_REVISION.previous.hikePercent}%</dd>
            </div>
          </dl>
          <p className="ess-muted">Previous package was effective {SALARY_REVISION.previous.effectiveFrom}.</p>
        </section>
      ) : null}
    </div>
  );
}

function AmountList({ title, note, rows }: { title: string; note: string; rows: Array<{ label: string; amount: number; status?: string; note?: string }> }) {
  return (
    <section className="ess-panel">
      <h2>{title}</h2>
      <p className="ess-muted">{note}</p>
      <ul className="ess-list">
        {rows.map((row) => (
          <li key={row.label} className="ess-list-item">
            <div className="ess-leave-request-head">
              <strong>{row.label}</strong>
              {row.status ? <StatusChip status={row.status} /> : null}
            </div>
            <span>{formatInr(row.amount)}</span>
            {row.note ? <span className="ess-muted">{row.note}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
