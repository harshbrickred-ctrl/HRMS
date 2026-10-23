import { useEffect, useState, type FormEvent } from 'react';
import { Laptop } from 'lucide-react';
import { StatusChip } from '../components/StatusChip';
import {
  ASSET_CATEGORIES,
  categoryLabel,
  createAssetTicket,
  fetchMyAssetTickets,
  fetchMyAssets,
  type AssetTicket,
  type MyAsset,
} from '../../workspace/assetsApi';

type TicketKind = 'Issue' | 'Query' | 'Request';

export function EssAssetsPage() {
  const [assets, setAssets] = useState<MyAsset[]>([]);
  const [tickets, setTickets] = useState<AssetTicket[]>([]);
  const [kind, setKind] = useState<TicketKind>('Issue');
  const [assetId, setAssetId] = useState('');
  const [category, setCategory] = useState<(typeof ASSET_CATEGORIES)[number]>('laptop');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    Promise.all([fetchMyAssets(), fetchMyAssetTickets()])
      .then(([mine, mineTickets]) => {
        setAssets(mine);
        setTickets(mineTickets);
        setAssetId((current) => current || mine[0]?.assetId || '');
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load assets.'));
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createAssetTicket({
        type: kind,
        assetId: kind === 'Request' ? undefined : assetId,
        category: kind === 'Request' ? category : undefined,
        subject,
        body,
      });
      setSubject('');
      setBody('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send that to IT.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ess-section-stack ess-assets">
      <header className="ess-leave-hero">
        <div className="ess-leave-hero-copy">
          <p className="ess-leave-kicker">
            <Laptop size={14} aria-hidden /> IT assets
          </p>
          <h1>My assets</h1>
          <p className="ess-lead">
            These are the items currently assigned to you. Report a problem, ask a question, or request something new. IT handles every request.
          </p>
        </div>
      </header>

      {error ? <p className="ess-alert">{error}</p> : null}

      <section className="ess-panel">
        <div className="ess-panel-head">
          <h2>Currently assigned</h2>
          <span className="ess-muted">{assets.length}</span>
        </div>
        {assets.length === 0 ? <p className="ess-empty">Nothing is assigned to you right now.</p> : null}
        <ul className="ess-asset-list">
          {assets.map((asset) => (
            <li key={asset.assetId} className="ess-asset-card">
              <div>
                <strong>{asset.assetTag}</strong>
                <p>{asset.makeModel || categoryLabel(asset.category)}</p>
              </div>
              <dl>
                <div>
                  <dt>Category</dt>
                  <dd>{categoryLabel(asset.category)}</dd>
                </div>
                <div>
                  <dt>Serial</dt>
                  <dd>{asset.serialNo || '—'}</dd>
                </div>
                <div>
                  <dt>Since</dt>
                  <dd>{asset.assignedOn}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section className="ess-panel">
        <h2>Contact IT</h2>
        <form className="ess-form" onSubmit={(event) => void onSubmit(event)}>
          <div className="ess-field">
            <label htmlFor="asset-kind">Type</label>
            <select id="asset-kind" value={kind} onChange={(event) => setKind(event.target.value as TicketKind)}>
              <option value="Issue">Issue with an assigned asset</option>
              <option value="Query">Question about an assigned asset</option>
              <option value="Request">Request a new asset</option>
            </select>
          </div>
          {kind === 'Request' ? (
            <div className="ess-field">
              <label htmlFor="asset-category">What do you need?</label>
              <select
                id="asset-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as (typeof ASSET_CATEGORIES)[number])}
              >
                {ASSET_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {categoryLabel(item)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="ess-field">
              <label htmlFor="asset-id">Asset</label>
              <select id="asset-id" value={assetId} onChange={(event) => setAssetId(event.target.value)} required>
                {assets.length === 0 ? <option value="">No assigned assets</option> : null}
                {assets.map((asset) => (
                  <option key={asset.assetId} value={asset.assetId}>
                    {asset.assetTag} · {asset.makeModel || categoryLabel(asset.category)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="ess-field">
            <label htmlFor="asset-subject">Subject</label>
            <input id="asset-subject" value={subject} onChange={(event) => setSubject(event.target.value)} required />
          </div>
          <div className="ess-field">
            <label htmlFor="asset-body">Details</label>
            <textarea id="asset-body" value={body} onChange={(event) => setBody(event.target.value)} rows={3} required />
          </div>
          <button type="submit" className="ess-btn ess-btn-primary" disabled={busy || (kind !== 'Request' && !assetId)}>
            {busy ? 'Sending…' : 'Send to IT'}
          </button>
        </form>
      </section>

      <section className="ess-panel">
        <h2>My requests</h2>
        {tickets.length === 0 ? <p className="ess-empty">No asset requests yet.</p> : null}
        <ul className="ess-leave-request-list">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="ess-leave-request">
              <div className="ess-leave-request-head">
                <strong>
                  {ticket.type}
                  {ticket.asset ? ` · ${ticket.asset.assetTag}` : ticket.category ? ` · ${categoryLabel(ticket.category)}` : ''}
                </strong>
                <StatusChip status={ticket.status === 'InProgress' ? 'In progress' : ticket.status} />
              </div>
              <p className="ess-leave-request-range">{ticket.subject}</p>
              <p className="ess-muted">{ticket.body}</p>
              {ticket.comments.map((comment) => (
                <p key={comment.id} className="ess-leave-decision">
                  IT: {comment.body}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
