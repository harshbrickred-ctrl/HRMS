import { useEffect, useState, type FormEvent } from 'react';
import { decideCorrection, fetchTeamAttendance } from './attendanceApi';
import { decideLeaveRequest, fetchTeamLeave } from './leaveApi';
import { fetchReportSummary } from './reportsApi';
import { Link } from 'react-router-dom';
import { EmployeePhoto } from '../ess/components/EmployeePhoto';
import { StatusChip } from '../ess/components/StatusChip';
import { teams } from '../ess/mock/essMock';
import {
  auditLog,
  jobs,
  mailHealth,
  useWorkspace,
} from './workspaceMock';
import { HrAttendanceAdminPage } from './HrAttendanceAdminPage';

export { HrAttendanceAdminPage };
export {
  HrOverviewPage,
  HrEmployeesPage,
  HrOrganizationPage,
  HrLeaveAdminPage,
  HrDocumentsPage,
  HrWorkflowsPage,
  HrReportsPage,
} from './HrPages';


function Insights({ items }: { items: Array<[string, string | number]> }) {
  return (
    <div className="ess-insights">
      {items.map(([label, value]) => (
        <article key={label} className="ess-panel ess-insight">
          <p className="ess-muted">{label}</p>
          <p className="ess-insight-value">{value}</p>
        </article>
      ))}
    </div>
  );
}

function useReportFigures() {
  const [figures, setFigures] = useState<Array<[string, number]>>([
    ['Headcount', 0],
    ['On leave', 0],
    ['Exceptions', 0],
    ['Awaiting approval', 0],
  ]);
  useEffect(() => {
    fetchReportSummary()
      .then((data) => {
        setFigures([
          ['Headcount', data.headcount],
          ['On leave', data.onLeave],
          ['Exceptions', data.attendanceExceptions],
          ['Awaiting approval', data.pendingLeave + data.pendingCorrections],
        ]);
      })
      .catch(() => undefined);
  }, []);
  return figures;
}

export function ManagerOverviewPage() {
  const { myPending, onLeave, exceptions } = useWorkspace();
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Pending approvals', myPending.length],
          ['On leave', onLeave],
          ['Exceptions', exceptions.length],
        ]}
      />
      <section className="ess-panel">
        <h2>Needs a decision</h2>
        <ul className="ess-list">
          {myPending.map((item) => (
            <li key={item.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{item.person}</strong>
                <StatusChip status={item.kind} />
              </div>
              <span className="ess-muted">{item.summary}</span>
            </li>
          ))}
        </ul>
        <Link to="/manager/inbox" className="ess-btn ess-btn-primary">
          Open inbox
        </Link>
      </section>
    </div>
  );
}

