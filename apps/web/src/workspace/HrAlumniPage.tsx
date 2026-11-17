import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../alumni/alumni.css';
import { formatDay } from '../alumni/alumniApi';
import { Chip } from '../alumni/alumniUi';
import { EssModal } from '../ess/components/EssModal';
import { fetchHrEmployees, type HrEmployee } from './hrApi';
import {
  ACCESS_LABELS,
  ELIGIBILITY_LABELS,
  createExitClosure,
  fetchAlumniOverview,
  fetchAlumniRecords,
  fetchExitClosures,
  sendInvitations,
  updateExitClosure,
  type AlumniOverview,
  type AlumniRow,
  type ExitClosure,
  type ExitClosureInput,
} from './hrAlumniApi';

const TABS = [
  { to: '/hr/alumni', label: 'Alumni' },
  { to: '/hr/alumni/requests', label: 'Document requests' },
  { to: '/hr/alumni/engagement', label: 'News and events' },
  { to: '/hr/alumni/careers', label: 'Jobs and referrals' },
];

export function HrAlumniTabs() {
  const { pathname } = useLocation();
  // A record page (/hr/alumni/:id) belongs to the Alumni tab.
  const current = TABS.slice(1).find((tab) => pathname.startsWith(tab.to))?.to ?? '/hr/alumni';
  return (
    <nav className="ess-tabs al-hr-tabs" aria-label="Alumni sections">
      {TABS.map((tab) => (
        <Link key={tab.to} to={tab.to} className={`ess-tab${current === tab.to ? ' is-active' : ''}`} aria-current={current === tab.to ? 'page' : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function message(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

const EMPTY_CLOSURE: ExitClosureInput = {
  employeeId: '',
  joiningDate: '',
  lastWorkingDay: '',
  personalEmail: '',
  exitCompletedOn: '',
  fnfSettledOn: '',
  fnfReference: '',
  notes: '',
};

export function HrAlumniPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AlumniOverview | null>(null);
  const [rows, setRows] = useState<AlumniRow[]>([]);
  const [closures, setClosures] = useState<ExitClosure[]>([]);
  const [filters, setFilters] = useState({ q: '', eligibility: '', access: '', exitYear: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ExitClosure | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(() => {
    Promise.all([fetchAlumniOverview(), fetchAlumniRecords(filters), fetchExitClosures()])
      .then(([stats, list, closureList]) => {
        setOverview(stats);
        setRows(list);
        setClosures(closureList);
        setReady(true);
      })
      .catch((err) => setError(message(err)));
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [load]);

  const pending = closures.filter((closure) => !closure.alumniId);
  const invitable = useMemo(
    () => rows.filter((row) => row.eligibility === 'eligible' && ['not_invited', 'invite_expired'].includes(row.access)),
    [rows],
  );

  async function inviteSelected() {
    setError(null);
    try {
      const result = await sendInvitations([...selected]);
      const sent = result.results.filter((item) => item.ok).length;
      const failed = result.results.filter((item) => !item.ok);
      setNotice(`${sent} invitation${sent === 1 ? '' : 's'} sent.${failed.length ? ` ${failed.length} skipped: ${failed[0].message}` : ''}`);
      setSelected(new Set());
      load();
    } catch (err) {
      setError(message(err));
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const stat = (value: number | undefined, label: string) => (
    <div className="al-stat">
      <strong>{value ?? '—'}</strong>
      <span>{label}</span>
    </div>
  );

  return (
    <div className="al-page">
      <div className="al-hr-head">
        <div>
          <p className="ess-page-lead">
            Former employees join here once their exit is completed and F&amp;F is settled. Only alumni marked Eligible can be
            invited.
          </p>
        </div>
        <button type="button" className="ess-btn ess-btn-primary" onClick={() => setEditing('new')}>
          Record an exit
        </button>
      </div>
      <HrAlumniTabs />
      {notice ? <p className="al-ok">{notice}</p> : null}
      {error ? <p className="ess-alert">{error}</p> : null}
      <div className="al-stats">
        {stat(overview?.alumni, 'Alumni records')}
        {stat(overview?.registered, 'Registered on the portal')}
        {stat(overview?.invited, 'Invitations open')}
        {stat(overview?.doNotContact, 'Do not contact')}
        {stat(overview?.pendingClosures, 'Exits waiting for F&F')}
        {stat(overview?.openRequests, 'Open document requests')}
      </div>

      {pending.length ? (
        <section className="ess-panel">
          <h2 className="ess-panel-title">Exits waiting to become alumni</h2>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Last working day</th>
                  <th>Exit completed</th>
                  <th>F&amp;F settled</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((closure) => (
                  <tr key={closure.id}>
                    <td>
                      {closure.employeeName}
                      <span className="al-sub">
                        {closure.employeeCode} · {closure.designation || '—'}
                      </span>
                    </td>
                    <td>{formatDay(closure.lastWorkingDay)}</td>
                    <td>{closure.exitCompletedOn ? formatDay(closure.exitCompletedOn) : <Chip status="pending" label="Not yet" />}</td>
                    <td>{closure.fnfSettledOn ? formatDay(closure.fnfSettledOn) : <Chip status="pending" label="Not yet" />}</td>
                    <td className="al-table-actions">
                      <button type="button" className="ess-btn" onClick={() => setEditing(closure)}>
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="ess-panel al-page">
        <div className="ess-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          <label className="ess-filter-field" style={{ gridColumn: 'span 2' }}>
            Search
            <input value={filters.q} placeholder="Name, employee ID or email" onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </label>
          <label className="ess-filter-field">
            Eligibility
            <select value={filters.eligibility} onChange={(e) => setFilters({ ...filters, eligibility: e.target.value })}>
              <option value="">All</option>
              {Object.entries(ELIGIBILITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="ess-filter-field">
            Portal access
            <select value={filters.access} onChange={(e) => setFilters({ ...filters, access: e.target.value })}>
              <option value="">All</option>
              {Object.entries(ACCESS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="ess-filter-field">
            Exit year
            <input inputMode="numeric" value={filters.exitYear} placeholder="e.g. 2025" onChange={(e) => setFilters({ ...filters, exitYear: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          </label>
        </div>
        <div className="ess-actions" style={{ justifyContent: 'space-between' }}>
          <span className="al-meta">
            {rows.length} alumni · {invitable.length} can be invited
          </span>
          <div className="ess-actions">
            <button
              type="button"
              className="ess-btn"
              disabled={!invitable.length}
              onClick={() => setSelected(new Set(invitable.map((row) => row.id)))}
            >
              Select all who can be invited
            </button>
            <button type="button" className="ess-btn ess-btn-primary" disabled={!selected.size} onClick={() => void inviteSelected()}>
              Invite selected ({selected.size})
            </button>
          </div>
        </div>
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Alumnus</th>
                <th>Department</th>
                <th>Tenure</th>
                <th>Left on</th>
                <th>Eligibility</th>
                <th>Portal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="is-clickable" onClick={() => navigate(`/hr/alumni/${row.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.fullName}`}
                      checked={selected.has(row.id)}
                      disabled={!invitable.includes(row)}
                      onChange={() => toggle(row.id)}
                    />
                  </td>
                  <td>
                    <Link className="al-linkbtn" to={`/hr/alumni/${row.id}`} onClick={(e) => e.stopPropagation()}>
                      {row.fullName}
                    </Link>
                    <span className="al-sub">
                      {row.employeeCode} · {row.personalEmail}
                    </span>
                  </td>
                  <td>
                    {row.departmentName || '—'}
                    <span className="al-sub">{row.designation}</span>
                  </td>
                  <td>{row.tenure}</td>
                  <td>{formatDay(row.lastWorkingDay)}</td>
                  <td>
                    <Chip status={row.eligibility} label={ELIGIBILITY_LABELS[row.eligibility]} />
                  </td>
                  <td>
                    <Chip status={row.access} label={ACCESS_LABELS[row.access]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ready && rows.length === 0 ? <p className="ess-empty">No alumni match. Record an exit to add one.</p> : null}
          {!ready ? <p className="ess-empty">Loading…</p> : null}
        </div>
      </section>

      {editing ? (
        <ExitClosureModal
          closure={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setNotice(
              saved.alumniId
                ? `${saved.employeeName} is now an alumnus. Their payslips were copied to the alumni documents.`
                : `Exit recorded for ${saved.employeeName}. The alumni record is created once the exit is completed and F&F is settled.`,
            );
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function ExitClosureModal({
  closure,
  onClose,
  onSaved,
}: {
  closure: ExitClosure | null;
  onClose: () => void;
  onSaved: (closure: ExitClosure) => void;
}) {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [form, setForm] = useState<ExitClosureInput>(
    closure
      ? {
          joiningDate: closure.joiningDate,
          lastWorkingDay: closure.lastWorkingDay,
          personalEmail: closure.personalEmail,
          exitCompletedOn: closure.exitCompletedOn ?? '',
          fnfSettledOn: closure.fnfSettledOn ?? '',
          fnfReference: closure.fnfReference,
          notes: closure.notes,
        }
      : EMPTY_CLOSURE,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!closure) fetchHrEmployees().then(setEmployees).catch((err) => setError(message(err)));
  }, [closure]);

  const set = (key: keyof ExitClosureInput) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setBusy(true);
    setError(null);
    // Empty optional fields are left out rather than sent as blanks.
    const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== '')) as ExitClosureInput;
    try {
      onSaved(closure ? await updateExitClosure(closure.id, payload) : await createExitClosure(payload));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof ExitClosureInput, label: string, type = 'text', hint?: string) => (
    <div className="ess-field">
      <label htmlFor={`exit-${key}`}>{label}</label>
      <input id={`exit-${key}`} type={type} value={form[key] ?? ''} onChange={(e) => set(key)(e.target.value)} />
      {hint ? <p className="ess-field-hint">{hint}</p> : null}
    </div>
  );

  return (
    <EssModal
      title={closure ? `Exit of ${closure.employeeName}` : 'Record an exit'}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ess-btn ess-btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="al-modal-form">
        {error ? <p className="ess-alert">{error}</p> : null}
        {!closure ? (
          <div className="ess-field">
            <label htmlFor="exit-employee">Employee</label>
            <select id="exit-employee" value={form.employeeId} onChange={(e) => set('employeeId')(e.target.value)}>
              <option value="">Choose an employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} · {employee.employeeCode}
                  {employee.status === 'DISABLED' ? ' · login disabled' : ''}
                </option>
              ))}
            </select>
            <p className="ess-field-hint">ID, name, designation and department are copied from the Employee master; it is not changed.</p>
          </div>
        ) : closure.employeeLoginActive ? (
          <p className="al-callout">This person's employee login is still active. Disable it under Employees when they leave.</p>
        ) : null}
        <div className="al-form-row">
          {field('joiningDate', 'Joining date', 'date')}
          {field('lastWorkingDay', 'Last working day', 'date')}
          <div className="al-field-wide">{field('personalEmail', 'Personal email', 'email', 'Invitations go here, never to the work email.')}</div>
          {field('exitCompletedOn', 'Exit completed on', 'date')}
          {field('fnfSettledOn', 'F&F settled on', 'date')}
          {field('fnfReference', 'F&F reference')}
        </div>
        <div className="ess-field">
          <label htmlFor="exit-notes">Notes</label>
          <textarea id="exit-notes" value={form.notes ?? ''} onChange={(e) => set('notes')(e.target.value)} />
        </div>
        <p className="ess-field-hint">The alumni record is created automatically once both the exit completion and F&amp;F dates are set.</p>
      </div>
    </EssModal>
  );
}
