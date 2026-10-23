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
import {
  downloadMyPayslip,
  fetchMyPayslips,
  type PayslipDto,
} from '../../workspace/payslipApi';

type Section =
  | 'payslips'
  | 'ytd'
  | 'statement'
  | 'declaration'
  | 'loans'
  | 'reimbursement'
  | 'proofs'
  | 'revision';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'payslips', label: 'Payslips' },
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
            Payslip PDFs are the files HR uploaded. The other sections are sample figures for FY {SALARY_FY} and are not calculated here.
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
          <h2>Payslips</h2>
          <p className="ess-muted">Download the PDF for a month. PeopleOS does not calculate pay.</p>
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
                        .then(() => setMessage('Download started.'))
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

      {section === 'ytd' ? (
        <section className="ess-panel">
          <h2>Year to date · FY {SALARY_FY}</h2>
          <p className="ess-muted">Sample totals for April to September.</p>
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

      {section === 'statement' ? (
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
