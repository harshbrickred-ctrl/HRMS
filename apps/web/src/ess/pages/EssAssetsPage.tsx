import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Laptop } from 'lucide-react';
import { EssModal } from '../components/EssModal';
import { StatusChip } from '../components/StatusChip';
import {
  REQUEST_STATUS_LABELS,
  acknowledgeAsset,
  acknowledgeHandover,
  assetMessage,
  cancelAssetRequest,
  createAssetRequest,
  decideMyAssetApproval,
  fetchAssetCategories,
  fetchMyAssetApprovals,
  fetchMyAssetRequests,
  fetchMyAssets,
  requestAssetReturn,
  requestChip,
  shortDate,
  type AssetCategory,
  type AssetRequest,
  type MyAssets,
} from '../../workspace/assetsApi';
import '../../workspace/it-assets.css';

type HeldAsset = MyAssets['assets'][number];

function nextStep(row: AssetRequest) {
  if (row.status === 'pending_manager') return `Next step: ${row.manager?.name ?? 'your manager'}`;
  if (row.status === 'pending_head') return `Next step: ${row.head?.name ?? 'your department head'}`;
  if (row.status === 'approved') return 'IT will issue it';
  if (row.status === 'fulfilled') return row.fulfilledAt ? `Issued ${shortDate(row.fulfilledAt)}` : 'Issued';
  return REQUEST_STATUS_LABELS[row.status];
}

