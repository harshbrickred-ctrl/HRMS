import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusChip } from '../ess/components/StatusChip';
import {
  FAULT_CATEGORIES,
  assetMessage,
  categoryLabel,
  fetchAssetTickets,
  fetchTicketFile,
  openBlob,
  titleCase,
  updateAssetTicket,
  type AssetTicket,
} from './assetsApi';
import './it-assets.css';

const STATUSES = ['Open', 'InProgress', 'Resolved', 'Closed'] as const;
const TYPE_LABELS: Record<AssetTicket['type'], string> = {
  Issue: 'Fault',
  Query: 'Question',
  Request: 'Request',
  Loss: 'Lost or stolen',
};

export function ItAssetTicketsPage() {
  const [tickets, setTickets] = useState<AssetTicket[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchAssetTickets()
      .then((rows) => {
        setTickets(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(assetMessage(err)))
      .finally(() => setReady(true));
  }

  useEffect(() => {
    load();
  }, []);

  async function onStatus(ticket: AssetTicket, status: string) {
    try {
      await updateAssetTicket(ticket.id, status, notes[ticket.id]);
      setNotes((current) => ({ ...current, [ticket.id]: '' }));
      load();
    } catch (err: unknown) {
      setError(assetMessage(err));
      load();
    }
  }

  async function openFile(ticket: AssetTicket, fileId: string) {
    try {
      openBlob(await fetchTicketFile(ticket.id, fileId));
    } catch (err: unknown) {
      setError(assetMessage(err));
    }
  }

  return (
    <div className="it-assets">
      <p className="it-assets-note">
        Faults, questions, and lost asset reports from employees. A report never changes an asset by itself: open the asset to mark it lost or start a repair.
      </p>
      {error ? <p className="ess-alert">{error}</p> : null}
      {ready && tickets.length === 0 ? <p className="ess-empty">No asset tickets yet.</p> : null}
      <ul className="it-assets-list">
        {tickets.map((ticket) => {
          const fault = FAULT_CATEGORIES.find((item) => item.value === ticket.category);
          return (
            <li key={ticket.id}>
              <div className="it-assets-head">
                <div>
                  <strong>
                    {ticket.reference} · {TYPE_LABELS[ticket.type]}
                    {ticket.asset ? ` · ${ticket.asset.assetTag}` : ''}
                    {ticket.type === 'Request' && ticket.category ? ` · ${categoryLabel(ticket.category)}` : ''}
                  </strong>
                  <span>
                    {ticket.person?.name} · {ticket.person?.employeeCode} · {titleCase(ticket.priority)} priority ·{' '}
                    {ticket.createdAt.slice(0, 10)}
                  </span>
                </div>
                <StatusChip status={ticket.status === 'InProgress' ? 'In progress' : ticket.status} />
              </div>
              <p>
                <strong>{fault?.label ?? ticket.subject}</strong> — {ticket.body}
              </p>
              {ticket.type === 'Loss' ? (
                <p>
                  {titleCase(ticket.category)} on {ticket.lostOn} at {ticket.lostLocation}
                </p>
              ) : null}
              {ticket.files.length ? (
                <p>
                  {ticket.files.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      className="it-assets-link"
                      onClick={() => void openFile(ticket, file.id)}
                    >
                      {file.fileName}
                    </button>
                  ))}
                </p>
              ) : null}
              {ticket.comments.map((comment) => (
                <p key={comment.id} className="it-assets-note">
                  {comment.body}
                </p>
              ))}
              <div className="it-assets-actions">
                <select
                  aria-label={`Status for ${ticket.reference}`}
                  value={ticket.status}
                  onChange={(event) => void onStatus(ticket, event.target.value)}
                >
                  {STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item === 'InProgress' ? 'In progress' : item}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Note for ${ticket.reference}`}
                  placeholder="Note to the employee"
                  value={notes[ticket.id] ?? ''}
                  onChange={(event) => setNotes((current) => ({ ...current, [ticket.id]: event.target.value }))}
                />
                {ticket.asset ? (
                  <Link className="ess-btn" to={`/it/assets/${ticket.asset.id}`}>
                    Open asset
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
