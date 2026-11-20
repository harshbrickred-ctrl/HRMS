import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, PenLine, Receipt, type LucideIcon } from 'lucide-react';
import { showToast } from '../../ui/toast';
import {
  decideReimbursement,
  fetchReimbursements,
  openReimbursementReceipt,
  submitReimbursement,
  type ReimbursementBoard,
  type ReimbursementClaim,
} from '../../workspace/reimbursementApi';
import { StatusChip } from '../components/StatusChip';

function rupees(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function payNote(claim: ReimbursementClaim) {
  if (claim.status !== 'approved') return claim.reason;
  if (claim.salaryMonth) return `Added to ${claim.salaryMonth} salary. ${claim.reason}`;
  return `Approved. HR adds ${rupees(claim.amount)} when generating ${claim.payMonth} salary. ${claim.reason}`;
}

type Tab = 'claim' | 'approve';

const TABS: Array<{ id: Tab; label: string; hint: string; icon: LucideIcon }> = [
  { id: 'claim', label: 'My claims', hint: 'Submit and track', icon: PenLine },
  { id: 'approve', label: 'Approvals', hint: 'Decide your team', icon: CheckCircle2 },
];

function ClaimList({
  claims,
  onDecide,
  busyId,
}: {
  claims: ReimbursementClaim[];
  onDecide?: (claim: ReimbursementClaim, status: 'approved' | 'rejected') => void;
  busyId?: string;
}) {
  if (!claims.length) return <p className="ess-muted">{onDecide ? 'No claims are waiting for you.' : 'Nothing here yet.'}</p>;
  return (
    <ul className="ess-leave-request-list">
      {claims.map((claim) => (
        <li key={claim.id} className={`ess-leave-request is-${claim.status.toLowerCase()}`}>
          <div className="ess-leave-request-head">
            <div>
              <strong>
                {claim.employeeCode} {claim.employeeName}
              </strong>
              <span className="ess-leave-request-code">{rupees(claim.amount)}</span>
            </div>
            <StatusChip status={claim.status} />
          </div>
          <p className="ess-leave-request-range">
            {claim.expenseDate} · {claim.days} day{claim.days === 1 ? '' : 's'}
          </p>
          <p className="ess-muted">{payNote(claim)}</p>
          <div className="ess-leave-request-actions">
            {claim.hasReceipt ? (
              <button type="button" className="ess-btn ess-btn-ghost" onClick={() => void openReimbursementReceipt(claim.id, claim.receiptName)}>
                Receipt
              </button>
            ) : null}
            {onDecide && claim.canDecide ? (
              <>
                <button type="button" className="ess-btn ess-btn-primary" disabled={busyId === claim.id} onClick={() => onDecide(claim, 'approved')}>
                  Approve
                </button>
                <button type="button" className="ess-btn" disabled={busyId === claim.id} onClick={() => onDecide(claim, 'rejected')}>
                  Reject
                </button>
              </>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ReimbursementPage() {
  const [board, setBoard] = useState<ReimbursementBoard | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [days, setDays] = useState('1');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<Tab>('claim');

  function load() {
    return fetchReimbursements()
      .then((next) => {
        setBoard(next);
        setError('');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load reimbursements.'));
  }

  useEffect(() => {
    void load();
  }, []);

  const canApprove = Boolean(board?.canApprove);
  const pendingCount = board?.approvals.length ?? 0;

  useEffect(() => {
    if (!canApprove && tab === 'approve') setTab('claim');
  }, [canApprove, tab]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const body = new FormData();
    body.set('expenseDate', expenseDate);
    body.set('days', days);
    body.set('amount', amount);
    body.set('reason', reason);
    if (file) body.set('file', file);
    setBusy(true);
    try {
      await submitReimbursement(body);
      setAmount('');
      setReason('');
      setFile(null);
      showToast('Reimbursement sent for approval');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit the reimbursement.');
    } finally {
      setBusy(false);
    }
  }

  async function onDecide(claim: ReimbursementClaim, status: 'approved' | 'rejected') {
    setBusyId(claim.id);
    try {
      await decideReimbursement(claim.id, status);
      showToast(status === 'approved' ? 'Reimbursement approved' : 'Reimbursement rejected');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update the reimbursement.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="ess-section-stack">
      <header className="ess-leave-hero">
        <div className="ess-leave-hero-copy">
          <p className="ess-leave-kicker">
            <Receipt size={14} aria-hidden /> Pay
          </p>
          <h1>Reimbursement</h1>
          <p className="ess-lead">
            Enter the expense date, number of days, amount, and reason. A receipt is optional. The claim goes to your manager. After approval, HR adds the amount to that month&apos;s salary.
          </p>
        </div>
      </header>
      {error ? <p className="ess-alert">{error}</p> : null}
      <nav className="ess-leave-tabs" role="tablist" aria-label="Reimbursement sections">
        {TABS.filter((item) => item.id === 'claim' || canApprove).map(({ id, label, hint, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`ess-leave-tab${active ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              <span className="ess-leave-tab-icon" aria-hidden>
                <Icon size={16} strokeWidth={2.1} />
              </span>
              <span className="ess-leave-tab-copy">
                <span className="ess-leave-tab-label">
                  {label}
                  {id === 'approve' && pendingCount > 0 ? <span className="ess-leave-tab-count">{pendingCount}</span> : null}
                </span>
                <span className="ess-leave-tab-hint">{hint}</span>
              </span>
            </button>
          );
        })}
      </nav>
      {tab === 'approve' && canApprove ? (
        <section className="ess-panel">
          <div className="ess-panel-head">
            <h2>Waiting for your approval</h2>
            <span className="ess-muted">{pendingCount === 1 ? '1 claim' : `${pendingCount} claims`}</span>
          </div>
          <ClaimList claims={board?.approvals ?? []} onDecide={(claim, status) => void onDecide(claim, status)} busyId={busyId} />
        </section>
      ) : null}
      {tab === 'claim' ? (
      <>
      <section className="ess-panel">
        <h2>New claim</h2>
        <form className="ess-form" onSubmit={(event) => void onSubmit(event)}>
          <div className="ess-field">
            <label htmlFor="reimburse-date">Expense date</label>
            <input id="reimburse-date" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} required />
          </div>
          <div className="ess-field">
            <label htmlFor="reimburse-days">Days</label>
            <input id="reimburse-days" inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value)} required />
          </div>
          <div className="ess-field">
            <label htmlFor="reimburse-amount">Amount (₹)</label>
            <input id="reimburse-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </div>
          <div className="ess-field">
            <label htmlFor="reimburse-reason">Reason</label>
            <textarea id="reimburse-reason" value={reason} onChange={(event) => setReason(event.target.value)} required />
          </div>
          <div className="ess-field">
            <label htmlFor="reimburse-file">Receipt (optional)</label>
            <input
              id="reimburse-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <button type="submit" className="ess-btn" disabled={busy}>
            Submit for approval
          </button>
        </form>
      </section>
      <section className="ess-panel">
        <h2>My claims</h2>
        <ClaimList claims={board?.mine ?? []} />
      </section>
      </>
      ) : null}
    </div>
  );
}
