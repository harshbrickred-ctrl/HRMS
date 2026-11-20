import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, IndianRupee } from 'lucide-react';
import { formatInr } from '../mock/EssDataContext';
import { SALARY_LOANS, SALARY_REVISION } from '../mock/salaryMock';
import { StatusChip } from '../components/StatusChip';
import { showToast } from '../../ui/toast';
import {
  downloadMyPayslip,
  fetchMyPayslips,
  type PayslipDto,
} from '../../workspace/payslipApi';
import { downloadSalarySlip, fetchMySalary, formatSalary, type MySalary } from '../../workspace/salaryApi';
import { SalarySheet } from '../../workspace/SalarySheet';
import { TaxSheet } from '../../workspace/TaxSheet';
import {
  DEFAULT_TAX_LINES,
  deleteInvestmentProof,
  fetchTaxSummary,
  openInvestmentProof,
  requestTaxRegimeChange,
  saveTaxDeclaration,
  submitTaxDeclaration,
  uploadInvestmentProof,
  withdrawTaxRegimeChange,
  type TaxLine,
  type TaxSummary,
} from '../../workspace/taxApi';

type Section =
  | 'payslips'
  | 'ytd'
  | 'statement'
  | 'declaration'
  | 'loans'
  | 'reimbursement'
  | 'proofs'
  | 'revision'
  | 'regime';

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
  { id: 'proofs', label: 'Proof of Investment' },
  { id: 'regime', label: 'Tax regime' },
  { id: 'loans', label: 'Loans and advances' },
  { id: 'reimbursement', label: 'Reimbursement' },
  { id: 'revision', label: 'Salary revision' },
];

const SECTIONS_LIST = ['80C', '80CCD', '80D', '80E', '80G', 'OTHER'] as const;

