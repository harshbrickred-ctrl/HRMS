import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { showToast } from '../ui/toast';
import {
  authoriseTransfer,
  cancelTransferBatch,
  createTransferBatch,
  fetchDirectPayout,
  fetchPayout,
  formatSalary,
  issueTransferOtp,
  registerBank,
  syncTransfer,
  verifyTransferOtp,
  type DirectPayout,
  type PayoutRow,
  type TransferBatchView,
} from './salaryApi';

const OPEN_STATUS = ['pending', 'initiated', 'in_progress'];

const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting for confirmation',
  initiated: 'Ready to authorise',
  in_progress: 'Sent to RazorpayX',
  success: 'Paid',
  partial: 'Partly paid',
  failed: 'Failed',
  rejected: 'Cancelled',
  skipped: 'Not included',
};

function label(status: string) {
  return STATUS_LABEL[status] ?? status;
}

function accountLast4(account: string) {
  const digits = account.replace(/\s/g, '');
  return digits.length >= 4 ? `····${digits.slice(-4)}` : 'Missing';
}

function blockReason(row: PayoutRow) {
  if (!row.eligible) return 'Bank account or IFSC is missing';
  if (row.paymentStatus === 'paid') return 'Already paid';
  if (row.paymentStatus === 'direct') return 'Already in a transfer';
  return '';
}

function readyLabel(row: PayoutRow) {
  const blocked = blockReason(row);
  if (blocked) return blocked;
  if (row.paymentStatus === 'file') return 'Ready · bank file was not paid';
  return 'Ready';
}

function stepFor(batch: TransferBatchView | null) {
  if (!batch) return 1;
  if (batch.status === 'pending') return 2;
  if (batch.status === 'initiated') return 3;
  return 4;
}

