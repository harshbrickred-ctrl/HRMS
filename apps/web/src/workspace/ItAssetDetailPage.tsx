import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EssModal } from '../ess/components/EssModal';
import { StatusChip } from '../ess/components/StatusChip';
import { AssetHistoryPanels } from './ItAssetHistoryPage';
import { printAssetLabels } from './assetLabels';
import {
  ACK_LABELS,
  ASSET_STATUS_LABELS,
  assetMessage,
  changeAssetStatus,
  deleteAsset,
  fetchAllocationFile,
  fetchAsset,
  fetchAssetAllocations,
  fetchAssetHistory,
  fetchAssetPhoto,
  fetchRepairs,
  initials,
  money,
  openBlob,
  rupees,
  shortDate,
  titleCase,
  type AssetAllocation,
  type AssetDetail,
  type AssetHistoryEvent,
  type AssetRepair,
  type AssetStatus,
} from './assetsApi';
import './it-assets.css';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'history', label: 'History' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'documents', label: 'Documents' },
  { value: 'financials', label: 'Financials' },
] as const;

type Tab = (typeof TABS)[number]['value'];

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value === null || value === undefined || value === '' ? '—' : value}</dd>
    </div>
  );
}

function years(months: number) {
  return months % 12 === 0 ? `${months / 12} year${months === 12 ? '' : 's'}` : `${months} months`;
}

