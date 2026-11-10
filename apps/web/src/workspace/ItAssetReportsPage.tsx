import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { assetMessage, fetchAssetReport, money, titleCase, todayIso } from './assetsApi';
import './it-assets.css';

type Row = Record<string, unknown>;
type Column = { header: string; value: (row: Row) => string | number; cell?: (row: Row) => ReactNode };

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const count = (key: string) => (row: Row) => Number(row[key] ?? 0);
const field = (key: string) => (row: Row) => text(row[key]);
const tagLink = (row: Row) => <Link to={`/it/assets/${text(row.assetId)}`}>{text(row.assetTag)}</Link>;
const amount = (header: string, key: string): Column => ({
  header,
  value: count(key),
  cell: (row) => money(Number(row[key] ?? 0)),
});
const tag: Column = { header: 'Tag', value: field('assetTag'), cell: tagLink };

const REPORTS: Array<{ kind: string; label: string; columns: Column[] }> = [
  {
    kind: 'stock',
    label: 'Asset Stock',
    columns: [
      { header: 'Category', value: field('category') },
      { header: 'Location', value: field('location') },
      { header: 'Total', value: count('total') },
      { header: 'In Stock', value: count('in_stock') },
      { header: 'Allocated', value: count('allocated') },
      { header: 'Maintenance', value: count('under_maintenance') },
      { header: 'Lost', value: count('lost') },
      { header: 'Retired', value: count('retired') },
      { header: 'Disposed', value: count('disposed') },
      { header: 'Written Off', value: count('written_off') },
    ],
  },
  {
    kind: 'allocations',
    label: 'Allocations',
    columns: [
      tag,
      { header: 'Asset', value: field('asset') },
      { header: 'Category', value: field('category') },
      { header: 'Serial', value: field('serialNo') },
      { header: 'Employee', value: field('employee') },
      { header: 'Department', value: field('department') },
      { header: 'Issued', value: field('assignedOn') },
      { header: 'Acknowledgement', value: (row) => titleCase(text(row.ackStatus)) },
    ],
  },
  {
    kind: 'employees',
    label: 'Employee-wise',
    columns: [
      { header: 'Employee', value: field('employee') },
      { header: 'Code', value: field('employeeCode') },
      { header: 'Department', value: field('department') },
      { header: 'Assets held', value: count('count') },
      { header: 'Items', value: field('assets') },
      { header: 'Not acknowledged', value: count('pendingAck') },
    ],
  },
  {
    kind: 'overdue',
    label: 'Overdue Returns',
    columns: [
      tag,
      { header: 'Asset', value: field('asset') },
      { header: 'Employee', value: field('employee') },
      { header: 'Issued', value: field('assignedOn') },
      { header: 'Due', value: field('expectedReturnOn') },
      { header: 'Days overdue', value: count('daysOverdue') },
    ],
  },
  {
    kind: 'warranty',
    label: 'Warranty Expiry',
    columns: [
      tag,
      { header: 'Asset', value: field('asset') },
      { header: 'Category', value: field('category') },
      { header: 'Status', value: field('status') },
      { header: 'Expires', value: field('warrantyExpiry') },
      {
        header: 'Days left',
        value: count('daysLeft'),
        cell: (row) => (Number(row.daysLeft) < 0 ? 'Expired' : text(row.daysLeft)),
      },
    ],
  },
  {
    kind: 'department-cost',
    label: 'Department Cost',
    columns: [
      { header: 'Department', value: field('department') },
      { header: 'Assets', value: count('assets') },
      amount('Purchase cost', 'cost'),
      amount('Repair cost', 'repairCost'),
    ],
  },
  {
    kind: 'history',
    label: 'Asset History',
    columns: [
      { header: 'Date', value: (row) => text(row.changedAt).slice(0, 10) },
      tag,
      { header: 'Asset', value: field('asset') },
      { header: 'From', value: field('from') },
      { header: 'To', value: field('to') },
      { header: 'Reason', value: field('reason') },
      { header: 'Changed by', value: field('changedBy') },
    ],
  },
];

function downloadCsv(fileName: string, columns: Column[], rows: Row[]) {
  const cell = (value: string | number) => {
    const out = String(value);
    return /[",\n]/.test(out) ? `"${out.replace(/"/g, '""')}"` : out;
  };
  const lines = [columns.map((column) => cell(column.header)).join(',')];
  for (const row of rows) lines.push(columns.map((column) => cell(column.value(row))).join(','));
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ItAssetReportsPage() {
  const [kind, setKind] = useState('stock');
  const [days, setDays] = useState('90');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Each report has its own row shape, so rows stay tied to the report they came from.
  const [loaded, setLoaded] = useState<{ kind: string; rows: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const params: Record<string, string> =
      kind === 'warranty' ? { days } : kind === 'history' ? { from, to } : {};
    fetchAssetReport(kind, params)
      .then((rows) => {
        if (!live) return;
        setLoaded({ kind, rows });
        setError(null);
      })
      .catch((err: unknown) => {
        if (live) setError(assetMessage(err));
      });
    return () => {
      live = false;
    };
  }, [kind, days, from, to]);

  const report = REPORTS.find((item) => item.kind === kind)!;
  const current = loaded?.kind === kind ? loaded : null;
  const rows = current?.rows ?? [];

  return (
    <div className="it-assets">
      <div className="ess-tabs" role="tablist">
        {REPORTS.map((item) => (
          <button
            key={item.kind}
            type="button"
            role="tab"
            aria-selected={kind === item.kind}
            className={`ess-tab${kind === item.kind ? ' is-active' : ''}`}
            onClick={() => setKind(item.kind)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="it-assets-toolbar">
        <div className="it-assets-filters">
          {kind === 'warranty' ? (
            <label className="it-assets-inline">
              Within days
              <input type="number" min={1} max={730} value={days} onChange={(event) => setDays(event.target.value)} />
            </label>
          ) : null}
          {kind === 'history' ? (
            <>
              <label className="it-assets-inline">
                From
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className="it-assets-inline">
                To
                <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
            </>
          ) : null}
        </div>
        <button
          type="button"
          className="ess-btn"
          disabled={rows.length === 0}
          onClick={() => downloadCsv(`assets-${kind}-${todayIso()}.csv`, report.columns, rows)}
        >
          Download CSV
        </button>
      </div>

      {error ? <p className="ess-alert">{error}</p> : null}

      <section className="ess-panel">
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                {report.columns.map((column) => (
                  <th key={column.header}>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {report.columns.map((column) => (
                    <td key={column.header}>{column.cell ? column.cell(row) : column.value(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {current && rows.length === 0 ? <p className="ess-empty">Nothing to report.</p> : null}
          {!current && !error ? <p className="ess-empty">Loading…</p> : null}
        </div>
      </section>
    </div>
  );
}