export function DirectTransferPanel({ month }: { month: string }) {
  const [data, setData] = useState<DirectPayout | null>(null);
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [approved, setApproved] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [otp, setOtp] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const allRef = useRef<HTMLInputElement>(null);

  async function load(nextMonth = month) {
    const [next, payout] = await Promise.all([fetchDirectPayout(nextMonth), fetchPayout(nextMonth)]);
    setData(next);
    setRows(payout?.rows ?? []);
    setApproved(Boolean(payout?.approved));
    setError(null);
  }

  useEffect(() => {
    setConfirmationCode('');
    setOtp('');
    setPicked([]);
    load(month).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load direct transfer.'));
    // Reload when the payroll month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const connection = data?.connection ?? null;
  const openBatch = data?.batches.find((batch) => OPEN_STATUS.includes(batch.status)) ?? null;
  const earlier = (data?.batches ?? []).filter((batch) => batch.id !== openBatch?.id);
  const step = connection ? stepFor(openBatch) : 0;
  const readyIds = useMemo(() => rows.filter((row) => !blockReason(row)).map((row) => row.employeeId), [rows]);
  const pickedRows = rows.filter((row) => picked.includes(row.employeeId) && readyIds.includes(row.employeeId));
  const pickedNet = pickedRows.reduce((sum, row) => sum + row.netPay, 0);
  const allChecked = readyIds.length > 0 && readyIds.every((id) => picked.includes(id));
  const someChecked = readyIds.some((id) => picked.includes(id));

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  function toggle(id: string) {
    if (!readyIds.includes(id)) return;
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    setPicked(allChecked ? [] : readyIds);
  }

  async function onRegister() {
    setBusy(true);
    try {
      await registerBank();
      await load();
      showToast('RazorpayX connected. No salary has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect RazorpayX.');
    } finally {
      setBusy(false);
    }
  }

  async function onCreate() {
    if (!pickedRows.length) return;
    setBusy(true);
    try {
      const batch = await createTransferBatch(month, pickedRows.map((row) => row.employeeId));
      setPicked([]);
      setConfirmationCode('');
      await load();
      showToast(`${batch.reference} has ${batch.willPayCount} employees. Confirm it before anyone is paid.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the transfer batch.');
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!openBatch) return;
    setBusy(true);
    try {
      await cancelTransferBatch(openBatch.id);
      setConfirmationCode('');
      setOtp('');
      await load();
      showToast('Batch cancelled. Those employees are back in the list.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the batch.');
    } finally {
      setBusy(false);
    }
  }

  async function onOtp() {
    if (!openBatch) return;
    setBusy(true);
    try {
      const issued = await issueTransferOtp(openBatch.id);
      setConfirmationCode(issued.confirmationCode);
      setOtp('');
      showToast('Confirmation code is on screen. RazorpayX is not charged yet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start verification.');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!openBatch) return;
    setBusy(true);
    try {
      await verifyTransferOtp(openBatch.id, otp);
      setConfirmationCode('');
      setOtp('');
      await load();
      showToast('Confirmed. Authorise the batch to send it to RazorpayX.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify the code.');
    } finally {
      setBusy(false);
    }
  }

  async function onAuthorise(decision: 'approve' | 'reject') {
    if (!openBatch) return;
    setBusy(true);
    try {
      await authoriseTransfer(openBatch.id, decision);
      await load();
      showToast(
        decision === 'approve'
          ? 'Sent to RazorpayX. Refresh the status. Salary stays unpaid until a UTR arrives.'
          : 'Transfer rejected. Employees can be selected again.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not authorise the transfer.');
    } finally {
      setBusy(false);
    }
  }

  async function onSync() {
    if (!openBatch) return;
    setBusy(true);
    try {
      const batch = await syncTransfer(openBatch.id);
      await load();
      const paid = batch.transactions.filter((tx) => tx.status === 'success').length;
      const note = batch.transactions.map((tx) => tx.skipReason).find(Boolean);
      showToast(paid ? `RazorpayX paid ${paid} with a UTR.` : note || 'RazorpayX status refreshed. No UTR yet, so nobody is marked paid.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the RazorpayX status.');
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="salary-note">Loading direct transfer…</p>;
  }

  return (
    <div className="payout-direct">
      {error ? <p className="ess-alert">{error}</p> : null}

      <div className="payout-connect">
        {!data.configured ? (
          <p>RazorpayX keys are missing on the API server ({data.missing.join(', ')}).</p>
        ) : connection ? (
          <p>
            {connection.live
              ? `RazorpayX · account ending ${connection.accountLast4} · Live`
              : `RazorpayX · account ending ${connection.accountLast4} · Test mode. Test mode does not move real money.`}
          </p>
        ) : (
          <p>Connect RazorpayX first. The key stays on the server, and no salary is sent by connecting.</p>
        )}
        {data.configured ? (
          <button type="button" className={connection ? 'ess-btn' : 'ess-btn ess-btn-primary'} disabled={busy} onClick={() => void onRegister()}>
            {connection ? 'Reconnect' : 'Connect RazorpayX'}
          </button>
        ) : null}
      </div>

      <ol className="payout-steps" aria-label="Direct transfer steps">
        <li className={step === 1 ? 'is-current' : step > 1 ? 'is-done' : ''}>1. Select employees</li>
        <li className={step === 2 ? 'is-current' : step > 2 ? 'is-done' : ''}>2. Confirm</li>
        <li className={step === 3 ? 'is-current' : step > 3 ? 'is-done' : ''}>3. Authorise</li>
        <li className={step === 4 ? 'is-current' : ''}>4. Paid when UTR arrives</li>
      </ol>

      {step === 1 ? (
        <section className="payout-stage">
          <div>
            <h2>Who should be paid?</h2>
            <p>Tick the employees. Only the ticked people go into the batch. Already paid rows stay locked. A downloaded bank file is not a payment, so those people can still be ticked.</p>
          </div>
          {!approved ? <p className="salary-note">This month is waiting for HR Head approval. You can look, but you cannot pay yet.</p> : null}
          <PeoplePicker
            rows={rows}
            picked={picked}
            allRef={allRef}
            allChecked={allChecked}
            onToggle={toggle}
            onToggleAll={toggleAll}
          />
          <div className="payout-action">
            <p>{pickedRows.length ? `${pickedRows.length} selected · ${formatSalary(pickedNet)}` : 'Nobody selected'}</p>
            <button
              type="button"
              className="ess-btn ess-btn-primary"
              disabled={busy || !connection || !approved || pickedRows.length === 0}
              onClick={() => void onCreate()}
            >
              Create batch for selected
            </button>
          </div>
        </section>
      ) : null}

      {openBatch && step === 2 ? (
        <section className="payout-stage">
          <div>
            <h2>Confirm {openBatch.reference}</h2>
            <p>
              {openBatch.willPayCount} employees · {formatSalary(openBatch.totalAmount)}. Nothing is sent until you confirm. RazorpayX is charged only when you authorise.
            </p>
          </div>
          <BatchPeople batch={openBatch} />
          <div className="payout-action">
            <button type="button" className="ess-btn" disabled={busy} onClick={() => void onCancel()}>
              Cancel and choose again
            </button>
            <button type="button" className="ess-btn ess-btn-primary" disabled={busy} onClick={() => void onOtp()}>
              Get confirmation code
            </button>
          </div>
          {confirmationCode ? (
            <div className="payout-confirm">
              <p>Type this code to confirm. It expires in 5 minutes.</p>
              <p className="payout-code">{confirmationCode}</p>
              <label>
                Confirmation code
                <input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" autoComplete="off" />
              </label>
              <button type="button" className="ess-btn ess-btn-primary" disabled={busy || otp.length !== 6} onClick={() => void onVerify()}>
                Confirm batch
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {openBatch && step === 3 ? (
        <section className="payout-stage">
          <div>
            <h2>Authorise {openBatch.reference}</h2>
            <p>
              {`${openBatch.willPayCount} employees · ${formatSalary(openBatch.totalAmount)}. ${
                openBatch.canAuthorise
                  ? 'Authorise to send it to RazorpayX. Salary stays unpaid until a UTR arrives.'
                  : 'A finance role is required to authorise this batch.'
              }`}
            </p>
          </div>
          <BatchPeople batch={openBatch} />
          <div className="payout-action">
            <button type="button" className="ess-btn" disabled={busy || !openBatch.canAuthorise} onClick={() => void onAuthorise('reject')}>
              Reject
            </button>
            <button type="button" className="ess-btn ess-btn-primary" disabled={busy || !openBatch.canAuthorise} onClick={() => void onAuthorise('approve')}>
              Authorise on RazorpayX
            </button>
          </div>
        </section>
      ) : null}

      {openBatch && step === 4 ? (
        <section className="payout-stage">
          <div>
            <h2>{openBatch.reference} is with RazorpayX</h2>
            <p>Salary is marked paid only when RazorpayX returns a UTR. Refresh to read the latest status.</p>
            {[...new Set(openBatch.transactions.map((tx) => tx.skipReason).filter(Boolean))].map((note) => (
              <p key={note} className="ess-alert">{note}</p>
            ))}
          </div>
          <BatchPeople batch={openBatch} showUtr />
          <div className="payout-action">
            <button type="button" className="ess-btn ess-btn-primary" disabled={busy} onClick={() => void onSync()}>
              Refresh RazorpayX status
            </button>
          </div>
        </section>
      ) : null}

      {earlier.length ? (
        <div className="payout-history">
          {earlier.map((batch) => (
            <details key={batch.id}>
              <summary>
                {batch.reference} · {batch.willPayCount} employees · {formatSalary(batch.totalAmount)} · {label(batch.status)}
              </summary>
              <BatchPeople batch={batch} showUtr />
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PeoplePicker({
  rows,
  picked,
  allRef,
  allChecked,
  onToggle,
  onToggleAll,
}: {
  rows: PayoutRow[];
  picked: string[];
  allRef: RefObject<HTMLInputElement | null>;
  allChecked: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  return (
    <div className="salary-scroll">
      <table className="salary-table payout-people">
        <thead>
          <tr>
            <th>
              <input ref={allRef} type="checkbox" checked={allChecked} onChange={onToggleAll} disabled={rows.every((row) => blockReason(row))} aria-label="Select all ready employees" />
            </th>
            <th>Employee</th>
            <th>Bank</th>
            <th className="is-amount">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>HR has not sent this month to Finance yet.</td>
            </tr>
          ) : (
            rows.map((row) => {
              const reason = blockReason(row);
              const checked = picked.includes(row.employeeId) && !reason;
              return (
                <tr key={row.employeeId} className={reason ? 'is-blocked' : checked ? 'is-selected' : ''} onClick={() => onToggle(row.employeeId)}>
                  <td>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={Boolean(reason)}
                      onChange={() => onToggle(row.employeeId)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                  <td>
                    <strong>{row.name}</strong>
                    <span>{row.employeeCode}</span>
                  </td>
                  <td>
                    {row.bankName || 'No bank'}
                    <span>{accountLast4(row.bankAccountNumber)}</span>
                  </td>
                  <td className="is-amount">{formatSalary(row.netPay)}</td>
                  <td>{readyLabel(row)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function BatchPeople({ batch, showUtr = false }: { batch: TransferBatchView; showUtr?: boolean }) {
  const people = batch.transactions.filter((tx) => tx.status !== 'skipped');
  return (
    <div className="salary-scroll">
      <table className="salary-table payout-people">
        <thead>
          <tr>
            <th>Employee</th>
            <th className="is-amount">Amount</th>
            <th>Status</th>
            {showUtr ? <th>UTR</th> : null}
          </tr>
        </thead>
        <tbody>
          {people.length === 0 ? (
            <tr>
              <td colSpan={showUtr ? 4 : 3}>No employees left in this batch.</td>
            </tr>
          ) : (
            people.map((tx) => (
              <tr key={tx.employeeId}>
                <td>
                  <strong>{tx.name}</strong>
                  <span>{tx.employeeCode}</span>
                </td>
                <td className="is-amount">{formatSalary(tx.amount)}</td>
                <td>{tx.skipReason || label(tx.status)}</td>
                {showUtr ? <td>{tx.utr || '—'}</td> : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