export function ManagerInboxPage() {
  const [leaveItems, setLeaveItems] = useState<
    Array<{
      id: string;
      type: string;
      startDate: string;
      endDate: string;
      days: number;
      reason: string;
      status: string;
      person?: { name: string } | null;
    }>
  >([]);
  const [corrections, setCorrections] = useState<
    Array<{ id: string; date: string; reason: string; status: string; person: { name: string } | null }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    const now = new Date();
    Promise.all([fetchTeamLeave(), fetchTeamAttendance(now.getFullYear(), now.getMonth() + 1)])
      .then(([leave, attendance]) => {
        setLeaveItems(leave.requests);
        setCorrections(attendance.corrections);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load inbox.'));
  }

  useEffect(() => {
    load();
  }, []);

  async function onLeave(id: string, status: 'Approved' | 'Rejected') {
    try {
      await decideLeaveRequest(id, status);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not decide leave.');
    }
  }

  async function onCorrection(id: string, status: 'Approved' | 'Rejected') {
    try {
      await decideCorrection(id, status);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not decide correction.');
    }
  }

  const pendingLeave = leaveItems.filter((item) => item.status === 'Pending');
  const pendingCorrections = corrections.filter((item) => item.status === 'Pending');

  return (
    <div className="ess-section-stack">
      {error ? <p className="ess-alert">{error}</p> : null}
      <section className="ess-panel">
        <h2>Approvals</h2>
        {pendingLeave.length === 0 && pendingCorrections.length === 0 ? (
          <p className="ess-empty">Nothing is waiting for you.</p>
        ) : null}
        <ul className="ess-list">
          {pendingLeave.map((item) => (
            <li key={`leave-${item.id}`} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>
                  {item.person?.name ?? 'Employee'} · Leave
                </strong>
                <StatusChip status={item.status} />
              </div>
              <span className="ess-muted">
                {item.type} · {item.startDate}
                {item.endDate !== item.startDate ? ` – ${item.endDate}` : ''} · {item.days} day(s) · {item.reason}
              </span>
              <div className="ess-actions">
                <button type="button" className="ess-btn ess-btn-primary" onClick={() => void onLeave(item.id, 'Approved')}>
                  Approve
                </button>
                <button type="button" className="ess-btn ess-btn-danger" onClick={() => void onLeave(item.id, 'Rejected')}>
                  Reject
                </button>
              </div>
            </li>
          ))}
          {pendingCorrections.map((item) => (
            <li key={`att-${item.id}`} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>
                  {item.person?.name ?? 'Employee'} · Attendance
                </strong>
                <StatusChip status={item.status} />
              </div>
              <span className="ess-muted">
                {item.date} · {item.reason}
              </span>
              <div className="ess-actions">
                <button type="button" className="ess-btn ess-btn-primary" onClick={() => void onCorrection(item.id, 'Approved')}>
                  Approve
                </button>
                <button type="button" className="ess-btn ess-btn-danger" onClick={() => void onCorrection(item.id, 'Rejected')}>
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function TeamLeavePage() {
  const [requests, setRequests] = useState<
    Array<{
      id: string;
      type: string;
      startDate: string;
      endDate: string;
      days: number;
      reason: string;
      status: string;
      person?: { name: string } | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamLeave()
      .then((data) => {
        setRequests(data.requests);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load team leave.'));
  }, []);

  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Requests', requests.length],
          ['Pending', requests.filter((item) => item.status === 'Pending').length],
          ['Approved', requests.filter((item) => item.status === 'Approved').length],
        ]}
      />
      {error ? <p className="ess-alert">{error}</p> : null}
      <section className="ess-panel">
        <h2>Team leave</h2>
        {requests.length === 0 ? <p className="ess-empty">No leave has been sent to you.</p> : null}
        <ul className="ess-list">
          {requests.map((item) => (
            <li key={item.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{item.person?.name ?? 'Employee'}</strong>
                <StatusChip status={item.status} />
              </div>
              <span className="ess-muted">
                {item.type} · {item.startDate}
                {item.endDate !== item.startDate ? ` – ${item.endDate}` : ''} · {item.reason}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function TeamAttendancePage() {
  const today = new Date();
  const [year] = useState(today.getFullYear());
  const [month] = useState(today.getMonth() + 1);
  const [exceptions, setExceptions] = useState<
    Array<{ date: string; status: string; person: { name: string } | null; checkIn: string | null; checkOut: string | null }>
  >([]);
  const [requests, setRequests] = useState<
    Array<{ id: string; date: string; status: string; reason: string; person: { name: string } | null }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchTeamAttendance(year, month)
      .then((data) => {
        setExceptions(data.exceptions);
        setRequests(data.corrections);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load team attendance.'));
  }

  useEffect(() => {
    load();
  }, [month, year]);

  async function onDecide(id: string, status: 'Approved' | 'Rejected') {
    try {
      await decideCorrection(id, status);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not decide this correction.');
    }
  }

  const absences = exceptions.filter((item) => item.status === 'absent').length;
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Exceptions', exceptions.length],
          ['Corrections', requests.filter((item) => item.status === 'Pending').length],
          ['Absences', absences],
        ]}
      />
      {error ? <p className="ess-alert">{error}</p> : null}
      <section className="ess-panel">
        <h2>Team attendance</h2>
        {exceptions.length === 0 && requests.length === 0 ? (
          <p className="ess-empty">No attendance items for your team.</p>
        ) : null}
        <ul className="ess-list">
          {requests.map((item) => (
            <li key={item.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{item.person?.name ?? 'Employee'}</strong>
                <StatusChip status={item.status} />
              </div>
              <span className="ess-muted">
                {item.date} · {item.reason}
              </span>
              {item.status === 'Pending' ? (
                <div className="ess-actions">
                  <button type="button" className="ess-btn ess-btn-primary" onClick={() => void onDecide(item.id, 'Approved')}>
                    Approve
                  </button>
                  <button type="button" className="ess-btn" onClick={() => void onDecide(item.id, 'Rejected')}>
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))}
          {exceptions.map((item) => (
            <li key={`${item.person?.name ?? 'x'}-${item.date}`} className="ess-list-item">
              <strong>{item.person?.name ?? 'Employee'}</strong>
              <span className="ess-list-meta">
                <span>{item.date}</span>
                <span>{item.status}</span>
                <span>
                  {item.checkIn ?? '—'} → {item.checkOut ?? '—'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function TeamDirectoryPage() {
  const { directReports } = useWorkspace();
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Direct reports', directReports.length],
          ['Departments', new Set(directReports.map((person) => person.department)).size],
          ['Locations', new Set(directReports.map((person) => person.location)).size],
        ]}
      />
      <div className="ess-person-grid">
        {directReports.map((person) => (
          <article key={person.id} className="ess-person-card">
            <EmployeePhoto src={person.photo} name={person.name} />
            <h3>{person.name}</h3>
            <span className="ess-muted">{person.title}</span>
            <span className="ess-muted">
              {person.employeeCode} · {person.department}
              {person.teamId ? ` · ${teams.find((team) => team.id === person.teamId)?.name}` : ''}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

export function HrMigrationPage() {
  const { imports, addImport } = useWorkspace();
  const [name, setName] = useState('greytHR-employees.csv');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    addImport(name.trim());
  }

  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Recorded', imports.length],
          ['Source', 'CSV'],
          ['Last file', imports[0]?.name ?? '—'],
        ]}
      />
      <div className="ess-att-split">
        <section className="ess-panel">
          <h2>Record an import</h2>
          <form className="ess-form" onSubmit={onSubmit}>
            <div className="ess-field">
              <label htmlFor="import-name">File name</label>
              <input id="import-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <button type="submit" className="ess-btn ess-btn-primary">
              Append import
            </button>
          </form>
        </section>
        <section className="ess-panel">
          <h2>History</h2>
          {imports.length === 0 ? (
            <p className="ess-empty">Nothing recorded yet.</p>
          ) : (
            <ul className="ess-list">
              {imports.map((row) => (
                <li key={row.id} className="ess-list-item">
                  <strong>{row.name}</strong>
                  <span className="ess-muted">{row.at}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function AdminOverviewPage() {
  const { settings } = useWorkspace();
  const flags = Number(settings.smtp) + Number(settings.retention) + Number(settings.reminders);
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Audit events', auditLog.length],
          ['Mail issues', mailHealth.filter((item) => item.status !== 'Delivered').length],
          ['Flags on', flags],
        ]}
      />
      <section className="ess-panel">
        <h2>Platform</h2>
        <ul className="ess-list">
          <li className="ess-list-item">
            <strong>Jobs</strong>
            <span className="ess-muted">{jobs.filter((job) => job.status !== 'Ok').length} need a retry</span>
          </li>
          <li className="ess-list-item">
            <strong>Identity</strong>
            <span className="ess-muted">Role changes stay on Users & Roles</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

export function AdminAuditPage() {
  const [query, setQuery] = useState('');
  const rows = auditLog.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${item.actor} ${item.action}`.toLowerCase().includes(q);
  });
  return (
    <div className="ess-section-stack">
      <section className="ess-panel">
        <div className="ess-att-toolbar">
          <h2>Audit log</h2>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter actor or action"
            aria-label="Filter audit log"
          />
        </div>
        <ul className="ess-list">
          {rows.map((item) => (
            <li key={item.id} className="ess-list-item">
              <strong>{item.action}</strong>
              <span className="ess-list-meta">
                <span>{item.actor}</span>
                <span>{item.at}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AdminMailPage() {
  const issues = mailHealth.filter((item) => item.status !== 'Delivered').length;
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Messages', mailHealth.length],
          ['Delivered', mailHealth.length - issues],
          ['Need attention', issues],
        ]}
      />
      <section className="ess-panel">
        <h2>Delivery</h2>
        <ul className="ess-list">
          {mailHealth.map((item) => (
            <li key={item.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{item.subject}</strong>
                <StatusChip status={item.status} />
              </div>
              <span className="ess-muted">{item.to}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AdminSettingsPage() {
  const { settings, toggleSetting } = useWorkspace();
  const rows: Array<{ key: 'smtp' | 'retention' | 'reminders'; label: string; detail: string }> = [
    { key: 'smtp', label: 'SMTP', detail: 'Send mail through the configured provider' },
    { key: 'retention', label: 'Retention labels', detail: 'Keep audit rows for the default window' },
    { key: 'reminders', label: 'Reminder flag', detail: 'Queue the morning reminder job' },
  ];
  return (
    <div className="ess-section-stack">
      <section className="ess-panel">
        <h2>System settings</h2>
        <ul className="ess-list">
          {rows.map((row) => (
            <li key={row.key} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{row.label}</strong>
                <button type="button" className="ess-btn" onClick={() => toggleSetting(row.key)}>
                  {settings[row.key] ? 'On' : 'Off'}
                </button>
              </div>
              <span className="ess-muted">{row.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AdminJobsPage() {
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Jobs', jobs.length],
          ['Healthy', jobs.filter((job) => job.status === 'Ok').length],
          ['Retrying', jobs.filter((job) => job.status === 'Retrying').length],
        ]}
      />
      <section className="ess-panel">
        <h2>Scheduled jobs</h2>
        <ul className="ess-list">
          {jobs.map((job) => (
            <li key={job.name} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{job.name}</strong>
                <StatusChip status={job.status} />
              </div>
              <span className="ess-muted">Last run {job.lastRun}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function LeadershipOverviewPage() {
  const figures = useReportFigures();
  return (
    <div className="ess-section-stack">
      <Insights items={figures.slice(0, 3)} />
      <p className="ess-att-facts">
        <span>
          Read only · <strong>{figures[3][1]}</strong> awaiting approval
        </span>
      </p>
    </div>
  );
}

export function LeadershipReportsPage() {
  const figures = useReportFigures();
  return (
    <div className="ess-section-stack">
      <section className="ess-panel">
        <h2>Org figures</h2>
        <ul className="ess-list">
          {figures.map(([label, value]) => (
            <li key={label} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{label}</strong>
                <span>{value}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
