import { useEffect, useState, type FormEvent } from 'react';
import { createTicket, fetchMyTickets, type HelpdeskTicketDto } from '../../workspace/helpdeskApi';
import { StatusChip } from '../components/StatusChip';

export function EssHelpdeskPage() {
  const [tickets, setTickets] = useState<HelpdeskTicketDto[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Payroll');
  const [error, setError] = useState<string | null>(null);
  const open = tickets.filter((ticket) => ticket.status !== 'Resolved' && ticket.status !== 'Closed').length;

  function load() {
    fetchMyTickets()
      .then((rows) => {
        setTickets(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load tickets.'));
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    try {
      await createTicket({ subject, category, body });
      setSubject('');
      setBody('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create the ticket.');
    }
  }

  return (
    <div className="ess-section-stack">
      <div className="ess-insights">
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Open</p>
          <p className="ess-insight-value">{open}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Tickets</p>
          <p className="ess-insight-value">{tickets.length}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Resolved</p>
          <p className="ess-insight-value">{tickets.length - open}</p>
        </article>
      </div>
      {error ? <p className="ess-alert">{error}</p> : null}

      <div className="ess-att-split">
        <section className="ess-panel">
          <h2>My tickets</h2>
          {tickets.length === 0 ? (
            <p className="ess-empty">No tickets yet.</p>
          ) : (
            <ul className="ess-list">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="ess-list-item">
                  <div className="ess-leave-request-head">
                    <strong>{ticket.subject}</strong>
                    <StatusChip status={ticket.status} />
                  </div>
                  <span className="ess-list-meta">
                    <span>{ticket.category}</span>
                    <span>{new Date(ticket.createdAt).toLocaleDateString('en-IN')}</span>
                  </span>
                  <span className="ess-muted">{ticket.body}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ess-panel">
          <h2>New ticket</h2>
          <form className="ess-form" onSubmit={(event) => void onSubmit(event)}>
            <div className="ess-field">
              <label htmlFor="ticket-subject">Subject</label>
              <input
                id="ticket-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
              />
            </div>
            <div className="ess-field">
              <label htmlFor="ticket-category">Category</label>
              <select
                id="ticket-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option>Payroll</option>
                <option>Leave</option>
                <option>Attendance</option>
                <option>Access</option>
              </select>
            </div>
            <div className="ess-field">
              <label htmlFor="ticket-body">Details</label>
              <textarea
                id="ticket-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
              />
            </div>
            <button type="submit" className="ess-btn ess-btn-primary">
              Submit ticket
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