export function ItAssetDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((item) => item.value === params.get('tab')) ? params.get('tab') : 'overview') as Tab;
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [allocations, setAllocations] = useState<AssetAllocation[]>([]);
  const [events, setEvents] = useState<AssetHistoryEvent[]>([]);
  const [repairs, setRepairs] = useState<AssetRepair[] | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [changing, setChanging] = useState<AssetStatus | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  );

  function load() {
    return Promise.all([fetchAsset(id), fetchAssetAllocations(id), fetchAssetHistory(id)]).then(
      ([nextAsset, nextAllocations, nextEvents]) => {
        setAsset(nextAsset);
        setAllocations(nextAllocations);
        setEvents(nextEvents);
        setError(null);
      },
    );
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(assetMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (tab !== 'maintenance' && tab !== 'financials') return;
    fetchRepairs(undefined, id)
      .then(setRepairs)
      .catch((err: unknown) => setError(assetMessage(err)));
  }, [id, tab]);

  const hasPhoto = asset?.hasPhoto ?? false;
  useEffect(() => {
    if (!hasPhoto) return;
    let url: string | null = null;
    let live = true;
    fetchAssetPhoto(id)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setPhotoUrl(url);
      })
      .catch(() => {
        if (live) setPhotoUrl(null);
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, hasPhoto]);

  function showTab(next: Tab) {
    const query = new URLSearchParams(params);
    if (next === 'overview') query.delete('tab');
    else query.set('tab', next);
    setParams(query, { replace: true });
  }

  async function onChangeStatus() {
    if (!changing) return;
    setBusy(true);
    setError(null);
    try {
      await changeAssetStatus(id, changing, reason);
      setNotice(`Status changed to ${ASSET_STATUS_LABELS[changing]}.`);
      setChanging(null);
      setReason('');
      await load();
    } catch (err: unknown) {
      setChanging(null);
      setNotice(null);
      setError(assetMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteAsset(id);
      navigate('/it/assets');
    } catch (err: unknown) {
      setConfirming(false);
      setError(assetMessage(err));
      setBusy(false);
    }
  }

  async function openFile(allocationId: string, fileId: string) {
    try {
      openBlob(await fetchAllocationFile(allocationId, fileId));
    } catch (err: unknown) {
      setError(assetMessage(err));
    }
  }

  if (!asset) {
    return (
      <div className="it-assets">
        <Link className="it-assets-back" to="/it/assets">
          ← Asset register
        </Link>
        {error ? <p className="ess-alert">{error}</p> : <p className="ess-empty">Loading…</p>}
      </div>
    );
  }

  const status = asset.status;
  const canDelete = status === 'in_stock' && allocations.length === 0;
  const canRetire = asset.nextStatuses.includes('retired') && status !== 'under_maintenance';
  // Allocation, return and repair have their own forms; Retire has its own button.
  const otherMoves = asset.nextStatuses.filter((next) => {
    if (next === 'allocated' || next === 'retired' || next === 'under_maintenance') return false;
    if (status === 'allocated') return next === 'lost';
    return status !== 'under_maintenance';
  });
  const holder = asset.current;
  const files = allocations.flatMap((row) => row.files.map((file) => ({ ...file, allocation: row })));
  const makeModel = [asset.make, asset.model].filter(Boolean).join(' ');

  return (
    <div className="it-assets">
      <Link className="it-assets-back" to="/it/assets">
        ← Asset register / {asset.assetTag}
      </Link>

      <section className="ess-panel it-detail-head">
        <div>
          <h2>
            {asset.name}
            <StatusChip status={status} label={ASSET_STATUS_LABELS[status]} />
          </h2>
          <p className="it-assets-note">
            Asset tag {asset.assetTag} · {asset.category.name}
            {asset.serialNo ? ` · Serial ${asset.serialNo}` : ''}
            {asset.location ? ` · ${asset.location.name}` : ''}
          </p>
        </div>
        <div className="ess-actions">
          {status === 'in_stock' ? (
            <Link className="ess-btn ess-btn-primary" to={`/it/allocate?assetId=${id}`}>
              Issue
            </Link>
          ) : null}
          {status === 'allocated' ? (
            <>
              <Link className="ess-btn" to={`/it/transfer?assetId=${id}`}>
                Transfer
              </Link>
              <Link className="ess-btn" to={`/it/return?assetId=${id}`}>
                Return
              </Link>
              <Link className="ess-btn ess-btn-primary" to={`/it/return?assetId=${id}&condition=requires_repair`}>
                Raise repair
              </Link>
            </>
          ) : null}
          {status === 'in_stock' ? (
            <Link className="ess-btn" to={`/it/maintenance?assetId=${id}`}>
              Raise repair
            </Link>
          ) : null}
          {status === 'under_maintenance' ? (
            <Link className="ess-btn ess-btn-primary" to="/it/maintenance">
              Open repair board
            </Link>
          ) : null}
          <Link className="ess-btn" to={`/it/assets/${id}/edit`}>
            Edit
          </Link>
          {otherMoves.map((next) => (
            <button key={next} type="button" className="ess-btn" onClick={() => setChanging(next)}>
              {next === 'in_stock' ? 'Mark found' : next === 'lost' ? 'Mark lost' : `Move to ${ASSET_STATUS_LABELS[next]}`}
            </button>
          ))}
          {canRetire ? (
            <button type="button" className="ess-btn ess-btn-danger" onClick={() => setChanging('retired')}>
              Retire
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" className="ess-btn ess-btn-danger" onClick={() => setConfirming(true)}>
              Delete
            </button>
          ) : null}
        </div>
      </section>

      {error ? <p className="ess-alert">{error}</p> : null}
      {notice ? <p className="it-assets-ok">{notice}</p> : null}

      <div className="ess-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`ess-tab${tab === item.value ? ' is-active' : ''}`}
            onClick={() => showTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="it-detail-grid">
          <div className="it-stack">
            <section className="ess-panel">
              <h2>Details</h2>
              <dl className="it-facts-2">
                <Fact label="Category" value={asset.category.name} />
                <Fact label="Make and model" value={makeModel} />
                <Fact label="Serial number" value={asset.serialNo} />
                <Fact label="Asset tag" value={asset.assetTag} />
                <Fact label="Purchase date" value={asset.purchasedOn ? shortDate(asset.purchasedOn) : null} />
                <Fact label="Vendor" value={asset.vendor} />
                <Fact label="Asset owner" value={asset.owner} />
                <Fact label="Location" value={asset.location?.name} />
                <Fact label="Purchase cost" value={asset.cost === null ? null : rupees(asset.cost)} />
                {asset.condition ? <Fact label="Condition (from import)" value={asset.condition} /> : null}
                {asset.fieldDefs.map((def) => (
                  <Fact key={def.key} label={def.label} value={asset.customFields[def.key]} />
                ))}
              </dl>
              {asset.description ? <p className="it-assets-description">{asset.description}</p> : null}
              {hasPhoto && photoUrl ? (
                <div className="it-assets-photo">
                  <img src={photoUrl} alt={asset.name} />
                </div>
              ) : null}
              <p className="it-assets-note">
                Added {shortDate(asset.createdAt)}
                {asset.createdBy ? ` by ${asset.createdBy}` : ''} · Updated {shortDate(asset.updatedAt)}
                {asset.updatedBy ? ` by ${asset.updatedBy}` : ''}
              </p>
            </section>

            <section className="ess-panel">
              <div className="ess-panel-head">
                <h2>Lifecycle history</h2>
                {events.length > 6 ? (
                  <button type="button" className="it-linkbtn" onClick={() => showTab('history')}>
                    See all {events.length}
                  </button>
                ) : null}
              </div>
              {events.length === 0 ? <p className="ess-empty">Nothing has happened to this asset yet.</p> : null}
              <ol className="it-assets-timeline">
                {events.slice(0, 6).map((event, index) => (
                  <li key={`${event.at}-${index}`}>
                    <strong>{event.title}</strong>
                    {event.detail ? <p>{event.detail}</p> : null}
                    <span className="it-assets-note">
                      {shortDate(event.at)}
                      {event.by ? ` · ${event.by}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="it-stack">
            <section className="ess-panel">
              <h2>Current holder</h2>
              {holder ? (
                <>
                  <div className="it-person">
                    <span className="it-avatar" aria-hidden>
                      {initials(holder.name)}
                    </span>
                    <div>
                      <Link to={`/it/employee-assets?employee=${holder.employeeId}`}>
                        <strong>{holder.name}</strong>
                      </Link>
                      <span className="it-sub">
                        {[asset.holder?.department, asset.holder?.location].filter(Boolean).join(' · ') || holder.employeeCode}
                      </span>
                    </div>
                  </div>
                  <dl className="it-facts-2">
                    <Fact label="Manager" value={asset.holder?.manager} />
                    <Fact label="Issued on" value={shortDate(holder.assignedOn)} />
                    <div>
                      <dt>Acknowledgement</dt>
                      <dd>
                        {holder.ackStatus === 'acknowledged' ? (
                          <StatusChip status="approved" label={`Signed ${shortDate(asset.holder?.ackAt)}`} />
                        ) : holder.ackStatus === 'pending' ? (
                          <StatusChip
                            status="pending"
                            label={asset.holder?.ackDueOn ? `Due ${shortDate(asset.holder.ackDueOn)}` : 'Pending'}
                          />
                        ) : (
                          ACK_LABELS[holder.ackStatus]
                        )}
                      </dd>
                    </div>
                    <Fact label="Accessories" value={asset.holder?.accessories} />
                    {holder.expectedReturnOn ? <Fact label="Expected return" value={shortDate(holder.expectedReturnOn)} /> : null}
                    <Fact label="Project / work" value={asset.holder?.project} />
                    <Fact label="Mobile" value={asset.holder?.contactMobile} />
                    <Fact label="Employment type" value={asset.holder?.employmentType} />
                  </dl>
                </>
              ) : (
                <p className="ess-empty">
                  {status === 'in_stock' ? 'In stock and ready to issue.' : `Not with anyone (${ASSET_STATUS_LABELS[status]}).`}
                </p>
              )}
            </section>

            <section className="ess-panel">
              <h2>Financials</h2>
              <dl className="it-facts-2">
                <Fact label="Purchase cost" value={asset.cost === null ? null : rupees(asset.cost)} />
                <Fact label="Method" value={`${asset.financials.method}, ${years(asset.financials.lifeMonths)}`} />
                <Fact
                  label="Depreciation to date"
                  value={
                    asset.financials.depreciated === null
                      ? null
                      : `${rupees(asset.financials.depreciated)} (${asset.financials.monthsUsed} month${asset.financials.monthsUsed === 1 ? '' : 's'})`
                  }
                />
                <div>
                  <dt>Book value</dt>
                  <dd className="it-big">{rupees(asset.financials.bookValue)}</dd>
                </div>
              </dl>
              {asset.financials.bookValue === null ? (
                <p className="it-assets-note">Add the purchase cost and date to see book value.</p>
              ) : null}
            </section>

            <section className="ess-panel">
              <h2>Warranty</h2>
              {asset.warranty ? (
                <>
                  <div className="it-pager" style={{ paddingTop: 0 }}>
                    <span className="it-assets-note">{shortDate(asset.warranty.startsOn)}</span>
                    <span className="it-assets-note">
                      {asset.warranty.daysLeft < 0 ? 'Ended' : 'Ends'} {shortDate(asset.warranty.endsOn)}
                    </span>
                  </div>
                  <span className="it-meter" aria-hidden>
                    <span style={{ width: `${asset.warranty.elapsedPercent ?? 100}%` }} />
                  </span>
                  <p className="it-assets-note" style={{ marginTop: 8 }}>
                    {asset.warranty.elapsedPercent !== null ? `${asset.warranty.elapsedPercent}% elapsed. ` : ''}
                    {asset.warranty.daysLeft < 0
                      ? 'Out of warranty: repairs are paid.'
                      : `${asset.warranty.daysLeft} day${asset.warranty.daysLeft === 1 ? '' : 's'} left.`}
                  </p>
                </>
              ) : (
                <p className="ess-empty">No warranty recorded.</p>
              )}
            </section>

            <section className="ess-panel it-label-card">
              <span className="it-label-tag" aria-hidden>
                {asset.assetTag}
              </span>
              <div>
                <strong>{asset.assetTag}</strong>
                <p className="it-assets-note">Print a label to stick on the asset, for audits and handovers.</p>
                <button
                  type="button"
                  className="ess-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    if (!printAssetLabels([asset])) setError('Your browser blocked the label window. Allow pop-ups for this site and try again.');
                  }}
                >
                  Print label
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'history' ? <AssetHistoryPanels id={id} embedded /> : null}

      {tab === 'maintenance' ? (
        <section className="ess-panel">
          <div className="ess-panel-head">
            <h2>Repairs</h2>
            {status === 'in_stock' ? (
              <Link className="ess-btn" to={`/it/maintenance?assetId=${id}`}>
                Raise repair
              </Link>
            ) : null}
          </div>
          {repairs === null ? <p className="ess-empty">Loading…</p> : null}
          {repairs?.length === 0 ? <p className="ess-empty">This asset has never been repaired.</p> : null}
          {repairs?.length ? (
            <div className="ess-table-wrap">
              <table className="ess-table">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Vendor</th>
                    <th>Started</th>
                    <th>Completed</th>
                    <th>Cost</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {repairs.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.issue}
                        {row.ticketReference ? <span className="it-sub">{row.ticketReference}</span> : null}
                      </td>
                      <td>{row.vendor || '—'}</td>
                      <td>{shortDate(row.startedOn)}</td>
                      <td>{row.completedOn ? shortDate(row.completedOn) : '—'}</td>
                      <td>{money(row.cost)}</td>
                      <td>
                        <StatusChip
                          status={row.status === 'open' ? 'pending' : 'approved'}
                          label={row.status === 'open' ? 'In repair' : titleCase(row.outcome ?? 'completed')}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'documents' ? (
        <section className="ess-panel">
          <h2>Documents</h2>
          {files.length === 0 && !hasPhoto ? (
            <p className="ess-empty">No signed forms, return photos or asset photo yet.</p>
          ) : null}
          {files.length ? (
            <div className="ess-table-wrap">
              <table className="ess-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Kind</th>
                    <th>Employee</th>
                    <th>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td>
                        <button type="button" className="it-assets-link" onClick={() => void openFile(file.allocation.id, file.id)}>
                          {file.fileName}
                        </button>
                      </td>
                      <td>{titleCase(file.kind)}</td>
                      <td>{file.allocation.employee.name}</td>
                      <td>{shortDate(file.uploadedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {hasPhoto && photoUrl ? (
            <div className="it-assets-photo">
              <h2>Asset photo</h2>
              <img src={photoUrl} alt={asset.name} />
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'financials' ? (
        <section className="ess-panel">
          <h2>Financials</h2>
          <dl className="it-assets-facts">
            <Fact label="Purchase cost" value={asset.cost === null ? null : money(asset.cost)} />
            <Fact label="Purchase date" value={asset.purchasedOn ? shortDate(asset.purchasedOn) : null} />
            <Fact label="Vendor" value={asset.vendor} />
            <Fact label="Depreciation method" value={asset.financials.method} />
            <Fact label="Useful life" value={years(asset.financials.lifeMonths)} />
            <Fact label="Months in use" value={asset.financials.monthsUsed} />
            <Fact label="Depreciation to date" value={asset.financials.depreciated === null ? null : money(asset.financials.depreciated)} />
            <Fact label="Book value" value={asset.financials.bookValue === null ? null : money(asset.financials.bookValue)} />
            <Fact label="Repairs" value={asset.financials.repairs} />
            <Fact label="Repair spend" value={money(asset.financials.repairCost)} />
            <Fact
              label="Total cost so far"
              value={asset.cost === null ? null : money(asset.cost + asset.financials.repairCost)}
            />
          </dl>
          <p className="it-assets-note">
            Useful life comes from the {asset.category.name} category. Change it under{' '}
            <Link to="/it/categories">Categories</Link>.
          </p>
        </section>
      ) : null}

      {changing ? (
        <EssModal
          title={`${changing === 'retired' ? 'Retire' : `Move to ${ASSET_STATUS_LABELS[changing]}:`} ${asset.assetTag}`}
          onClose={() => setChanging(null)}
          actions={
            <>
              <button type="button" className="ess-btn" onClick={() => setChanging(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`ess-btn ${changing === 'retired' ? 'ess-btn-danger' : 'ess-btn-primary'}`}
                disabled={busy || reason.trim().length < 3}
                onClick={() => void onChangeStatus()}
              >
                {busy ? 'Saving…' : changing === 'retired' ? 'Retire' : 'Change status'}
              </button>
            </>
          }
        >
          <div className="ess-field">
            <label htmlFor="status-reason">Reason (kept in the history)</label>
            <textarea id="status-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        </EssModal>
      ) : null}

      {confirming ? (
        <EssModal
          title={`Delete ${asset.assetTag}?`}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button type="button" className="ess-btn" onClick={() => setConfirming(false)}>
                Keep asset
              </button>
              <button type="button" className="ess-btn ess-btn-danger" disabled={busy} onClick={() => void onDelete()}>
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </>
          }
        >
          <p className="ess-muted">This asset has never been allocated, so it can be removed. This can't be undone.</p>
        </EssModal>
      ) : null}
    </div>
  );
}
