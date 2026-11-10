import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusChip } from '../components/StatusChip';
import {
  FAULT_CATEGORIES,
  assetMessage,
  fetchMyAssetTickets,
  fetchMyTicketFile,
  openBlob,
  titleCase,
  type AssetTicket,
} from '../../workspace/assetsApi';

const TYPE_LABELS: Record<AssetTicket['type'], string> = {
  Issue: 'Fault',
  Query: 'Question',
  Request: 'Request',
  Loss: 'Lost or stolen',
};

export function EssAssetReportsPage() {
  const [tickets, setTickets] = useState<AssetTicket[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyAssetTickets()
      .then(setTickets)
      .catch((err: unknown) => setError(assetMessage(err)))
      .finally(() => setReady(true));
  }, []);

  async function openFile(ticket: AssetTicket, fileId: string) {
    try {
      openBlob(await fetchMyTicketFile(ticket.id, fileId));
    } catch (err: unknown) {
      setError(assetMessage(err));
    }
  }

  return (
    <div className="ess-section-stack ess-assets">
      <Link className="ess-btn ess-btn-ghost it-assets-back" to="/ess/assets">
        ← My assets
      </Link>
      {error ? <p className="ess-alert">{error}</p> : null}
      <section className="ess-panel">
        <h2>My reports</h2>
        {ready && tickets.length === 0 ? <p className="ess-empty">You haven't reported anything yet.</p> : null}
        <ul className="ess-list">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>
                  {ticket.reference} · {TYPE_LABELS[ticket.type]}
                  {ticket.asset ? ` · ${ticket.asset.assetTag}` : ''}
                </strong>
                <StatusChip status={ticket.status === 'InProgress' ? 'In progress' : ticket.status} />
              </div>
              <span className="ess-list-meta">
                <span>{FAULT_CATEGORIES.find((item) => item.value === ticket.category)?.label ?? ticket.subject}</span>
                <span>{titleCase(ticket.priority)} priority</span>
                <span>{ticket.createdAt.slice(0, 10)}</span>
              </span>
              <span className="ess-muted">{ticket.body}</span>
              {ticket.type === 'Loss' ? (
                <span className="ess-muted">
                  {titleCase(ticket.category)} on {ticket.lostOn} at {ticket.lostLocation}
                </span>
              ) : null}
              {ticket.files.map((file) => (
                <button key={file.id} type="button" className="it-assets-link" onClick={() => void openFile(ticket, file.id)}>
                  {file.fileName}
                </button>
              ))}
              {ticket.comments.map((comment) => (
                <span key={comment.id} className="ess-leave-decision">
                  Asset team: {comment.body}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
