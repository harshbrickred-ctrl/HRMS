import { useEffect, useState } from 'react';
import { StatusChip } from '../ess/components/StatusChip';
import { categoryLabel, fetchAssetTickets, updateAssetTicket, type AssetTicket } from './assetsApi';
import './it-assets.css';

const STATUSES = ['Open', 'InProgress', 'Resolved', 'Closed'] as const;

export function ItAssetTicketsPage() {
  const [tickets, setTickets] = useState<AssetTicket[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchAssetTickets()
      .then((rows) => {
        setTickets(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load tickets.'));
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
      setError(err instanceof Error ? err.message : 'Could not update the ticket.');
    }
  }

  return (
    <div className="it-assets">
      <header>
        <h1>Asset tickets</h1>
        <p>Issues, questions, and new-asset requests from employees. Only IT updates these.</p>
      </header>
      {error ? <p className="ess-alert">{error}</p> : null}
      <ul className="it-assets-list">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <div className="it-assets-head">
              <div>
                <strong>
                  {ticket.type}
                  {ticket.asset ? ` · ${ticket.asset.assetTag}` : ''}
                  {ticket.category ? ` · ${categoryLabel(ticket.category)}` : ''}
                </strong>
                <span>
                  {ticket.person?.name} · {ticket.person?.employeeCode}
                </span>
              </div>
              <StatusChip status={ticket.status === 'InProgress' ? 'In progress' : ticket.status} />
            </div>
            <p>
              <strong>{ticket.subject}</strong> — {ticket.body}
            </p>
            {ticket.comments.map((comment) => (
              <p key={comment.id} className="it-assets-note">
                {comment.body}
              </p>
            ))}
            <div className="it-assets-actions">
              <select
                aria-label={`Status for ${ticket.subject}`}
                defaultValue={ticket.status}
                onChange={(event) => void onStatus(ticket, event.target.value)}
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item === 'InProgress' ? 'In progress' : item}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Note for ${ticket.subject}`}
                placeholder="Note to the employee"
                value={notes[ticket.id] ?? ''}
                onChange={(event) => setNotes((current) => ({ ...current, [ticket.id]: event.target.value }))}
              />
            </div>
          </li>
        ))}
      </ul>
      {tickets.length === 0 ? <p className="ess-empty">No asset tickets yet.</p> : null}
    </div>
  );
}
