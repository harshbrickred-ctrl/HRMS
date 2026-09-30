import { useState, type FormEvent } from 'react';
import { StatusChip } from '../components/StatusChip';
import { useEssData } from '../mock/EssDataContext';

export function EssHelpdeskPage() {
  const { tickets, createTicket } = useEssData();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Payroll');
  const open = tickets.filter((ticket) => ticket.status !== 'Resolved').length;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!subject.trim()) return;
    createTicket({ subject, category });
    setSubject('');
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
                    <span>{ticket.createdAt}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ess-panel">
          <h2>New ticket</h2>
          <form className="ess-form" onSubmit={onSubmit}>
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
            <button type="submit" className="ess-btn ess-btn-primary">
              Submit ticket
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