export function EssAssetsPage() {
  const [mine, setMine] = useState<MyAssets>({ assets: [], handovers: [] });
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [approvals, setApprovals] = useState<AssetRequest[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [returning, setReturning] = useState<HeldAsset | null>(null);
  const [declining, setDeclining] = useState<AssetRequest | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    return Promise.all([fetchMyAssets(), fetchMyAssetRequests(), fetchMyAssetApprovals()]).then(
      ([assets, myRequests, myApprovals]) => {
        setMine(assets);
        setRequests(myRequests);
        setApprovals(myApprovals);
        setError(null);
      },
    );
  }

  useEffect(() => {
    load()
      .catch((err: unknown) => setError(assetMessage(err)))
      .finally(() => setReady(true));
    fetchAssetCategories()
      .then(setCategories)
      .catch((err: unknown) => setError(assetMessage(err)));
  }, []);

  async function act(action: () => Promise<unknown>, message?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load();
      if (message) setNotice(message);
      return true;
    } catch (err: unknown) {
      setError(assetMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const waiting = mine.assets.filter((asset) => asset.ackStatus === 'pending');
  const holding = mine.assets.filter((asset) => asset.ackStatus !== 'pending');
  const dueDates = waiting.map((asset) => asset.ackDueOn).filter((value): value is string => !!value).sort();

  return (
    <div className="ess-section-stack ess-assets">
      <header className="ess-leave-hero">
        <div className="ess-leave-hero-copy">
          <p className="ess-leave-kicker">
            <Laptop size={14} aria-hidden /> Company assets
          </p>
          <p className="ess-lead">What the company has issued to you. Accept new items, and tell IT about faults, losses or returns.</p>
        </div>
        <div className="ess-actions">
          <Link className="ess-btn" to="/ess/assets/reports">
            My reports
          </Link>
          <Link className="ess-btn" to="/ess/assets/history">
            My asset history
          </Link>
          <button type="button" className="ess-btn ess-btn-primary" onClick={() => setRequesting(true)}>
            Request an asset
          </button>
        </div>
      </header>

      {error ? <p className="ess-alert">{error}</p> : null}
      {notice ? <p className="it-assets-ok">{notice}</p> : null}

      {waiting.length ? (
        <p className="ess-asset-banner">
          <strong>
            {waiting.length} item{waiting.length === 1 ? ' is' : 's are'} waiting for you to accept {waiting.length === 1 ? 'it' : 'them'}.
          </strong>{' '}
          Please confirm{dueDates[0] ? ` by ${shortDate(dueDates[0])}` : ''}, or tell IT if something is wrong.
        </p>
      ) : null}

      {mine.handovers.length ? (
        <section className="ess-panel">
          <h2>Confirm handover</h2>
          <p className="ess-muted">These moved from you to a colleague. Confirm you handed them over.</p>
          <ul className="ess-asset-list">
            {mine.handovers.map((row) => (
              <li key={row.allocationId} className="ess-asset-row">
                <div>
                  <strong>{row.name}</strong>
                  <p>{row.assetTag}</p>
                </div>
                <button
                  type="button"
                  className="ess-btn ess-btn-primary"
                  disabled={busy}
                  onClick={() => void act(() => acknowledgeHandover(row.allocationId), 'Handover confirmed.')}
                >
                  I handed this over
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="ess-att-split">
        <div className="it-stack">
          {waiting.length ? (
            <section className="ess-panel">
              <h2>Waiting for you to accept</h2>
              <ul className="ess-asset-list">
                {waiting.map((asset) => (
                  <li key={asset.allocationId} className="ess-asset-row">
                    <div>
                      <Link to={`/ess/assets/${asset.allocationId}`}>
                        <strong>{asset.name}</strong>
                      </Link>
                      <p>
                        {asset.assetTag} · Issued {shortDate(asset.assignedOn)}
                        {asset.accessories ? ` · With ${asset.accessories}` : ''}
                        {asset.ackDueOn ? ` · Accept by ${shortDate(asset.ackDueOn)}` : ''}
                      </p>
                    </div>
                    <div className="ess-actions">
                      <Link className="ess-btn" to={`/ess/assets/${asset.allocationId}/fault`}>
                        Report a problem
                      </Link>
                      <button
                        type="button"
                        className="ess-btn ess-btn-primary"
                        disabled={busy}
                        onClick={() => void act(() => acknowledgeAsset(asset.allocationId), `${asset.name} accepted.`)}
                      >
                        Accept
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="ess-panel">
            <h2>Assets I hold</h2>
            {ready && holding.length === 0 ? (
              <p className="ess-empty">{waiting.length ? 'Accept the items above to see them here.' : 'Nothing is allocated to you right now.'}</p>
            ) : null}
            <ul className="ess-asset-list">
              {holding.map((asset) => (
                <li key={asset.allocationId} className="ess-asset-card">
                  <div className="it-pick-head">
                    <div>
                      <Link to={`/ess/assets/${asset.allocationId}`}>
                        <strong>{asset.name}</strong>
                      </Link>
                      <p>
                        {asset.assetTag} · Issued {shortDate(asset.assignedOn)}
                        {asset.warrantyExpiry ? ` · Warranty until ${shortDate(asset.warrantyExpiry)}` : ''}
                      </p>
                    </div>
                    {asset.ackStatus === 'acknowledged' ? (
                      <StatusChip status="approved" label={asset.ackAt ? `Accepted ${shortDate(asset.ackAt)}` : 'Accepted'} />
                    ) : (
                      <StatusChip status="withdrawn" label="Not recorded" />
                    )}
                  </div>
                  <div className="ess-actions">
                    <Link className="ess-btn" to={`/ess/assets/${asset.allocationId}/fault`}>
                      Report a fault
                    </Link>
                    <Link className="ess-btn" to={`/ess/assets/${asset.allocationId}/lost`}>
                      Report lost or stolen
                    </Link>
                    {asset.returnRequested ? (
                      <StatusChip status="pending" label="Return requested" />
                    ) : (
                      <button type="button" className="ess-btn" onClick={() => setReturning(asset)}>
                        Request return
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {approvals.length ? (
            <section className="ess-panel">
              <h2>Requests to approve</h2>
              <ul className="ess-list">
                {approvals.map((row) => (
                  <li key={row.id} className="ess-list-item">
                    <div className="ess-leave-request-head">
                      <strong>
                        {row.reference} · {row.employee.name} needs: {row.category.name}
                      </strong>
                    </div>
                    <span className="ess-muted">{row.reason}</span>
                    <div className="ess-actions">
                      <button
                        type="button"
                        className="ess-btn ess-btn-primary"
                        disabled={busy}
                        onClick={() => void act(() => decideMyAssetApproval(row.id, true), `${row.reference} approved.`)}
                      >
                        Approve
                      </button>
                      <button type="button" className="ess-btn ess-btn-danger" onClick={() => setDeclining(row)}>
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="it-stack">
          <section className="ess-panel">
            <h2>My requests</h2>
            {requests.length === 0 ? <p className="ess-empty">No asset requests yet.</p> : null}
            <ul className="ess-list">
              {requests.map((row) => (
                <li key={row.id} className="ess-list-item">
                  <div className="ess-leave-request-head">
                    <strong>{row.category.name}</strong>
                    <StatusChip status={requestChip(row.status)} label={REQUEST_STATUS_LABELS[row.status]} />
                  </div>
                  <span className="ess-muted">
                    {row.reference} · Requested {shortDate(row.createdAt)} · {nextStep(row)}
                  </span>
                  {row.decisions
                    .filter((decision) => decision.note)
                    .map((decision) => (
                      <span key={decision.decidedAt} className="ess-muted">
                        {decision.note}
                      </span>
                    ))}
                  {row.status === 'pending_manager' || row.status === 'pending_head' || row.status === 'approved' ? (
                    <div className="ess-actions">
                      <button
                        type="button"
                        className="ess-btn ess-btn-ghost"
                        disabled={busy}
                        onClick={() => void act(() => cancelAssetRequest(row.id), `${row.reference} cancelled.`)}
                      >
                        Cancel request
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="ess-panel">
            <h2>Good to know</h2>
            <p className="ess-muted" style={{ margin: 0 }}>
              Report lost or stolen items at once. The report goes straight to IT, who review it and protect company data. You can follow every
              step under My reports.
            </p>
          </section>
        </div>
      </div>

      {requesting ? (
        <RequestModal
          categories={categories}
          busy={busy}
          onClose={() => setRequesting(false)}
          onSubmit={(categoryId, reason) =>
            act(() => createAssetRequest({ categoryId, reason }), 'Request sent. Your manager has been asked to approve it.').then((ok) => {
              if (ok) setRequesting(false);
            })
          }
        />
      ) : null}

      {returning ? (
        <TextModal
          title={`Return ${returning.name}`}
          label="Why are you returning it?"
          confirm="Send to IT"
          busy={busy}
          onClose={() => setReturning(null)}
          onSubmit={(reason) =>
            act(() => requestAssetReturn(returning.allocationId, reason), 'IT has your return request and will arrange collection.').then(
              (ok) => {
                if (ok) setReturning(null);
              },
            )
          }
        />
      ) : null}

      {declining ? (
        <TextModal
          title={`Decline ${declining.reference}`}
          label="Reason"
          confirm="Decline"
          danger
          busy={busy}
          onClose={() => setDeclining(null)}
          onSubmit={(note) =>
            act(() => decideMyAssetApproval(declining.id, false, note), `${declining.reference} declined.`).then((ok) => {
              if (ok) setDeclining(null);
            })
          }
        />
      ) : null}
    </div>
  );
}

function RequestModal({
  categories,
  busy,
  onClose,
  onSubmit,
}: {
  categories: AssetCategory[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (categoryId: string, reason: string) => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [reason, setReason] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(categoryId, reason);
  }

  return (
    <EssModal
      title="Request an asset"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="asset-request-form" className="ess-btn ess-btn-primary" disabled={busy || !categoryId || reason.trim().length < 3}>
            Send request
          </button>
        </>
      }
    >
      <form id="asset-request-form" className="ess-form" onSubmit={submit}>
        <div className="ess-field">
          <label htmlFor="asset-category">What do you need?</label>
          <select id="asset-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ess-field">
          <label htmlFor="asset-reason">Why do you need it?</label>
          <textarea id="asset-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} required />
        </div>
        <p className="ess-muted">Your manager and department head approve it, then IT issues it to you.</p>
      </form>
    </EssModal>
  );
}

function TextModal({
  title,
  label,
  confirm,
  danger,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  confirm: string;
  danger?: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <EssModal
      title={title}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`ess-btn ${danger ? 'ess-btn-danger' : 'ess-btn-primary'}`}
            disabled={busy || text.trim().length < 3}
            onClick={() => onSubmit(text.trim())}
          >
            {confirm}
          </button>
        </>
      }
    >
      <div className="ess-field">
        <label htmlFor="asset-text">{label}</label>
        <textarea id="asset-text" rows={3} value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} />
      </div>
    </EssModal>
  );
}
