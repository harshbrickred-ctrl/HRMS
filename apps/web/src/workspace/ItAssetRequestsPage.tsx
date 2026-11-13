import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EssModal } from '../ess/components/EssModal';
import { StatusChip } from '../ess/components/StatusChip';
import {
  ISSUE_CONDITIONS,
  REQUEST_STATUS_LABELS,
  askAboutAssetRequest,
  assetMessage,
  changeAssetStatus,
  decideAssetRequest,
  fetchAsset,
  fetchAssetRequests,
  fetchAssetTickets,
  fetchAssets,
  fetchPendingHandovers,
  fulfilAssetRequest,
  requestChip,
  rupees,
  shortDate,
  todayIso,
  updateAssetTicket,
  type AssetRecord,
  type AssetRequestRow,
  type AssetTicket,
  type PendingHandover,
} from './assetsApi';
import './it-assets.css';

const TABS = [
  { value: 'requests', label: 'Asset requests' },
  { value: 'returns', label: 'Returns' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'writeoffs', label: 'Write-offs' },
  { value: 'lost', label: 'Lost or stolen' },
] as const;

type Tab = (typeof TABS)[number]['value'];
type StepState = 'ok' | 'waiting' | 'later' | 'no';

const OPEN = ['pending_manager', 'pending_head', 'approved'];
const isOpenTicket = (ticket: AssetTicket) => ticket.status === 'Open' || ticket.status === 'InProgress';

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}

function WaitingChip({ since }: { since: string }) {
  const days = daysSince(since);
  return <StatusChip status={days > 5 ? 'rejected' : days > 2 ? 'pending' : 'withdrawn'} label={`${days} day${days === 1 ? '' : 's'}`} />;
}

const STEP_CHIP: Record<StepState, string> = { ok: 'approved', waiting: 'pending', later: 'withdrawn', no: 'rejected' };

type ChainStep = { key: string; label: string; who: string | null; state: StepState; at: string | null; byDesk: boolean };

/**
 * Manager, then department head, then IT issues it. Steps nobody holds are left out. When the asset
 * desk decided in place of a missing or inactive approver, that decision fills the step it covered.
 */
function chain(row: AssetRequestRow) {
  const decision = (step: string) => row.decisions.find((item) => item.step === step);
  const admin = decision('admin');
  let deskUsed = false;
  const approvers = [
    ...(row.manager ? [{ key: 'manager', label: 'Manager', who: row.manager.name, waiting: 'pending_manager' }] : []),
    ...(row.head ? [{ key: 'head', label: 'Dept head', who: row.head.name, waiting: 'pending_head' }] : []),
  ];
  if (!approvers.length) approvers.push({ key: 'desk', label: 'Asset desk', who: '', waiting: 'pending_head' });
  const steps: ChainStep[] = approvers.map((step) => {
    const base = { key: step.key, label: step.label, who: step.who || null, byDesk: false };
    const own = decision(step.key);
    if (own) return { ...base, state: own.approved ? 'ok' : 'no', at: own.decidedAt };
    if (row.status === step.waiting) return { ...base, state: 'waiting', at: null };
    if (admin && !deskUsed && row.status !== 'pending_manager') {
      deskUsed = true;
      return { ...base, state: admin.approved ? 'ok' : 'no', at: admin.decidedAt, byDesk: true };
    }
    return { ...base, state: 'later', at: null };
  });
  steps.push({
    byDesk: false,
    key: 'issue',
    label: 'IT issues',
    who: null,
    state: row.status === 'fulfilled' ? 'ok' : row.status === 'approved' ? 'waiting' : row.status === 'rejected' || row.status === 'cancelled' ? 'no' : 'later',
    at: row.fulfilledAt,
  });
  return steps;
}

