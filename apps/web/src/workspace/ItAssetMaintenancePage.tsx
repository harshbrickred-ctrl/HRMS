import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EssModal } from '../ess/components/EssModal';
import { StatusChip } from '../ess/components/StatusChip';
import {
  REPAIR_STAGES,
  assetMessage,
  completeRepair,
  fetchAssetTickets,
  fetchAssets,
  fetchMaintenanceOverview,
  fetchRepairs,
  money,
  openRepair,
  rupees,
  setRepairStage,
  shortDate,
  titleCase,
  todayIso,
  updateRepair,
  type AssetRecord,
  type AssetRepair,
  type AssetTicket,
  type MaintenanceOverview,
  type RepairStage,
} from './assetsApi';
import './it-assets.css';

const STAGE_NEXT: Record<RepairStage, RepairStage | null> = { with_vendor: 'testing', testing: 'ready', ready: null };
const STAGE_BACK: Record<RepairStage, RepairStage | null> = { with_vendor: null, testing: 'with_vendor', ready: 'testing' };

function daysAgo(iso: string) {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
  return days === 0 ? 'raised today' : `raised ${days} day${days === 1 ? '' : 's'} ago`;
}

export function ItAssetMaintenancePage() {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<AssetRepair[]>([]);
  const [completed, setCompleted] = useState<AssetRepair[]>([]);
  const [tickets, setTickets] = useState<AssetTicket[]>([]);
  const [overview, setOverview] = useState<MaintenanceOverview | null>(null);
  const [creating, setCreating] = useState(Boolean(params.get('assetId')));
  const [editing, setEditing] = useState<AssetRepair | null>(null);
  const [completing, setCompleting] = useState<AssetRepair | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    return Promise.all([fetchRepairs('open'), fetchRepairs('completed'), fetchAssetTickets(), fetchMaintenanceOverview()]).then(
      ([nextOpen, nextDone, nextTickets, nextOverview]) => {
        setOpen(nextOpen);
        setCompleted(nextDone);
        setTickets(nextTickets);
        setOverview(nextOverview);
        setError(null);
      },
    );
  }

  useEffect(() => {
    load()
      .catch((err: unknown) => setError(assetMessage(err)))
      .finally(() => setReady(true));
  }, []);

  function finished(message: string) {
    setNotice(message);
    setCreating(false);
    setEditing(null);
    setCompleting(null);
    setParams({});
    void load();
  }

  async function move(repair: AssetRepair, stage: RepairStage) {
    setMoving(repair.id);
    setError(null);
    try {
      await setRepairStage(repair.id, stage);
      await load();
    } catch (err: unknown) {
      setError(assetMessage(err));
    } finally {
      setMoving(null);
    }
  }

  // Fault reports nobody has acted on yet. Once a repair is opened they move to its column.
  const inRepair = new Set(open.map((row) => row.asset.id));
  const raised = tickets.filter((ticket) => ticket.type === 'Issue' && ticket.status === 'Open' && !(ticket.asset && inRepair.has(ticket.asset.id)));
  const columns = REPAIR_STAGES.map((stage) => ({ ...stage, rows: open.filter((row) => row.stage === stage.value) }));

  return (
    <div className="it-assets">
      <div className="it-head">
        <p className="it-assets-note">Fault reports, repairs in progress, and warranties about to end.</p>
        <button type="button" className="ess-btn ess-btn-primary" onClick={() => setCreating(true)}>
          Raise repair
        </button>
      </div>
      {error ? <p className="ess-alert">{error}</p> : null}
      {notice ? <p className="it-assets-ok">{notice}</p> : null}

      <div className="it-kpis">
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Open tickets</p>
          <p className="ess-insight-value">{ready ? raised.length + open.length : '…'}</p>
          <p className="it-kpi-sub">
            {open.length} under maintenance, {raised.length} not yet sent
          </p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Average repair time</p>
          <p className="ess-insight-value">
            {overview?.averageRepairDays === null || overview?.averageRepairDays === undefined
              ? '—'
              : `${overview.averageRepairDays} day${overview.averageRepairDays === 1 ? '' : 's'}`}
          </p>
          <p className="it-kpi-sub">
            Raised to returned, last 90 days{overview ? ` (${overview.repairsCompleted90Days} repairs)` : ''}
          </p>
        </article>
        <Link to="/it/assets?view=warranty" className="ess-panel ess-insight it-kpi">
          <p className="ess-muted">Warranty ends in 30 days</p>
          <p className="ess-insight-value">{overview?.warrantyEnding ?? '…'}</p>
          <p className="it-kpi-sub">
            Across {overview?.warrantyBatches.length ?? 0} batch{overview?.warrantyBatches.length === 1 ? '' : 'es'}
          </p>
        </Link>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Overdue repairs</p>
          <p className="ess-insight-value">{overview?.overdueRepairs ?? '…'}</p>
          <p className="it-kpi-sub">Past the vendor's expected date</p>
        </article>
      </div>

      <section className="ess-panel">
        <h2>Repair tickets by stage</h2>
        <div className="it-board">
          <div className="it-board-col">
            <h3>
              Raised <span className="it-assets-note">{raised.length}</span>
            </h3>
            {raised.length === 0 ? <p className="ess-empty">No new fault reports.</p> : null}
            {raised.map((ticket) => (
              <article key={ticket.id} className="it-board-card">
                <div className="it-pick-head">
                  <strong>{ticket.reference}</strong>
                  <StatusChip
                    status={ticket.priority === 'high' ? 'rejected' : ticket.priority === 'medium' ? 'pending' : 'withdrawn'}
                    label={ticket.priority === 'high' ? 'Urgent' : titleCase(ticket.priority)}
                  />
                </div>
                <p>
                  {ticket.asset ? (
                    <Link to={`/it/assets/${ticket.asset.id}`}>
                      {ticket.asset.name} · {ticket.asset.assetTag}
                    </Link>
                  ) : (
                    'No asset'
                  )}
                </p>
                <p>{ticket.subject}: {ticket.body}</p>
                <span className="it-sub">
                  {ticket.person?.name ?? 'Employee'} · {daysAgo(ticket.createdAt)}
                </span>
                <div className="ess-actions">
                  {ticket.asset?.status === 'allocated' ? (
                    <Link className="ess-btn ess-btn-primary" to={`/it/return?assetId=${ticket.asset.id}&condition=requires_repair`}>
                      Collect and send
                    </Link>
                  ) : ticket.asset?.status === 'in_stock' ? (
                    <button
                      type="button"
                      className="ess-btn ess-btn-primary"
                      onClick={() => {
                        setParams({ assetId: ticket.asset!.id, ticketId: ticket.id });
                        setCreating(true);
                      }}
                    >
                      Send to repair
                    </button>
                  ) : null}
                  <Link className="ess-btn" to="/it/tickets">
                    Open ticket
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {columns.map((column) => (
            <div key={column.value} className="it-board-col">
              <h3>
                {column.label} <span className="it-assets-note">{column.rows.length}</span>
              </h3>
              {column.rows.length === 0 ? <p className="ess-empty">Nothing here.</p> : null}
              {column.rows.map((row) => {
                const next = STAGE_NEXT[row.stage];
                const back = STAGE_BACK[row.stage];
                return (
                  <article key={row.id} className="it-board-card">
                    <div className="it-pick-head">
                      <strong>{row.ticketReference ?? 'Repair'}</strong>
                      <span className="ess-actions">
                        {row.overdue ? <StatusChip status="rejected" label="Overdue" /> : null}
                        {row.cost !== null ? (
                          <StatusChip status="pending" label={`Quote ${rupees(row.cost)}`} />
                        ) : (
                          <StatusChip
                            status={row.inWarranty ? 'approved' : 'withdrawn'}
                            label={row.inWarranty ? 'In warranty' : 'Out of warranty'}
                          />
                        )}
                      </span>
                    </div>
                    <p>
                      <Link to={`/it/assets/${row.asset.id}?tab=maintenance`}>
                        {row.asset.name} · {row.asset.assetTag}
                      </Link>
                    </p>
                    <p>{row.issue}</p>
                    <span className="it-sub">
                      {[row.vendor || 'No vendor yet', row.asset.location, `day ${row.daysOpen}`].filter(Boolean).join(' · ')}
                    </span>
                    <div className="ess-actions">
                      {back ? (
                        <button type="button" className="ess-btn ess-btn-ghost" disabled={moving === row.id} onClick={() => void move(row, back)}>
                          Back
                        </button>
                      ) : null}
                      <button type="button" className="ess-btn" onClick={() => setEditing(row)}>
                        Edit
                      </button>
                      {next ? (
                        <button type="button" className="ess-btn ess-btn-primary" disabled={moving === row.id} onClick={() => void move(row, next)}>
                          {next === 'testing' ? 'Back from vendor' : 'Ready to return'}
                        </button>
                      ) : (
                        <button type="button" className="ess-btn ess-btn-primary" onClick={() => setCompleting(row)}>
                          Complete
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="ess-panel">
        <h2>Warranty ending in the next 30 days</h2>
        {overview && overview.warrantyBatches.length === 0 ? <p className="ess-empty">No warranties end in the next 30 days.</p> : null}
        {overview?.warrantyBatches.length ? (
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Assets</th>
                  <th>Warranty ends</th>
                  <th>Book value</th>
                  <th>Suggested action</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {overview.warrantyBatches.map((batch) => (
                  <tr key={`${batch.name}-${batch.boughtOn}-${batch.vendor}`}>
                    <td>
                      <strong>
                        {batch.name}
                        {batch.boughtOn ? `, bought ${shortDate(`${batch.boughtOn}-01`).slice(3)}` : ''}
                      </strong>
                      <span className="it-sub">{[batch.category, batch.vendor].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td>{batch.assets}</td>
                    <td>{shortDate(batch.endsOn)}</td>
                    <td>{rupees(batch.bookValue)}</td>
                    <td>{batch.suggestion}</td>
                    <td>
                      <Link className="ess-btn" to={`/it/assets?view=warranty&q=${encodeURIComponent(batch.name)}`}>
                        Open assets
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="ess-panel">
        <h2>Completed repairs</h2>
        {ready && completed.length === 0 ? <p className="ess-empty">No completed repairs yet.</p> : null}
        {completed.length ? (
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Issue</th>
                  <th>Vendor</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Cost</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link to={`/it/assets/${row.asset.id}`}>{row.asset.assetTag}</Link>
                      <span className="it-sub">{row.asset.name}</span>
                    </td>
                    <td>
                      {row.issue}
                      {row.ticketReference ? <span className="it-sub">{row.ticketReference}</span> : null}
                    </td>
                    <td>{row.vendor || '—'}</td>
                    <td>{shortDate(row.startedOn)}</td>
                    <td>{shortDate(row.completedOn)}</td>
                    <td>{money(row.cost)}</td>
                    <td>
                      <StatusChip status="approved" label={titleCase(row.outcome ?? 'completed')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {creating ? (
        <OpenRepairModal
          assetId={params.get('assetId') ?? ''}
          ticketId={params.get('ticketId') ?? ''}
          onClose={() => {
            setCreating(false);
            setParams({});
          }}
          onDone={() => finished('Repair opened. The asset cannot be allocated until it is complete.')}
        />
      ) : null}
      {editing ? <EditRepairModal repair={editing} onClose={() => setEditing(null)} onDone={() => finished('Repair updated.')} /> : null}
      {completing ? (
        <CompleteRepairModal
          repair={completing}
          onClose={() => setCompleting(null)}
          onDone={(outcome) =>
            finished(outcome === 'repaired' ? 'Repaired and back In Stock.' : 'Marked beyond repair and Retired.')
          }
        />
      ) : null}
    </div>
  );
}

function Actions({ onClose, busy, form, label }: { onClose: () => void; busy: boolean; form: string; label: string }) {
  return (
    <>
      <button type="button" className="ess-btn" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" form={form} className="ess-btn ess-btn-primary" disabled={busy}>
        {busy ? 'Saving…' : label}
      </button>
    </>
  );
}

function OpenRepairModal({
  assetId: initialAsset,
  ticketId,
  onClose,
  onDone,
}: {
  assetId: string;
  ticketId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetId, setAssetId] = useState(initialAsset);
  const [issue, setIssue] = useState('');
  const [vendor, setVendor] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [startedOn, setStartedOn] = useState(todayIso());
  const [expectedOn, setExpectedOn] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets({ status: 'in_stock' })
      .then(setAssets)
      .catch((err: unknown) => setError(assetMessage(err)));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await openRepair(assetId, {
        issue,
        vendor,
        vendorContact,
        startedOn,
        expectedOn: expectedOn || undefined,
        estimatedCost: cost === '' ? undefined : Number(cost),
        ticketId: ticketId || undefined,
      });
      onDone();
    } catch (err: unknown) {
      setError(assetMessage(err));
      setBusy(false);
    }
  }

  return (
    <EssModal title="New repair" onClose={onClose} actions={<Actions onClose={onClose} busy={busy} form="repair-open" label="Open repair" />}>
      <form id="repair-open" className="it-assets-modal-form" onSubmit={(event) => void onSubmit(event)}>
        {error ? <p className="ess-alert">{error}</p> : null}
        <div className="ess-field">
          <label htmlFor="repair-asset">Asset</label>
          <select id="repair-asset" value={assetId} onChange={(event) => setAssetId(event.target.value)} required>
            <option value="">Choose an In Stock asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.assetTag} · {asset.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ess-field">
          <label htmlFor="repair-issue">Issue</label>
          <textarea id="repair-issue" rows={2} value={issue} onChange={(event) => setIssue(event.target.value)} minLength={3} required />
        </div>
        <div className="ess-field">
          <label htmlFor="repair-vendor">Vendor</label>
          <input id="repair-vendor" value={vendor} onChange={(event) => setVendor(event.target.value)} />
        </div>
        <div className="ess-field">
          <label htmlFor="repair-contact">Vendor contact</label>
          <input id="repair-contact" value={vendorContact} onChange={(event) => setVendorContact(event.target.value)} />
        </div>
        <div className="ess-field">
          <label htmlFor="repair-start">Start date</label>
          <input id="repair-start" type="date" max={todayIso()} value={startedOn} onChange={(event) => setStartedOn(event.target.value)} required />
        </div>
        <div className="ess-field">
          <label htmlFor="repair-expected">Expected completion</label>
          <input id="repair-expected" type="date" min={startedOn} value={expectedOn} onChange={(event) => setExpectedOn(event.target.value)} />
        </div>
        <div className="ess-field">
          <label htmlFor="repair-cost">Estimated cost (₹)</label>
          <input id="repair-cost" type="number" min={0} step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} />
        </div>
      </form>
    </EssModal>
  );
}

function EditRepairModal({ repair, onClose, onDone }: { repair: AssetRepair; onClose: () => void; onDone: () => void }) {
  const [vendor, setVendor] = useState(repair.vendor);
  const [vendorContact, setVendorContact] = useState(repair.vendorContact);
  const [expectedOn, setExpectedOn] = useState(repair.expectedOn ?? '');
  const [cost, setCost] = useState(repair.cost === null ? '' : String(repair.cost));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateRepair(repair.id, {
        vendor,
        vendorContact,
        expectedOn: expectedOn || null,
        estimatedCost: cost === '' ? null : Number(cost),
      });
      onDone();
    } catch (err: unknown) {
      setError(assetMessage(err));
      setBusy(false);
    }
  }

  return (
    <EssModal title={`Edit repair: ${repair.asset.assetTag}`} onClose={onClose} actions={<Actions onClose={onClose} busy={busy} form="repair-edit" label="Save" />}>
      <form id="repair-edit" className="it-assets-modal-form" onSubmit={(event) => void onSubmit(event)}>
        {error ? <p className="ess-alert">{error}</p> : null}
        <div className="ess-field">
          <label htmlFor="edit-vendor">Vendor</label>
          <input id="edit-vendor" value={vendor} onChange={(event) => setVendor(event.target.value)} />
        </div>
        <div className="ess-field">
          <label htmlFor="edit-contact">Vendor contact</label>
          <input id="edit-contact" value={vendorContact} onChange={(event) => setVendorContact(event.target.value)} />
        </div>
        <div className="ess-field">
          <label htmlFor="edit-expected">Expected completion</label>
          <input id="edit-expected" type="date" min={repair.startedOn} value={expectedOn} onChange={(event) => setExpectedOn(event.target.value)} />
        </div>
        <div className="ess-field">
          <label htmlFor="edit-cost">Estimated cost (₹)</label>
          <input id="edit-cost" type="number" min={0} step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} />
        </div>
      </form>
    </EssModal>
  );
}

function CompleteRepairModal({
  repair,
  onClose,
  onDone,
}: {
  repair: AssetRepair;
  onClose: () => void;
  onDone: (outcome: string) => void;
}) {
  const [outcome, setOutcome] = useState<'repaired' | 'beyond_repair'>('repaired');
  const [completedOn, setCompletedOn] = useState(todayIso());
  const [cost, setCost] = useState(repair.cost === null ? '' : String(repair.cost));
  const [outcomeNotes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await completeRepair(repair.id, {
        outcome,
        completedOn,
        cost: cost === '' ? undefined : Number(cost),
        outcomeNotes,
      });
      onDone(outcome);
    } catch (err: unknown) {
      setError(assetMessage(err));
      setBusy(false);
    }
  }

  return (
    <EssModal title={`Complete repair: ${repair.asset.assetTag}`} onClose={onClose} actions={<Actions onClose={onClose} busy={busy} form="repair-complete" label="Complete" />}>
      <form id="repair-complete" className="it-assets-modal-form" onSubmit={(event) => void onSubmit(event)}>
        {error ? <p className="ess-alert">{error}</p> : null}
        <div className="ess-field">
          <label htmlFor="complete-outcome">Outcome</label>
          <select id="complete-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)}>
            <option value="repaired">Repaired (back to In Stock)</option>
            <option value="beyond_repair">Beyond repair (Retired)</option>
          </select>
        </div>
        <div className="ess-field">
          <label htmlFor="complete-date">Completion date</label>
          <input id="complete-date" type="date" min={repair.startedOn} max={todayIso()} value={completedOn} onChange={(event) => setCompletedOn(event.target.value)} required />
        </div>
        <div className="ess-field">
          <label htmlFor="complete-cost">Repair cost (₹)</label>
          <input id="complete-cost" type="number" min={0} step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} />
        </div>
        <div className="ess-field">
          <label htmlFor="complete-notes">Notes</label>
          <textarea id="complete-notes" rows={2} value={outcomeNotes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </form>
    </EssModal>
  );
}
