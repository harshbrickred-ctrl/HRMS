import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatusChip } from '../ess/components/StatusChip';
import {
  ACK_LABELS,
  ASSET_STATUS_LABELS,
  assetMessage,
  fetchAllocationFile,
  fetchAsset,
  fetchAssetAllocations,
  fetchAssetHistory,
  fetchAssetStatusHistory,
  openBlob,
  titleCase,
  uploadSignedForm,
  type AssetAllocation,
  type AssetDetail,
  type AssetHistoryEvent,
  type AssetStatusChange,
} from './assetsApi';
import './it-assets.css';

export function ItAssetHistoryPage() {
  const { id = '' } = useParams();
  return <AssetHistoryPanels id={id} />;
}

/** Timeline, allocations (with signed forms) and status history. Also the History tab on the asset page. */
export function AssetHistoryPanels({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [events, setEvents] = useState<AssetHistoryEvent[]>([]);
  const [statuses, setStatuses] = useState<AssetStatusChange[]>([]);
  const [allocations, setAllocations] = useState<AssetAllocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    return Promise.all([
      fetchAsset(id),
      fetchAssetHistory(id),
      fetchAssetStatusHistory(id),
      fetchAssetAllocations(id),
    ]).then(([nextAsset, nextEvents, nextStatuses, nextAllocations]) => {
      setAsset(nextAsset);
      setEvents(nextEvents);
      setStatuses(nextStatuses);
      setAllocations(nextAllocations);
    });
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(assetMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onForm(row: AssetAllocation, kind: 'signed_ack' | 'handover_ack', file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await uploadSignedForm(row.id, kind, file);
      setNotice('Signed form recorded.');
      await load();
    } catch (err: unknown) {
      setError(assetMessage(err));
    }
  }

  async function openFile(row: AssetAllocation, fileId: string) {
    try {
      openBlob(await fetchAllocationFile(row.id, fileId));
    } catch (err: unknown) {
      setError(assetMessage(err));
    }
  }

  function formUpload(row: AssetAllocation, kind: 'signed_ack' | 'handover_ack') {
    return (
      <label className="it-assets-upload">
        Upload signed form
        <input
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => void onForm(row, kind, event.target.files?.[0])}
        />
      </label>
    );
  }

  return (
    <div className="it-assets">
      {embedded ? null : (
        <Link className="it-assets-back" to={`/it/assets/${id}`}>
          ← {asset?.assetTag ?? 'Asset'}
        </Link>
      )}
      {error ? <p className="ess-alert">{error}</p> : null}
      {notice ? <p className="it-assets-ok">{notice}</p> : null}
      {!asset ? (
        error ? null : (
          <p className="ess-empty">Loading…</p>
        )
      ) : (
        <>
          {embedded ? null : (
            <p className="it-assets-note">
              {asset.assetTag} · {asset.name}
            </p>
          )}

          <section className="ess-panel">
            <h2>Timeline</h2>
            <ol className="it-assets-timeline">
              {events.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <strong>{event.title}</strong>
                  {event.detail ? <p>{event.detail}</p> : null}
                  <span className="it-assets-note">
                    {event.at.slice(0, 10)}
                    {event.by ? ` · ${event.by}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="ess-panel">
            <h2>Allocations</h2>
            {allocations.length === 0 ? <p className="ess-empty">Never allocated.</p> : null}
            <div className="ess-table-wrap">
              <table className="ess-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Issued</th>
                    <th>Returned</th>
                    <th>Condition</th>
                    <th>Receipt</th>
                    <th>Handover</th>
                    <th>Files</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={`/it/employee-assets?employee=${row.employee.id}`}>{row.employee.name}</Link>
                      </td>
                      <td>{row.assignedOn}</td>
                      <td>
                        {row.returnedOn ? `${row.returnedOn} · ${titleCase(row.endReason ?? 'returned')}` : 'Current'}
                      </td>
                      <td>
                        {row.issueCondition ? titleCase(row.issueCondition) : '—'}
                        {row.returnCondition ? ` → ${titleCase(row.returnCondition)}` : ''}
                      </td>
                      <td>
                        <StatusChip
                          status={row.ackStatus === 'acknowledged' ? 'approved' : row.ackStatus === 'pending' ? 'pending' : 'withdrawn'}
                          label={ACK_LABELS[row.ackStatus]}
                        />
                        {row.ackStatus === 'pending' && !row.returnedOn ? formUpload(row, 'signed_ack') : null}
                      </td>
                      <td>
                        {row.handoverAckStatus ? (
                          <>
                            <StatusChip
                              status={row.handoverAckStatus === 'acknowledged' ? 'approved' : 'pending'}
                              label={ACK_LABELS[row.handoverAckStatus]}
                            />
                            {row.handoverAckStatus === 'pending' ? formUpload(row, 'handover_ack') : null}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {row.files.length === 0 ? '—' : null}
                        {row.files.map((file) => (
                          <button
                            key={file.id}
                            type="button"
                            className="it-assets-link"
                            onClick={() => void openFile(row, file.id)}
                          >
                            {file.fileName}
                          </button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ess-panel">
            <h2>Status history</h2>
            {statuses.length === 0 ? <p className="ess-empty">No status changes yet.</p> : null}
            <div className="ess-table-wrap">
              <table className="ess-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Reason</th>
                    <th>Changed by</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((row) => (
                    <tr key={row.id}>
                      <td>{row.changedAt.slice(0, 10)}</td>
                      <td>{ASSET_STATUS_LABELS[row.fromStatus]}</td>
                      <td>{ASSET_STATUS_LABELS[row.toStatus]}</td>
                      <td>{row.reason}</td>
                      <td>{row.changedBy ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
