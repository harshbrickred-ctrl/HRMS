import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { EmployeePhoto } from '../ess/components/EmployeePhoto';
import { StatusChip } from '../ess/components/StatusChip';
import { departments, ORGANIZATION, teams } from '../ess/mock/essMock';
import {
  auditLog,
  companyDocs,
  holidays,
  jobs,
  leaveTypes,
  mailHealth,
  useWorkspace,
  workflows,
} from './workspaceMock';

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
  const workspace = useWorkspace();
  return [
    ['Headcount', workspace.headcount],
    ['On leave', workspace.onLeave],
    ['Exceptions', workspace.exceptions.length],
    ['Awaiting approval', workspace.pending.length],
  ] as Array<[string, number]>;
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
  const { myInbox, decide } = useWorkspace();
  return (
    <div className="ess-section-stack">
      <section className="ess-panel">
        <h2>Approvals</h2>
        {myInbox.length === 0 ? <p className="ess-empty">Nothing is waiting for you.</p> : null}
        <ul className="ess-list">
          {myInbox.map((item) => (
            <li key={item.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>
                  {item.person} · {item.kind}
                </strong>
                <StatusChip status={item.status} />
              </div>
              <span className="ess-muted">{item.summary}</span>
              {item.status === 'Pending' ? (
                <div className="ess-actions">
                  <button
                    type="button"
                    className="ess-btn ess-btn-primary"
                    onClick={() => decide(item.id, 'Approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="ess-btn ess-btn-danger"
                    onClick={() => decide(item.id, 'Rejected')}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function TeamLeavePage() {
  const { myInbox } = useWorkspace();
  const requests = myInbox.filter((item) => item.kind === 'Leave');
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Requests', requests.length],
          ['Pending', requests.filter((item) => item.status === 'Pending').length],
          ['Approved', requests.filter((item) => item.status === 'Approved').length],
        ]}
      />
      <section className="ess-panel">
        <h2>Team leave</h2>
        {requests.length === 0 ? <p className="ess-empty">No leave has been sent to you.</p> : null}
        <ul className="ess-list">
          {requests.map((item) => (
            <li key={item.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{item.person}</strong>
                <StatusChip status={item.status} />
              </div>
              <span className="ess-muted">{item.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function TeamAttendancePage() {
  const { exceptions, myInbox } = useWorkspace();
  const requests = myInbox.filter((item) => item.kind === 'Attendance');
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Exceptions', exceptions.length],
          ['Corrections', requests.length],
          ['Absences', exceptions.filter((item) => item.issue.includes('Absent')).length],
        ]}
      />
      <section className="ess-panel">
        <h2>Team attendance</h2>
        {exceptions.length === 0 && requests.length === 0 ? (
          <p className="ess-empty">No attendance items for your team.</p>
        ) : null}
        <ul className="ess-list">
          {requests.map((item) => (
            <li key={item.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{item.person}</strong>
                <StatusChip status={item.status} />
              </div>
              <span className="ess-muted">{item.summary}</span>
            </li>
          ))}
          {exceptions.map((item) => (
            <li key={item.id} className="ess-list-item">
              <strong>{item.person}</strong>
              <span className="ess-list-meta">
                <span>{item.date}</span>
                <span>{item.issue}</span>
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

export function HrOverviewPage() {
  const { pending, employees, imports } = useWorkspace();
  const incomplete = employees.filter((person) => !person.workPhone || person.workPhone === '—').length;
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Approvals waiting', pending.length],
          ['Incomplete profiles', incomplete],
          ['Import rows', imports.length],
        ]}
      />
      <section className="ess-panel">
        <h2>Queues</h2>
        <ul className="ess-list">
          <li className="ess-list-item">
            <strong>Leave and attendance</strong>
            <span className="ess-muted">{pending.length} items still with managers</span>
          </li>
          <li className="ess-list-item">
            <strong>Profiles</strong>
            <span className="ess-muted">{incomplete} people missing a work phone</span>
          </li>
          <li className="ess-list-item">
            <strong>Imports</strong>
            <span className="ess-muted">
              {imports.length === 0 ? 'No files recorded yet' : `${imports.length} recorded`}
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

export function HrEmployeesPage() {
  const { employees, addEmployee } = useWorkspace();
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [location, setLocation] = useState('Noida');
  const [title, setTitle] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (person) =>
        person.name.toLowerCase().includes(q) ||
        person.department.toLowerCase().includes(q) ||
        person.employeeCode.toLowerCase().includes(q),
    );
  }, [employees, query]);

  function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    addEmployee({ name, department, location, title });
    setName('');
    setTitle('');
  }

  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Employees', employees.length],
          ['Showing', filtered.length],
          ['Departments', new Set(employees.map((person) => person.department)).size],
        ]}
      />
      <div className="ess-att-split">
        <section className="ess-panel">
          <div className="ess-att-toolbar">
            <h2>Directory</h2>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or code"
              aria-label="Search employees"
            />
          </div>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Employee id</th>
                  <th>Department</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((person) => (
                  <tr key={person.id}>
                    <td>{person.name}</td>
                    <td>{person.employeeCode}</td>
                    <td>{person.department}</td>
                    <td>{person.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="ess-panel">
          <h2>Add employee</h2>
          <form className="ess-form" onSubmit={onAdd}>
            <div className="ess-field">
              <label htmlFor="hr-name">Name</label>
              <input id="hr-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="ess-field">
              <label htmlFor="hr-title">Title</label>
              <input id="hr-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="ess-field">
              <label htmlFor="hr-dept">Department</label>
              <input
                id="hr-dept"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </div>
            <div className="ess-field">
              <label htmlFor="hr-loc">Location</label>
              <input id="hr-loc" value={location} onChange={(event) => setLocation(event.target.value)} />
            </div>
            <button type="submit" className="ess-btn ess-btn-primary">
              Add to directory
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export function HrOrganizationPage() {
  const { employees } = useWorkspace();
  const locations = group(employees, (person) => person.location);
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Organization', ORGANIZATION.name],
          ['Code', ORGANIZATION.code],
          ['People', employees.length],
        ]}
      />
      {departments.map((department) => {
        const deptTeams = teams.filter((team) => team.departmentId === department.id);
        return (
          <section key={department.id} className="ess-panel">
            <h2>{department.name}</h2>
            {deptTeams.length === 0 ? (
              <p className="ess-empty">No teams. Department leads report here.</p>
            ) : (
              <ul className="ess-list">
                {deptTeams.map((team) => {
                  const manager = employees.find((person) => person.id === team.managerId);
                  const members = employees.filter((person) => person.teamId === team.id);
                  return (
                    <li key={team.id} className="ess-list-item">
                      <div className="ess-leave-request-head">
                        <strong>{team.name}</strong>
                        <span>
                          {members.length} {members.length === 1 ? 'person' : 'people'}
                        </span>
                      </div>
                      <span className="ess-muted">Manager {manager?.name ?? '—'}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      <GroupCard title="Locations" groups={locations} />
    </div>
  );
}

function group<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const name = key(item);
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function GroupCard({ title, groups }: { title: string; groups: Array<[string, number]> }) {
  return (
    <section className="ess-panel">
      <h2>{title}</h2>
      <ul className="ess-list">
        {groups.map(([name, count]) => (
          <li key={name} className="ess-list-item">
            <div className="ess-leave-request-head">
              <strong>{name}</strong>
              <span>{count}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HrLeaveAdminPage() {
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Leave types', leaveTypes.length],
          ['Holidays', holidays.length],
          ['Capped types', leaveTypes.filter((item) => item.code !== 'LOP').length],
        ]}
      />
      <div className="ess-att-split">
        <section className="ess-panel">
          <h2>Types</h2>
          <ul className="ess-list">
            {leaveTypes.map((item) => (
              <li key={item.code} className="ess-list-item">
                <div className="ess-leave-request-head">
                  <strong>{item.type}</strong>
                  <span>{item.code === 'LOP' ? 'No cap' : item.entitled}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="ess-panel">
          <h2>Holidays</h2>
          <ul className="ess-list">
            {holidays.map((holiday) => (
              <li key={holiday.date} className="ess-list-item">
                <strong>{holiday.name}</strong>
                <span className="ess-muted">{holiday.date}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function HrAttendanceAdminPage() {
  const { imports, addImport } = useWorkspace();
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Shift', 'General'],
          ['Window', '09:00–18:00'],
          ['Imports', imports.length],
        ]}
      />
      <section className="ess-panel">
        <h2>Record an import</h2>
        <p className="ess-muted">This stores a row only. It does not read a file.</p>
        <button type="button" className="ess-btn ess-btn-primary" onClick={() => addImport('attendance-september.csv')}>
          Record September file
        </button>
        {imports.length > 0 ? (
          <ul className="ess-list">
            {imports.map((row) => (
              <li key={row.id} className="ess-list-item">
                <strong>{row.name}</strong>
                <span className="ess-list-meta">
                  <span>{row.rows} rows</span>
                  <span>{row.at}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

export function HrDocumentsPage() {
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Company files', companyDocs.length],
          ['Categories', new Set(companyDocs.map((doc) => doc.category)).size],
          ['Packs', 1],
        ]}
      />
      <section className="ess-panel">
        <h2>Company documents</h2>
        <ul className="ess-list">
          {companyDocs.map((doc) => (
            <li key={doc.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{doc.name}</strong>
                <span className="ess-muted">{doc.category}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function HrWorkflowsPage() {
  const stuck = workflows.reduce((sum, item) => sum + item.stuck, 0);
  return (
    <div className="ess-section-stack">
      <Insights
        items={[
          ['Definitions', workflows.length],
          ['Stuck', stuck],
          ['Clear', workflows.filter((item) => item.stuck === 0).length],
        ]}
      />
      <section className="ess-panel">
        <h2>Workflows</h2>
        <ul className="ess-list">
          {workflows.map((item) => (
            <li key={item.name} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>{item.name}</strong>
                <span>{item.stuck} stuck</span>
              </div>
              <span className="ess-muted">{item.steps}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function HrReportsPage() {
  const figures = useReportFigures();
  return (
    <div className="ess-section-stack">
      <Insights items={figures.slice(0, 3)} />
      <p className="ess-att-facts">
        <span>
          <strong>{figures[3][1]}</strong> awaiting approval
        </span>
      </p>
      <section className="ess-panel">
        <h2>This month</h2>
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