export function EssSalaryPage() {
  const [section, setSection] = useState<Section>('payslips');
  const [payslips, setPayslips] = useState<PayslipDto[]>([]);
  const [payroll, setPayroll] = useState<MySalary | null>(null);
  const [tax, setTax] = useState<TaxSummary | null>(null);
  const [lines, setLines] = useState<TaxLine[]>(DEFAULT_TAX_LINES);
  const [rentPaidAnnual, setRentPaidAnnual] = useState('0');
  const [isMetro, setIsMetro] = useState(false);
  const [proofForm, setProofForm] = useState({ section: '80C', label: '', amount: '0', file: null as File | null });
  const [regimeTo, setRegimeTo] = useState<'new' | 'old'>('old');
  const [regimeReason, setRegimeReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadTax = () =>
    fetchTaxSummary()
      .then((summary) => {
        setTax(summary);
        setLines(summary.declaration.lines.length ? summary.declaration.lines : DEFAULT_TAX_LINES);
        setRentPaidAnnual(String(summary.declaration.rentPaidAnnual ?? 0));
        setIsMetro(Boolean(summary.declaration.isMetro));
        if (summary.structure) {
          setRegimeTo(summary.structure.taxRegime === 'new' ? 'old' : 'new');
        }
      })
      .catch(() => setTax(null));

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
    void loadTax();
  }, []);

  const declarationLocked =
    tax?.declaration.status === 'submitted' || tax?.declaration.status === 'approved';

  return (
    <div className="ess-section-stack">
      <header className="ess-leave-hero">
        <div className="ess-leave-hero-copy">
          <p className="ess-leave-kicker">
            <IndianRupee size={14} aria-hidden /> Pay
          </p>
          <h1>My Payout</h1>
          <p className="ess-lead">
            Payroll, year-to-date and Form 130 use generated salary. Declare investments, upload proofs, and request a
            tax regime change here.
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
          <p className="ess-muted">Built from generated payroll lines.</p>
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
          <h2>Year to date</h2>
          <p className="ess-empty">YTD appears after Finance generates at least one payroll month.</p>
        </section>
      ) : null}

      {section === 'statement' && payroll?.statement ? (
        <>
          {payroll.statement.taxBreakdown ? (
            <TaxSheet
              breakdown={payroll.statement.taxBreakdown}
              title="Tax computation"
              note="From salary paid this year — slabs, rates, formulas, and TDS."
            />
          ) : null}
          <AmountList
            title="Form 130 preview"
            note="From salary paid this year. The official certificate is issued after March."
            rows={payroll.statement.form130.map((row) => ({ label: `${row.id} ${row.label}`, amount: row.amount }))}
          />
        </>
      ) : null}

      {section === 'statement' && !payroll?.statement && tax?.projectedStatement ? (
        <>
          {tax.projectedStatement.taxBreakdown ? (
            <TaxSheet
              breakdown={tax.projectedStatement.taxBreakdown}
              title="Projected tax computation"
              note={`Based on your salary structure for FY ${tax.fy}. Updates after payroll runs.`}
            />
          ) : null}
          <AmountList
            title="Projected IT statement"
            note={`Based on your salary structure for FY ${tax.fy}. Updates after payroll runs.`}
            rows={tax.projectedStatement.form130.map((row) => ({
              label: `${row.id} ${row.label}`,
              amount: row.amount,
            }))}
          />
        </>
      ) : null}

      {section === 'statement' && !payroll?.statement && !tax?.projectedStatement ? (
        <section className="ess-panel">
          <h2>IT statement</h2>
          <p className="ess-empty">Save a salary structure to see a projected tax statement.</p>
        </section>
      ) : null}

      {section === 'declaration' ? (
        <section className="ess-panel">
          <h2>IT declaration · FY {tax?.fy ?? '—'}</h2>
          <p className="ess-muted">
            Chapter VI-A and HRA rent feed old-regime TDS after HR approves. Status:{' '}
            <StatusChip status={tax?.declaration.status ?? 'draft'} />
          </p>
          {tax?.declaration.decisionNote ? (
            <p className="ess-muted">HR note: {tax.declaration.decisionNote}</p>
          ) : null}
          <label className="ess-field">
            Annual rent paid
            <input
              type="number"
              min={0}
              value={rentPaidAnnual}
              disabled={declarationLocked || busy}
              onChange={(event) => setRentPaidAnnual(event.target.value)}
            />
          </label>
          <label className="ess-check">
            <input
              type="checkbox"
              checked={isMetro}
              disabled={declarationLocked || busy}
              onChange={(event) => setIsMetro(event.target.checked)}
            />
            Metro city (50% HRA cap)
          </label>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Label</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.section}-${index}`}>
                    <td>
                      <select
                        value={line.section}
                        disabled={declarationLocked || busy}
                        onChange={(event) => {
                          const next = [...lines];
                          next[index] = { ...line, section: event.target.value };
                          setLines(next);
                        }}
                      >
                        {SECTIONS_LIST.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={line.label}
                        disabled={declarationLocked || busy}
                        onChange={(event) => {
                          const next = [...lines];
                          next[index] = { ...line, label: event.target.value };
                          setLines(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={line.amount}
                        disabled={declarationLocked || busy}
                        onChange={(event) => {
                          const next = [...lines];
                          next[index] = { ...line, amount: Number(event.target.value) || 0 };
                          setLines(next);
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ess-btn ess-btn-ghost"
                        disabled={declarationLocked || busy || lines.length <= 1}
                        onClick={() => setLines(lines.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ess-actions">
            <button
              type="button"
              className="ess-btn"
              disabled={declarationLocked || busy}
              onClick={() => setLines([...lines, { section: '80C', label: '', amount: 0 }])}
            >
              Add line
            </button>
            <button
              type="button"
              className="ess-btn"
              disabled={declarationLocked || busy || !tax}
              onClick={() => {
                if (!tax) return;
                setBusy(true);
                setError(null);
                void saveTaxDeclaration({
                  fy: tax.fy,
                  rentPaidAnnual: Math.max(0, Math.round(Number(rentPaidAnnual) || 0)),
                  isMetro,
                  lines: lines.map((line) => ({
                    section: line.section,
                    label: line.label.trim() || line.section,
                    amount: Math.max(0, Math.round(line.amount) || 0),
                  })),
                })
                  .then(() => {
                    showToast('Declaration draft saved.');
                    return loadTax();
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Save failed.'))
                  .finally(() => setBusy(false));
              }}
            >
              Save draft
            </button>
            <button
              type="button"
              className="ess-btn ess-btn-primary"
              disabled={declarationLocked || busy || !tax}
              onClick={() => {
                if (!tax) return;
                setBusy(true);
                setError(null);
                void saveTaxDeclaration({
                  fy: tax.fy,
                  rentPaidAnnual: Math.max(0, Math.round(Number(rentPaidAnnual) || 0)),
                  isMetro,
                  lines: lines.map((line) => ({
                    section: line.section,
                    label: line.label.trim() || line.section,
                    amount: Math.max(0, Math.round(line.amount) || 0),
                  })),
                })
                  .then(() => submitTaxDeclaration(tax.fy))
                  .then(() => {
                    showToast('Declaration submitted to HR.');
                    return loadTax();
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Submit failed.'))
                  .finally(() => setBusy(false));
              }}
            >
              Submit to HR
            </button>
          </div>
          {error && section === 'declaration' ? <p className="ess-alert">{error}</p> : null}
        </section>
      ) : null}

      {section === 'proofs' ? (
        <section className="ess-panel">
          <h2>Proof of investment · FY {tax?.fy ?? '—'}</h2>
          <p className="ess-muted">Upload receipts for HR review. Accepting a proof does not change declared amounts.</p>
          <div className="ess-form-grid">
            <label className="ess-field">
              Section
              <select
                value={proofForm.section}
                onChange={(event) => setProofForm({ ...proofForm, section: event.target.value })}
              >
                {SECTIONS_LIST.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="ess-field">
              Label
              <input
                value={proofForm.label}
                onChange={(event) => setProofForm({ ...proofForm, label: event.target.value })}
              />
            </label>
            <label className="ess-field">
              Amount
              <input
                type="number"
                min={0}
                value={proofForm.amount}
                onChange={(event) => setProofForm({ ...proofForm, amount: event.target.value })}
              />
            </label>
            <label className="ess-field">
              File
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                onChange={(event) => setProofForm({ ...proofForm, file: event.target.files?.[0] ?? null })}
              />
            </label>
          </div>
          <button
            type="button"
            className="ess-btn ess-btn-primary"
            disabled={busy || !tax || !proofForm.file || !proofForm.label.trim()}
            onClick={() => {
              if (!tax || !proofForm.file) return;
              const body = new FormData();
              body.set('fy', tax.fy);
              body.set('section', proofForm.section);
              body.set('label', proofForm.label.trim());
              body.set('amount', String(Math.max(0, Math.round(Number(proofForm.amount) || 0))));
              body.set('file', proofForm.file);
              setBusy(true);
              setError(null);
              void uploadInvestmentProof(body)
                .then(() => {
                  showToast('Proof uploaded.');
                  setProofForm({ section: '80C', label: '', amount: '0', file: null });
                  return loadTax();
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Upload failed.'))
                .finally(() => setBusy(false));
            }}
          >
            Upload proof
          </button>
          <ul className="ess-list">
            {(tax?.proofs ?? []).map((proof) => (
              <li key={proof.id} className="ess-list-item">
                <div className="ess-leave-request-head">
                  <strong>
                    {proof.section} · {proof.label}
                  </strong>
                  <StatusChip status={proof.status} />
                </div>
                <span>{formatInr(proof.amount)}</span>
                <span className="ess-muted">{proof.fileName}</span>
                <div className="ess-actions">
                  <button
                    type="button"
                    className="ess-btn ess-btn-ghost"
                    onClick={() => void openInvestmentProof(proof.id, proof.fileName)}
                  >
                    Open
                  </button>
                  {proof.status === 'pending' ? (
                    <button
                      type="button"
                      className="ess-btn ess-btn-ghost"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void deleteInvestmentProof(proof.id)
                          .then(() => loadTax())
                          .catch((err: unknown) =>
                            setError(err instanceof Error ? err.message : 'Could not delete proof.'),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {!(tax?.proofs?.length) ? <p className="ess-empty">No proofs uploaded yet.</p> : null}
          {error && section === 'proofs' ? <p className="ess-alert">{error}</p> : null}
        </section>
      ) : null}

      {section === 'regime' ? (
        <section className="ess-panel">
          <h2>Tax regime</h2>
          <p className="ess-muted">
            Current regime:{' '}
            <strong>{tax?.structure?.taxRegime === 'old' ? 'Old' : tax?.structure ? 'New' : 'Not set'}</strong>
          </p>
          {tax?.regimeRequest ? (
            <div className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>
                  {tax.regimeRequest.fromRegime} → {tax.regimeRequest.toRegime}
                </strong>
                <StatusChip status={tax.regimeRequest.status} />
              </div>
              {tax.regimeRequest.reason ? <p className="ess-muted">{tax.regimeRequest.reason}</p> : null}
              {tax.regimeRequest.status === 'pending' ? (
                <button
                  type="button"
                  className="ess-btn"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void withdrawTaxRegimeChange(tax.regimeRequest!.id)
                      .then(() => {
                        showToast('Request withdrawn.');
                        return loadTax();
                      })
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Withdraw failed.'))
                      .finally(() => setBusy(false));
                  }}
                >
                  Withdraw request
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <label className="ess-field">
                Request change to
                <select value={regimeTo} onChange={(event) => setRegimeTo(event.target.value as 'new' | 'old')}>
                  <option value="new">New regime</option>
                  <option value="old">Old regime</option>
                </select>
              </label>
              <label className="ess-field">
                Reason
                <input value={regimeReason} onChange={(event) => setRegimeReason(event.target.value)} />
              </label>
              <button
                type="button"
                className="ess-btn ess-btn-primary"
                disabled={busy || !tax?.structure}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  void requestTaxRegimeChange(regimeTo, regimeReason)
                    .then(() => {
                      showToast('Regime change submitted.');
                      setRegimeReason('');
                      return loadTax();
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Request failed.'))
                    .finally(() => setBusy(false));
                }}
              >
                Submit to HR
              </button>
            </>
          )}
          {error && section === 'regime' ? <p className="ess-alert">{error}</p> : null}
        </section>
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
          <p className="ess-muted">Claims, receipts, and manager approval are on the Reimbursement page.</p>
          <Link className="ess-btn" to="/ess/reimbursements">
            Open reimbursement
          </Link>
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

function AmountList({
  title,
  note,
  rows,
}: {
  title: string;
  note: string;
  rows: Array<{ label: string; amount: number; status?: string; note?: string }>;
}) {
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
