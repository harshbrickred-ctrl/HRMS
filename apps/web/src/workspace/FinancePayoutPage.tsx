import { useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../ui/toast';
import { DirectTransferPanel } from './DirectTransferPanel';
import './hr-master.css';
import './salary.css';
import {
  createBankFile,
  currentSalaryMonth,
  fetchPayout,
  formatSalary,
  reconcilePayout,
  retryPayout,
  type PayoutBatch,
  type PayoutRow,
} from './salaryApi';

const TEMPLATES = [
  { id: 'hdfc', label: 'HDFC Salary Upload' },
  { id: 'icici', label: 'ICICI Corporate' },
  { id: 'sbi', label: 'SBI Corporate Salary' },
  { id: 'axis', label: 'Axis Salary Transfer' },
];

type Tab = 'transfers' | 'pending' | 'completed' | 'failed';

function downloadText(name: string, text: string) {
  const blob = new Blob([`\uFEFF${text}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function paymentLabel(row: PayoutRow) {
  if (!row.eligible) return 'Missing bank';
  if (row.paymentStatus === 'file') return 'File ready';
  if (row.paymentStatus === 'direct') return 'Direct transfer';
  if (row.paymentStatus === 'paid') return 'Paid';
  if (row.paymentStatus === 'failed') return 'Failed';
  return 'Ready';
}

function emptyBatch(month: string): PayoutBatch {
  return { month, approved: false, approvedAt: null, totalEmployees: 0, totalNet: 0, eligibleNet: 0, rows: [] };
}

export function FinancePayoutPage() {
  const [month, setMonth] = useState(currentSalaryMonth);
  const [batch, setBatch] = useState<PayoutBatch>(emptyBatch(month));
  const [tab, setTab] = useState<Tab>('transfers');
  const [template, setTemplate] = useState('hdfc');
  const [selected, setSelected] = useState<string[]>([]);
  const [utrs, setUtrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<'file' | 'direct'>('file');

  async function load(nextMonth = month) {
    const data = await fetchPayout(nextMonth);
    const next = data?.rows ? data : emptyBatch(nextMonth);
    setBatch(next);
    setUtresFrom(next.rows);
    setError(null);
  }

  function setUtresFrom(rows: PayoutRow[]) {
    setUtrs(Object.fromEntries(rows.map((row) => [row.employeeId, row.utr])));
  }

  useEffect(() => {
    setSelected([]);
    load(month).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load payout.'));
    function refresh() {
      load(month).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load payout.'));
    }
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
    // Reload when the payout month changes, and again when the page is focused after an approval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const rows = batch.rows ?? [];
  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (tab === 'pending') return !row.eligible;
      if (tab === 'completed') return row.paymentStatus === 'paid';
      if (tab === 'failed') return row.paymentStatus === 'failed';
      return row.eligible && row.paymentStatus !== 'paid' && row.paymentStatus !== 'failed';
    });
  }, [rows, tab]);

  const selectedRows = rows.filter((row) => selected.includes(row.employeeId));
  const selectedNet = selectedRows.reduce((sum, row) => sum + row.netPay, 0);
  const fileTargets = selectedRows.length
    ? selectedRows
    : rows.filter((row) => row.eligible && (row.paymentStatus === 'pending' || row.paymentStatus === 'file'));
  const downloadNote = !batch.approved
    ? 'HR Head has to approve this month before the bank file can be downloaded.'
    : fileTargets.length === 0
      ? 'No Ready employee is left for a bank file.'
      : selected.length === 0
        ? 'No one is ticked, so this downloads every Ready employee who is not already in a direct transfer.'
        : '';

  const visibleIds = visible.map((row) => row.employeeId);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const someChecked = visibleIds.some((id) => selected.includes(id));
  const allRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelected((current) =>
      allChecked ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])],
    );
  }

  function changeTab(next: Tab) {
    setTab(next);
    setSelected([]);
  }

  async function onBankFile() {
    setBusy(true);
    try {
      const result = await createBankFile(month, template, fileTargets.map((row) => row.employeeId));
      downloadText(result.fileName, result.csv);
      await load();
      showToast('Bank file downloaded. Upload it on the bank portal. Salary is not transferred yet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the bank file.');
    } finally {
      setBusy(false);
    }
  }

  async function onReconcile(status: 'paid' | 'failed') {
    const updates = selectedRows
      .filter((row) => (status === 'failed' ? row.paymentStatus === 'file' || row.paymentStatus === 'failed' : row.paymentStatus === 'file'))
      .map((row) => ({ employeeId: row.employeeId, status, utr: (utrs[row.employeeId] ?? '').trim() }));
    if (!updates.length) {
      setError('Select employees whose bank file is already generated.');
      return;
    }
    setBusy(true);
    try {
      const data = await reconcilePayout(month, updates);
      setBatch(data);
      setUtresFrom(data.rows);
      setSelected([]);
      showToast(status === 'paid' ? 'Marked paid from the bank reference' : 'Marked failed');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update payment status.');
    } finally {
      setBusy(false);
    }
  }

  async function onStatement(fileInput: File) {
    const text = await fileInput.text();
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const updates: Array<{ employeeId: string; status: 'paid' | 'failed'; utr?: string }> = [];
    for (const line of lines.slice(1)) {
      const [code, status, utr] = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
      const row = rows.find((item) => item.employeeCode === code);
      if (!row) continue;
      const paid = /^(success|paid|s)$/i.test(status);
      updates.push({ employeeId: row.employeeId, status: paid ? 'paid' : 'failed', utr });
    }
    if (!updates.length) {
      setError('No matching employees in that statement.');
      return;
    }
    setBusy(true);
    try {
      const data = await reconcilePayout(month, updates);
      setBatch(data);
      setUtresFrom(data.rows);
      showToast('Bank statement applied');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the bank statement.');
    } finally {
      setBusy(false);
    }
  }

  async function onRetry() {
    const ids = selectedRows.filter((row) => row.paymentStatus === 'failed').map((row) => row.employeeId);
    if (!ids.length) return;
    setBusy(true);
    try {
      const data = await retryPayout(month, ids);
      setBatch(data);
      setSelected([]);
      showToast('Failed payments are ready to transfer again');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not retry the payment.');
    } finally {
      setBusy(false);
    }
  }

  const fileRows = selectedRows.filter((row) => row.paymentStatus === 'file');
  const paidReady = fileRows.some((row) => (utrs[row.employeeId] ?? '').trim());
  const failedRows = selectedRows.filter((row) => row.paymentStatus === 'failed');

  return (
    <div className="hr-master">
      <div className="hr-master-bar">
        <div>
          <p className="hr-master-lead">
            {batch.totalEmployees} employees · {formatSalary(batch.totalNet)}
            {batch.approved ? ' · Approved' : ' · Waiting for HR Head approval'}
            {method === 'file' && selected.length ? ` · ${selected.length} selected · ${formatSalary(selectedNet)}` : ''}
          </p>
        </div>
        <label>
          Month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </div>

      <div className="hr-segment" role="group" aria-label="Payout method">
        <button type="button" aria-pressed={method === 'file'} onClick={() => setMethod('file')}>
          Bank file
        </button>
        <button type="button" aria-pressed={method === 'direct'} onClick={() => setMethod('direct')}>
          Direct transfer
        </button>
      </div>
      {method === 'direct' ? <DirectTransferPanel month={month} /> : null}
      {method === 'file' ? (
      <>
      {error ? <p className="ess-alert">{error}</p> : null}

      <div className="hr-master-filters">
        <div className="hr-segment" role="group" aria-label="Payout list">
          {(['transfers', 'pending', 'completed', 'failed'] as Tab[]).map((item) => (
            <button key={item} type="button" aria-pressed={tab === item} onClick={() => changeTab(item)}>
              {item === 'transfers' ? 'Ready' : item === 'pending' ? 'Missing bank' : item === 'completed' ? 'Paid' : 'Failed'}
            </button>
          ))}
        </div>
        <select aria-label="Bank template" value={template} onChange={(event) => setTemplate(event.target.value)}>
          {TEMPLATES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <button type="button" className="ess-btn ess-btn-primary" disabled={busy || !batch.approved || fileTargets.length === 0} title={downloadNote} onClick={() => void onBankFile()}>
          Download bank file
        </button>
        {downloadNote ? <p className="hr-master-lead">{downloadNote}</p> : null}
        <label className="ess-btn payout-upload">
          Upload statement
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Upload bank statement"
            disabled={busy}
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              event.target.value = '';
              if (chosen) void onStatement(chosen);
            }}
          />
        </label>
        {fileRows.length > 0 ? (
          <button type="button" className="ess-btn" disabled={busy || !paidReady} onClick={() => void onReconcile('paid')}>
            Mark paid
          </button>
        ) : null}
        {fileRows.length > 0 ? (
          <button type="button" className="ess-btn" disabled={busy} onClick={() => void onReconcile('failed')}>
            Mark failed
          </button>
        ) : null}
        {tab === 'failed' && failedRows.length > 0 ? (
          <button type="button" className="ess-btn" disabled={busy} onClick={() => void onRetry()}>
            Retry
          </button>
        ) : null}
      </div>

      <div className="salary-scroll">
        <table className="salary-table">
          <thead>
            <tr>
              <th>
                <input
                  ref={allRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  disabled={visibleIds.length === 0}
                  aria-label="Select all"
                />
              </th>
              <th>Employee id</th>
              <th>Name</th>
              <th>Bank</th>
              <th>IFSC</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Status</th>
              <th>UTR</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9}>{batch.totalEmployees === 0 ? 'HR has not sent this month yet.' : 'Nothing in this tab.'}</td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.employeeId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(row.employeeId)}
                      onChange={() => toggle(row.employeeId)}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                  <td>{row.employeeCode}</td>
                  <td>{row.name}</td>
                  <td>{row.bankName || '—'}</td>
                  <td>{row.ifscCode || 'Missing'}</td>
                  <td>{row.bankAccountNumber || 'Missing'}</td>
                  <td>{formatSalary(row.netPay)}</td>
                  <td>{paymentLabel(row)}</td>
                  <td>
                    <input
                      value={utrs[row.employeeId] ?? ''}
                      onChange={(event) => setUtrs({ ...utrs, [row.employeeId]: event.target.value })}
                      aria-label={`UTR for ${row.name}`}
                      disabled={row.paymentStatus === 'paid'}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      ) : null}
    </div>
  );
}