export function ItAssetRequestsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((item) => item.value === params.get('tab')) ? params.get('tab') : 'requests') as Tab;
  const [requests, setRequests] = useState<AssetRequestRow[]>([]);
  const [tickets, setTickets] = useState<AssetTicket[]>([]);
  const [handovers, setHandovers] = useState<PendingHandover[]>([]);
  const [lostAssets, setLostAssets] = useState<AssetRecord[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issuing, setIssuing] = useState<AssetRequestRow | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    return Promise.all([fetchAssetRequests(), fetchAssetTickets(), fetchPendingHandovers(), fetchAssets({ status: 'lost' })]).then(
      ([nextRequests, nextTickets, nextHandovers, nextLost]) => {
        setRequests(nextRequests);
        setTickets(nextTickets);
        setHandovers(nextHandovers);
        setLostAssets(nextLost);
        setError(null);
      },
    );
  }

  useEffect(() => {
    load()
      .catch((err: unknown) => setError(assetMessage(err)))
      .finally(() => setReady(true));
  }, []);

  // A notification link (/it/requests?request=<id>) opens that request.
  const linkedRequest = params.get('request');
  useEffect(() => {
    if (linkedRequest) setSelectedId(linkedRequest);
  }, [linkedRequest]);

  async function act(message: string, action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      setNotice(message);
      setPrompt(null);
      await load();
    } catch (err: unknown) {
      setPrompt(null);
      setError(assetMessage(err));
    }
  }

  const returns = tickets.filter((ticket) => ticket.type === 'Request' && ticket.category === 'return' && isOpenTicket(ticket));
  const losses = tickets.filter((ticket) => ticket.type === 'Loss' && isOpenTicket(ticket));
  const openRequests = requests.filter((row) => OPEN.includes(row.status));
  const shownRequests = useMemo(
    () =>
      (showClosed ? requests : openRequests).filter((row) => !mineOnly || row.needsAdmin || row.status === 'approved'),
    [requests, openRequests, showClosed, mineOnly],
  );
  const selected = shownRequests.find((row) => row.id === selectedId) ?? shownRequests[0] ?? null;
  const counts: Record<Tab, number> = {
    requests: openRequests.length,
    returns: returns.length,
    transfers: handovers.length,
    writeoffs: lostAssets.length,
    lost: losses.length,
  };

  function showTab(next: Tab) {
    const query = new URLSearchParams(params);
    if (next === 'requests') query.delete('tab');
    else query.set('tab', next);
    setParams(query, { replace: true });
    setNotice(null);
  }

  return (
    <div className="it-assets">
      <div className="it-head">
        <div className="ess-tabs" role="tablist" style={{ marginBottom: 0 }}>
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              className={`ess-tab${tab === item.value ? ' is-active' : ''}`}
              onClick={() => showTab(item.value)}
            >
              {item.label} {ready ? counts[item.value] : ''}
            </button>
          ))}
        </div>
        {tab === 'requests' ? (
          <div className="it-checks">
            <label>
              <input type="checkbox" checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} />
              Show only items waiting on me
            </label>
            <label>
              <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />
              Include decided requests
            </label>
          </div>
        ) : null}
      </div>
      {error ? <p className="ess-alert">{error}</p> : null}
      {notice ? <p className="it-assets-ok">{notice}</p> : null}
      {!ready ? <p className="ess-empty">Loading…</p> : null}

      {ready && tab === 'requests' ? (
        <div className="it-split">
          <section className="ess-panel">
            <div className="ess-table-wrap">
              <table className="ess-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Requester</th>
                    <th>Item</th>
                    <th>Value</th>
                    <th>Waiting</th>
                    <th>Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRequests.map((row) => (
                    <tr
                      key={row.id}
                      className={`is-clickable${selected?.id === row.id ? ' is-selected' : ''}`}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td>
                        <button type="button" className="it-linkbtn" onClick={() => setSelectedId(row.id)}>
                          {row.reference}
                        </button>
                        <span className="it-sub">{row.alreadyHolds ? 'Already holds one' : 'New asset'}</span>
                      </td>
                      <td>
                        {row.employee.name}
                        <span className="it-sub">{row.employee.department ?? row.employee.employeeCode}</span>
                      </td>
                      <td>
                        {row.category.name}
                        <span className="it-sub">{row.stock.total ? `${row.stock.total} in stock` : 'None in stock'}</span>
                      </td>
                      <td>{rupees(row.estimatedValue)}</td>
                      <td>{OPEN.includes(row.status) ? <WaitingChip since={row.waitingSince} /> : '—'}</td>
                      <td>
                        {OPEN.includes(row.status) ? (
                          <span className="it-chain">
                            {chain(row).map((step) => (
                              <StatusChip key={step.key} status={STEP_CHIP[step.state]} label={step.label} />
                            ))}
                          </span>
                        ) : (
                          <StatusChip status={requestChip(row.status)} label={REQUEST_STATUS_LABELS[row.status]} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shownRequests.length === 0 ? (
                <p className="ess-empty">{mineOnly ? 'Nothing is waiting on you.' : 'No open requests.'}</p>
              ) : null}
            </div>
            <p className="it-assets-note" style={{ marginTop: 8 }}>
              Showing {shownRequests.length} of {showClosed ? requests.length : openRequests.length} requests. Green is approved, amber is
              waiting, grey is later in the chain.
            </p>
          </section>

          {selected ? (
            <RequestPanel
              row={selected}
              onApprove={() => void act(`${selected.reference} approved.`, () => decideAssetRequest(selected.id, true))}
              onReject={() =>
                setPrompt({
                  title: `Decline ${selected.reference}`,
                  label: 'Reason (sent to the employee)',
                  confirm: 'Decline',
                  danger: true,
                  run: (reason) => act(`${selected.reference} declined.`, () => decideAssetRequest(selected.id, false, reason)),
                })
              }
              onAsk={() =>
                setPrompt({
                  title: `Ask ${selected.employee.name} about ${selected.reference}`,
                  label: 'Your question (sent as a notification)',
                  confirm: 'Send question',
                  run: (question) => act('Question sent.', () => askAboutAssetRequest(selected.id, question)),
                })
              }
              onIssue={() => setIssuing(selected)}
            />
          ) : null}
        </div>
      ) : null}

      {ready && tab === 'returns' ? (
        <section className="ess-panel">
          <p className="it-assets-note">Employees asking IT to take an asset back. Booking the return records its condition and closes the request.</p>
          <TicketTable
            rows={returns}
            empty="No return requests."
            detail={(ticket) => ticket.body}
            actions={(ticket) => (
              <>
                {ticket.asset ? (
                  <Link className="ess-btn ess-btn-primary" to={`/it/return?assetId=${ticket.asset.id}`}>
                    Book return
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="ess-btn"
                  onClick={() =>
                    setPrompt({
                      title: `Decline ${ticket.reference}`,
                      label: 'Reason (sent to the employee)',
                      confirm: 'Decline',
                      danger: true,
                      run: (reason) => act(`${ticket.reference} declined.`, () => updateAssetTicket(ticket.id, 'Closed', reason)),
                    })
                  }
                >
                  Decline
                </button>
              </>
            )}
          />
        </section>
      ) : null}

      {ready && tab === 'transfers' ? (
        <section className="ess-panel">
          <p className="it-assets-note">
            Transfers waiting for the previous holder to confirm the handover. They confirm in the portal, or you upload their signed form from the
            asset's history.
          </p>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Transferred</th>
                  <th>Reason</th>
                  <th>Value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {handovers.map((row) => (
                  <tr key={row.allocationId}>
                    <td>
                      <Link to={`/it/assets/${row.asset.id}`}>{row.asset.assetTag}</Link>
                      <span className="it-sub">{row.asset.name}</span>
                    </td>
                    <td>
                      {row.from.name}
                      <span className="it-sub">{row.from.department ?? row.from.employeeCode}</span>
                    </td>
                    <td>{row.to?.name ?? '—'}</td>
                    <td>
                      {shortDate(row.transferredOn)}
                      {row.transferredOn ? <span className="it-sub">{daysSince(row.transferredOn)} days waiting</span> : null}
                    </td>
                    <td>{row.reason || '—'}</td>
                    <td>{rupees(row.cost)}</td>
                    <td>
                      <Link className="ess-btn" to={`/it/assets/${row.asset.id}?tab=history`}>
                        Upload signed form
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {handovers.length === 0 ? <p className="ess-empty">No transfers are waiting.</p> : null}
          </div>
        </section>
      ) : null}

      {ready && tab === 'writeoffs' ? (
        <section className="ess-panel">
          <p className="it-assets-note">Assets marked lost. Write them off to take them off the books, or bring them back to stock if they turn up.</p>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Cost</th>
                  <th>Book value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lostAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <Link to={`/it/assets/${asset.id}`}>{asset.assetTag}</Link>
                      <span className="it-sub">{asset.name}</span>
                    </td>
                    <td>{asset.category.name}</td>
                    <td>{asset.location?.name ?? '—'}</td>
                    <td>{rupees(asset.cost)}</td>
                    <td>{rupees(asset.bookValue)}</td>
                    <td>
                      <div className="ess-actions">
                        <button
                          type="button"
                          className="ess-btn ess-btn-danger"
                          onClick={() =>
                            setPrompt({
                              title: `Write off ${asset.assetTag}`,
                              label: 'Reason (kept in the history)',
                              confirm: 'Write off',
                              danger: true,
                              run: (reason) => act(`${asset.assetTag} written off.`, () => changeAssetStatus(asset.id, 'written_off', reason)),
                            })
                          }
                        >
                          Write off
                        </button>
                        <button
                          type="button"
                          className="ess-btn"
                          onClick={() =>
                            setPrompt({
                              title: `${asset.assetTag} was found`,
                              label: 'Where was it found?',
                              confirm: 'Back to stock',
                              run: (reason) => act(`${asset.assetTag} is back in stock.`, () => changeAssetStatus(asset.id, 'in_stock', reason)),
                            })
                          }
                        >
                          Found
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lostAssets.length === 0 ? <p className="ess-empty">No lost assets.</p> : null}
          </div>
        </section>
      ) : null}

      {ready && tab === 'lost' ? (
        <section className="ess-panel">
          <p className="it-assets-note">Reports from employees. Confirming a loss marks the asset Lost and closes the report.</p>
          <TicketTable
            rows={losses}
            empty="No open loss reports."
            detail={(ticket) =>
              `${ticket.category === 'stolen' ? 'Stolen' : 'Lost'} ${shortDate(ticket.lostOn)}${ticket.lostLocation ? ` at ${ticket.lostLocation}` : ''}. ${ticket.body}`
            }
            actions={(ticket) => (
              <>
                <button
                  type="button"
                  className="ess-btn ess-btn-primary"
                  onClick={() =>
                    setPrompt({
                      title: `Confirm loss: ${ticket.reference}`,
                      label: 'Note (kept in the history and sent to the employee)',
                      confirm: 'Confirm loss',
                      danger: true,
                      run: (reason) =>
                        act(`${ticket.reference} confirmed. The asset is marked Lost.`, async () => {
                          if (ticket.asset) {
                            const asset = await fetchAsset(ticket.asset.id);
                            if (asset.status !== 'lost') await changeAssetStatus(asset.id, 'lost', reason);
                          }
                          await updateAssetTicket(ticket.id, 'Resolved', reason);
                        }),
                    })
                  }
                >
                  Confirm loss
                </button>
                <button
                  type="button"
                  className="ess-btn"
                  onClick={() =>
                    setPrompt({
                      title: `Close ${ticket.reference} without marking lost`,
                      label: 'Reason (sent to the employee)',
                      confirm: 'Close report',
                      run: (reason) => act(`${ticket.reference} closed.`, () => updateAssetTicket(ticket.id, 'Closed', reason)),
                    })
                  }
                >
                  Not lost
                </button>
              </>
            )}
          />
        </section>
      ) : null}

      {issuing ? (
        <IssueModal
          request={issuing}
          onClose={() => setIssuing(null)}
          onDone={() => {
            setNotice(`${issuing.reference} issued to ${issuing.employee.name}.`);
            setIssuing(null);
            void load();
          }}
        />
      ) : null}
      {prompt ? <ReasonModal prompt={prompt} onClose={() => setPrompt(null)} /> : null}
    </div>
  );
}

function RequestPanel({
  row,
  onApprove,
  onReject,
  onAsk,
  onIssue,
}: {
  row: AssetRequestRow;
  onApprove: () => void;
  onReject: () => void;
  onAsk: () => void;
  onIssue: () => void;
}) {
  const steps = chain(row);
  const waitingOn = steps.find((step) => step.state === 'waiting' && step.who);
  const open = OPEN.includes(row.status);
  return (
    <section className="ess-panel it-panel-sticky it-stack" style={{ gap: 12 }}>
      <div>
        <p className="ess-muted">Selected request</p>
        <h2 style={{ marginBottom: 2 }}>
          {row.reference} · {row.category.name}
        </h2>
        <span className="it-sub">{[row.employee.name, row.employee.department, row.location].filter(Boolean).join(' · ')}</span>
      </div>
      {row.alreadyHolds ? (
        <p className="it-callout">
          <strong>Already holds {row.alreadyHolds}.</strong> {row.employee.name} has {row.alreadyHolds} {row.category.name.toLowerCase()}
          {row.alreadyHolds === 1 ? '' : 's'} today. Check this is a replacement or a genuine second one.
        </p>
      ) : null}
      <dl className="it-facts-2">
        <div>
          <dt>Item</dt>
          <dd>{row.category.name}</dd>
        </div>
        <div>
          <dt>Typical value</dt>
          <dd>{rupees(row.estimatedValue)}</dd>
        </div>
        <div>
          <dt>Stock</dt>
          <dd>
            {row.stock.total
              ? `${row.stock.atLocation} at ${row.location ?? 'their location'}, ${row.stock.total} in total`
              : 'None in stock'}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{REQUEST_STATUS_LABELS[row.status]}</dd>
        </div>
      </dl>
      <div>
        <p className="ess-muted">Reason given</p>
        <p style={{ margin: '4px 0 0', fontSize: 13 }}>{row.reason}</p>
      </div>
      <ol className="it-steps-list">
        <li>
          <span className="it-dot is-ok" aria-hidden />
          <span>
            <strong>{row.employee.name}</strong> requested on {shortDate(row.createdAt)}
          </span>
        </li>
        {steps.map((step) => (
          <li key={step.key}>
            <span className={`it-dot is-${step.state}`} aria-hidden />
            <span>
              <strong>{step.who ? `${step.who}, ${step.label.toLowerCase()}` : step.label}</strong>{' '}
              {step.state === 'ok'
                ? `approved${step.byDesk ? ' by the asset desk' : ''}${step.at ? ` on ${shortDate(step.at)}` : ''}`
                : step.state === 'no'
                  ? `declined${step.byDesk ? ' by the asset desk' : ''}${step.at ? ` on ${shortDate(step.at)}` : ''}`
                  : step.state === 'waiting'
                    ? `waiting since ${shortDate(row.waitingSince)}`
                    : 'later in the chain'}
            </span>
          </li>
        ))}
        {row.decisions
          .filter((decision) => decision.note)
          .map((decision) => (
            <li key={decision.decidedAt}>
              <span className="it-dot" aria-hidden />
              <span className="it-sub" style={{ display: 'inline' }}>
                Note from {decision.step}: {decision.note}
              </span>
            </li>
          ))}
      </ol>
      {open && !row.needsAdmin && row.status !== 'approved' ? (
        <p className="it-assets-note">
          Waiting on {waitingOn?.who ?? 'the approver'}. You can decide it yourself only if their login is missing or inactive.
        </p>
      ) : null}
      {open ? (
        <div className="ess-actions">
          {row.status === 'approved' ? (
            <button type="button" className="ess-btn ess-btn-primary" onClick={onIssue}>
              Issue asset
            </button>
          ) : (
            <>
              <button type="button" className="ess-btn ess-btn-danger" disabled={!row.needsAdmin} onClick={onReject}>
                Reject
              </button>
              <button type="button" className="ess-btn" onClick={onAsk}>
                Ask a question
              </button>
              <button type="button" className="ess-btn ess-btn-primary" disabled={!row.needsAdmin} onClick={onApprove}>
                Approve
              </button>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function TicketTable({
  rows,
  empty,
  detail,
  actions,
}: {
  rows: AssetTicket[];
  empty: string;
  detail: (ticket: AssetTicket) => string;
  actions: (ticket: AssetTicket) => ReactNode;
}) {
  return (
    <div className="ess-table-wrap">
      <table className="ess-table">
        <thead>
          <tr>
            <th>Report</th>
            <th>Employee</th>
            <th>Asset</th>
            <th>Details</th>
            <th>Waiting</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <Link to="/it/tickets">{ticket.reference}</Link>
                <span className="it-sub">{shortDate(ticket.createdAt)}</span>
              </td>
              <td>{ticket.person?.name ?? '—'}</td>
              <td>
                {ticket.asset ? <Link to={`/it/assets/${ticket.asset.id}`}>{ticket.asset.assetTag}</Link> : '—'}
                {ticket.asset ? <span className="it-sub">{ticket.asset.name}</span> : null}
              </td>
              <td>{detail(ticket)}</td>
              <td>
                <WaitingChip since={ticket.createdAt} />
              </td>
              <td>
                <div className="ess-actions">{actions(ticket)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="ess-empty">{empty}</p> : null}
    </div>
  );
}

type Prompt = {
  title: string;
  label: string;
  confirm: string;
  danger?: boolean;
  run: (text: string) => Promise<void>;
};

function ReasonModal({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <EssModal
      title={prompt.title}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`ess-btn ${prompt.danger ? 'ess-btn-danger' : 'ess-btn-primary'}`}
            disabled={busy || text.trim().length < 3}
            onClick={() => {
              setBusy(true);
              void prompt.run(text.trim()).finally(() => setBusy(false));
            }}
          >
            {busy ? 'Saving…' : prompt.confirm}
          </button>
        </>
      }
    >
      <div className="ess-field">
        <label htmlFor="prompt-text">{prompt.label}</label>
        <textarea id="prompt-text" rows={3} value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} />
      </div>
    </EssModal>
  );
}

function IssueModal({
  request,
  onClose,
  onDone,
}: {
  request: AssetRequestRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [stock, setStock] = useState<AssetRecord[]>([]);
  const [assetId, setAssetId] = useState('');
  const [condition, setCondition] = useState('good');
  const [issuedOn, setIssuedOn] = useState(todayIso());
  const [accessories, setAccessories] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets({ status: 'in_stock', categoryId: request.category.id })
      .then((rows) => {
        setStock(rows);
        setAssetId(rows[0]?.id ?? '');
      })
      .catch((err: unknown) => setError(assetMessage(err)));
  }, [request.category.id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fulfilAssetRequest(request.id, {
        assetId,
        issuedOn,
        condition,
        accessories,
        notes: request.reference,
        ackWithinDays: 3,
        notifyManager: true,
      });
      onDone();
    } catch (err: unknown) {
      setError(assetMessage(err));
      setBusy(false);
    }
  }

  return (
    <EssModal
      title={`Issue ${request.category.name} to ${request.employee.name}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="asset-issue-form" className="ess-btn ess-btn-primary" disabled={busy || !assetId}>
            {busy ? 'Issuing…' : 'Issue'}
          </button>
        </>
      }
    >
      <form id="asset-issue-form" className="it-assets-modal-form" onSubmit={(event) => void onSubmit(event)}>
        {error ? <p className="ess-alert">{error}</p> : null}
        {stock.length === 0 ? <p className="ess-empty">No {request.category.name} is in stock.</p> : null}
        <div className="ess-field">
          <label htmlFor="issue-asset">Asset</label>
          <select id="issue-asset" value={assetId} onChange={(event) => setAssetId(event.target.value)} required>
            {stock.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.assetTag} · {asset.name}
                {asset.location ? ` · ${asset.location.name}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="ess-field">
          <label htmlFor="issue-date">Issue date</label>
          <input
            id="issue-date"
            type="date"
            max={todayIso()}
            value={issuedOn}
            onChange={(event) => setIssuedOn(event.target.value)}
            required
          />
        </div>
        <div className="ess-field">
          <label htmlFor="issue-condition">Condition</label>
          <select id="issue-condition" value={condition} onChange={(event) => setCondition(event.target.value)}>
            {ISSUE_CONDITIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ess-field">
          <label htmlFor="issue-accessories">Accessories</label>
          <input
            id="issue-accessories"
            value={accessories}
            onChange={(event) => setAccessories(event.target.value)}
            maxLength={500}
          />
        </div>
        <p className="it-assets-note">The employee is asked to accept within 3 working days, and their manager is told.</p>
      </form>
    </EssModal>
  );
}
