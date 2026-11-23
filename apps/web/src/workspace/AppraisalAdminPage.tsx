import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAdminAppraisal, fetchAdminAppraisals, type Appraisal } from './appraisalsApi';
import './appraisals.css';

const STATUSES = ['Self_Appraisal_Pending', 'Manager_Review_Pending', 'HR_Review_Pending', 'Management_Approval_Pending', 'Completed', 'Rejected', 'Revision_Requested'];

function statusLabel(value: string | null | undefined) { return (value ?? '').replaceAll('_', ' '); }
function rating(values: Array<number | null>) {
  const present = values.filter((value): value is number => value != null);
  return present.length ? (present.reduce((sum, value) => sum + value, 0) / present.length).toFixed(1) : '—';
}
function statusClass(value: string) { return `appraisal-status appraisal-status-${value.toLowerCase()}`; }

export function AppraisalAdminPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<Appraisal[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [cycle, setCycle] = useState('');
  const [sort, setSort] = useState('employee');
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let active = true;
    fetchAdminAppraisals().then((rows) => { if (active) { setRecords(rows); setError(''); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load appraisals.'); });
    return () => { active = false; };
  }, []);

  const appraisals = records ?? [];
  const countFor = (value: string) => appraisals.filter((item) => item.status === value).length;
  const departments = [...new Set(appraisals.map((item) => item.employee?.department?.name ?? 'Unassigned'))].sort();
  const cycles = [...new Set(appraisals.map((item) => item.cycle.name))].sort();
  const filtered = useMemo(() => appraisals.filter((item) => {
    const name = `${item.employee?.firstName ?? ''} ${item.employee?.lastName ?? ''}`;
    return (!search || `${name} ${item.employee?.employeeCode ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      && (!status || item.status === status)
      && (!department || (item.employee?.department?.name ?? 'Unassigned') === department)
      && (!cycle || item.cycle.name === cycle);
  }).sort((a, b) => {
    const value = (item: Appraisal): string | number => sort === 'employeeId' ? item.employee?.employeeCode ?? '' : sort === 'department' ? item.employee?.department?.name ?? '' : sort === 'designation' ? item.employee?.designation ?? '' : sort === 'manager' ? `${item.employee?.manager?.firstName ?? ''} ${item.employee?.manager?.lastName ?? ''}` : sort === 'cycle' ? item.cycle.name : sort === 'status' ? item.status : sort === 'updated' ? item.updatedAt ?? '' : sort === 'self' ? Number(rating(item.kpiResponses.map((entry) => entry.selfRating))) || -1 : sort === 'managerRating' ? Number(rating(item.kpiResponses.map((entry) => entry.managerRating))) || -1 : `${item.employee?.firstName ?? ''} ${item.employee?.lastName ?? ''}`;
    const first = value(a); const second = value(b);
    const result = typeof first === 'number' && typeof second === 'number' ? first - second : String(first).localeCompare(String(second), undefined, { numeric: true });
    return descending ? -result : result;
  }), [appraisals, search, status, department, cycle, sort, descending]);

  const completed = countFor('Completed');
  const completion = appraisals.length ? Math.round(completed / appraisals.length * 100) : 0;
  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const departmentStats = departments.map((name) => {
    const departmentRecords = appraisals.filter((item) => (item.employee?.department?.name ?? 'Unassigned') === name);
    return { name, total: departmentRecords.length, completed: departmentRecords.filter((item) => item.status === 'Completed').length };
  });
  const upcomingCycles = [...new Map(appraisals.filter((item) => item.cycle.selfDeadline).map((item) => [item.cycle.id, item.cycle])).values()]
    .sort((a, b) => String(a.selfDeadline).localeCompare(String(b.selfDeadline))).slice(0, 3);
  const recent = appraisals.flatMap((item) => (item.history ?? []).map((event) => ({ ...event, name: `${item.employee?.firstName ?? ''} ${item.employee?.lastName ?? ''}` })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  function changeSort(key: string) {
    if (sort === key) setDescending((value) => !value);
    else { setSort(key); setDescending(false); }
  }
  function exportCsv() {
    const data = [
      ['Employee ID', 'Employee', 'Department', 'Designation', 'Reporting Manager', 'Cycle', 'Self Rating', 'Manager Rating', 'Status', 'Last Updated'],
      ...filtered.map((item) => [item.employee?.employeeCode ?? '', `${item.employee?.firstName ?? ''} ${item.employee?.lastName ?? ''}`, item.employee?.department?.name ?? '', item.employee?.designation ?? '', `${item.employee?.manager?.firstName ?? ''} ${item.employee?.manager?.lastName ?? ''}`, item.cycle.name, rating(item.kpiResponses.map((response) => response.selfRating)), rating(item.kpiResponses.map((response) => response.managerRating)), statusLabel(item.status), item.updatedAt ?? '']),
    ].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'appraisal-records.csv'; link.click(); URL.revokeObjectURL(url);
  }

  return <main className="appraisal-page appraisal-admin-page">
    <header className="appraisal-page-header"><div className="appraisal-title-mark" aria-hidden="true">A</div><div className="appraisal-title-copy"><p className="appraisal-eyebrow">ADMINISTRATION</p><h1>Appraisal overview</h1><p>Organization-wide appraisal progress, review status, and recent activity.</p></div></header>
    <div className="appraisal-summary appraisal-admin-metrics">
      {[
        ['Total appraisals', appraisals.length, 'All records', ''],
        ['Self-appraisals', countFor('Self_Appraisal_Pending'), 'Waiting for employees', 'Self_Appraisal_Pending'],
        ['Manager reviews', countFor('Manager_Review_Pending'), 'Waiting for managers', 'Manager_Review_Pending'],
        ['HR reviews', countFor('HR_Review_Pending'), 'Waiting for HR', 'HR_Review_Pending'],
        ['Management approvals', countFor('Management_Approval_Pending'), 'Awaiting final decision', 'Management_Approval_Pending'],
        ['Completed', completed, 'Finalized records', 'Completed'],
      ].map(([label, value, hint, filter], index) => <button type="button" className={`appraisal-metric appraisal-metric-${index + 1} appraisal-metric-button ${status === filter && filter ? 'is-selected' : ''}`} key={String(label)} onClick={() => { setStatus(String(filter)); setPage(1); }}><span className="appraisal-metric-icon" aria-hidden="true">{['▦', '◷', '↗', '✓', '◎', '✓'][index]}</span><strong>{value}</strong><span className="appraisal-metric-label">{label}</span><small>{hint}</small></button>)}
    </div>
    {error ? <div className="appraisal-error" role="alert">{error}</div> : null}
    <div className="appraisal-admin-insights">
      <section className="appraisal-card appraisal-progress-card"><div className="appraisal-section-title"><div><h2>Cycle completion</h2><p>Finalized appraisals across active records</p></div><strong>{completion}%</strong></div><div className="appraisal-progress-track"><i style={{ width: `${completion}%` }} /></div><div className="appraisal-progress-caption"><span>{completed} completed</span><span>{appraisals.length - completed} remaining</span></div></section>
      <section className="appraisal-card"><div className="appraisal-section-title"><div><h2>Upcoming deadlines</h2><p>Self-appraisal due dates</p></div></div>{upcomingCycles.length ? upcomingCycles.map((item) => <div className="appraisal-deadline-row" key={item.id}><span className="appraisal-deadline-icon">◷</span><div><strong>{item.name}</strong><small>{new Date(`${item.selfDeadline}T00:00:00`).toLocaleDateString()}</small></div><span className={statusClass(item.status ?? 'Draft')}>{statusLabel(item.status ?? 'Draft')}</span></div>) : <p className="appraisal-muted-copy">No cycle deadlines available.</p>}</section>
      <section className="appraisal-card"><div className="appraisal-section-title"><div><h2>Status overview</h2><p>Records by workflow stage</p></div></div><div className="appraisal-status-bars">{STATUSES.slice(0, 6).map((value) => <div className="appraisal-status-bar-row" key={value}><span>{statusLabel(value)}</span><div><i style={{ width: `${appraisals.length ? Math.max(countFor(value) / appraisals.length * 100, countFor(value) ? 4 : 0) : 0}%` }} /></div><b>{countFor(value)}</b></div>)}</div></section>
      <section className="appraisal-card"><div className="appraisal-section-title"><div><h2>Department progress</h2><p>Completion by department</p></div></div>{departmentStats.slice(0, 6).map((item) => <div className="appraisal-dept-progress" key={item.name}><div><strong>{item.name}</strong><span>{item.completed} of {item.total} completed</span></div><div><i style={{ width: `${item.total ? item.completed / item.total * 100 : 0}%` }} /></div></div>)}{!departmentStats.length ? <p className="appraisal-muted-copy">Department analytics will appear when appraisals are available.</p> : null}</section>
      <section className="appraisal-card appraisal-activity-card"><div className="appraisal-section-title"><div><h2>Recent activity</h2><p>Latest workflow updates</p></div></div>{recent.map((event, index) => <div className="appraisal-activity-row" key={`${event.createdAt}-${index}`}><i /><div><strong>{event.name}</strong><span>{statusLabel(event.action)} · {statusLabel(event.status ?? event.toStatus)}</span></div><time>{new Date(event.createdAt).toLocaleDateString()}</time></div>)}{!recent.length ? <p className="appraisal-muted-copy">Appraisal activity will appear here.</p> : null}</section>
    </div>

    <section className="appraisal-records-section">
      <div className="appraisal-section-title"><div><h2>Appraisal records</h2><p>Search, filter, sort, and review organization records.</p></div><button type="button" className="appraisal-export-button" onClick={exportCsv} disabled={!filtered.length}>Export CSV ↓</button></div>
      <div className="appraisal-table-toolbar"><label className="appraisal-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search employee name or ID" /></label><select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{STATUSES.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select><select aria-label="Filter by department" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }}><option value="">All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by cycle" value={cycle} onChange={(event) => { setCycle(event.target.value); setPage(1); }}><option value="">All cycles</option>{cycles.map((item) => <option key={item}>{item}</option>)}</select>{(status || department || cycle || search) ? <button type="button" className="appraisal-clear-filters" onClick={() => { setSearch(''); setStatus(''); setDepartment(''); setCycle(''); setPage(1); }}>Clear filters</button> : null}</div>
      <div className="appraisal-table-shell"><table className="appraisal-table"><thead><tr>{[['Employee ID', 'employeeId'], ['Employee', 'employee'], ['Department', 'department'], ['Designation', 'designation'], ['Reporting manager', 'manager'], ['Appraisal cycle', 'cycle'], ['Self rating', 'self'], ['Manager rating', 'managerRating'], ['Current status', 'status'], ['Last updated', 'updated']].map(([label, key]) => <th key={label}><button type="button" onClick={() => changeSort(key)}>{label}{sort === key ? (descending ? ' ↓' : ' ↑') : ''}</button></th>)}<th>Actions</th></tr></thead><tbody>
        {!records ? Array.from({ length: 5 }, (_, index) => <tr className="appraisal-skeleton-row" key={index}><td colSpan={11}><i /></td></tr>) : rows.map((item) => <tr key={item.id} tabIndex={0} aria-label={`View appraisal for ${item.employee?.firstName ?? ''} ${item.employee?.lastName ?? ''}`} onClick={() => navigate(`/admin/appraisals/${item.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/admin/appraisals/${item.id}`); } }}><td>{item.employee?.employeeCode ?? '—'}</td><td><span className="appraisal-table-employee"><span className="appraisal-avatar">{item.employee?.firstName?.slice(0, 1)}{item.employee?.lastName?.slice(0, 1)}</span><strong>{item.employee?.firstName} {item.employee?.lastName}</strong></span></td><td>{item.employee?.department?.name ?? 'Unassigned'}</td><td>{item.employee?.designation || '—'}</td><td>{item.employee?.manager ? `${item.employee.manager.firstName} ${item.employee.manager.lastName}` : '—'}</td><td>{item.cycle.name}</td><td>{rating(item.kpiResponses.map((entry) => entry.selfRating))}</td><td>{rating(item.kpiResponses.map((entry) => entry.managerRating))}</td><td><span className={statusClass(item.status)}><i aria-hidden="true" />{statusLabel(item.status)}</span></td><td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</td><td><button type="button" className="appraisal-row-action" onClick={(event) => { event.stopPropagation(); navigate(`/admin/appraisals/${item.id}`); }}>View details</button></td></tr>)}
        {records && !rows.length ? <tr><td colSpan={11}><div className="appraisal-table-empty"><strong>No matching appraisals</strong><span>Try adjusting the search or filters.</span></div></td></tr> : null}
      </tbody></table></div>
      <div className="appraisal-table-footer"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><label>Rows per page <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map((size) => <option key={size}>{size}</option>)}</select></label><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button><span>Page {page} of {maxPage}</span><button type="button" disabled={page >= maxPage} onClick={() => setPage(page + 1)}>Next →</button></div></div>

    </section>
  </main>;
}

type DetailTab = 'Overview' | 'Self-Appraisal' | 'Manager Review' | 'HR Review' | 'Final Approval' | 'History';
const DETAIL_TABS: DetailTab[] = ['Overview', 'Self-Appraisal', 'Manager Review', 'HR Review', 'Final Approval', 'History'];

export function AppraisalAdminDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Appraisal | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DetailTab>('Overview');
  useEffect(() => { let active = true; fetchAdminAppraisal(id).then((value) => { if (active) setItem(value); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load appraisal details.'); }); return () => { active = false; }; }, [id]);
  if (error) return <main className="appraisal-page"><button className="appraisal-back-button" onClick={() => navigate('/admin/appraisals')}>← Back to appraisals</button><p className="appraisal-error">{error}</p></main>;
  if (!item) return <main className="appraisal-page"><div className="appraisal-detail-skeleton" /><div className="appraisal-detail-skeleton" /></main>;
  const employee = item.employee;
  const steps = ['Self_Appraisal_Pending', 'Manager_Review_Pending', 'HR_Review_Pending', 'Management_Approval_Pending', 'Completed'];
  const currentStep = Math.max(steps.indexOf(item.status), item.status === 'Revision_Requested' ? 1 : 0);
  const kpis = <div className="appraisal-read-kpis">{item.kpiResponses.map((entry) => <div key={entry.cycleKpiId}><span>{entry.cycleKpi.title}<small>{entry.cycleKpi.category} · {entry.cycleKpi.weight}%</small></span><b>Self {entry.selfRating ?? '—'} / 5 · Manager {entry.managerRating ?? '—'} / 5</b></div>)}</div>;
  return <main className="appraisal-page appraisal-detail-page">
    <button className="appraisal-back-button" onClick={() => navigate('/admin/appraisals')}>← Back to appraisals</button>
    <header className="appraisal-detail-header"><span className="appraisal-avatar appraisal-detail-avatar">{employee?.firstName?.slice(0, 1)}{employee?.lastName?.slice(0, 1)}</span><div className="appraisal-detail-identity"><p className="appraisal-eyebrow">APPRAISAL RECORD · {employee?.employeeCode}</p><h1>{employee?.firstName} {employee?.lastName}</h1><p>{employee?.department?.name ?? 'Unassigned'} · {employee?.designation || 'Designation not set'} · Manager: {employee?.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : 'Unassigned'}</p></div><div className="appraisal-detail-cycle"><strong>{item.cycle.name}</strong><span>{item.cycle.periodStart ? new Date(`${item.cycle.periodStart}T00:00:00`).toLocaleDateString() : 'Cycle'} – {item.cycle.periodEnd ? new Date(`${item.cycle.periodEnd}T00:00:00`).toLocaleDateString() : ''}</span><span className={statusClass(item.status)}><i aria-hidden="true" />{statusLabel(item.status)}</span></div></header>
    <section className="appraisal-card appraisal-detail-progress"><div className="appraisal-section-title"><div><h2>Review progress</h2><p>Current appraisal workflow stage</p></div><strong>{item.status === 'Completed' ? '100%' : `${Math.round(currentStep / (steps.length - 1) * 100)}%`}</strong></div><div className="appraisal-stepper">{steps.map((step, index) => <div className={index <= currentStep ? 'is-done' : ''} key={step}><i>{index < currentStep || item.status === 'Completed' ? '✓' : index + 1}</i><span>{statusLabel(step)}</span></div>)}</div></section>
    <nav className="appraisal-detail-tabs" aria-label="Appraisal detail sections">{DETAIL_TABS.map((name) => <button type="button" key={name} className={tab === name ? 'is-active' : ''} onClick={() => setTab(name)}>{name}</button>)}</nav>
    <section className="appraisal-card appraisal-detail-content">
      {tab === 'Overview' ? <><div className="appraisal-detail-facts"><div><span>Employee ID</span><strong>{employee?.employeeCode}</strong></div><div><span>Department</span><strong>{employee?.department?.name ?? 'Unassigned'}</strong></div><div><span>Designation</span><strong>{employee?.designation || '—'}</strong></div><div><span>Reporting manager</span><strong>{employee?.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}</strong></div><div><span>Last updated</span><strong>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}</strong></div><div><span>Submitted</span><strong>{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : 'Pending'}</strong></div></div><div className="appraisal-read-grid"><section><h3>Self-assessment</h3><p>{item.selfFeedback || 'Employee reflection has not been submitted.'}</p></section><section><h3>Manager feedback</h3><p>{item.managerFeedback || 'Manager review is pending.'}</p></section></div>{kpis}</> : null}
      {tab === 'Self-Appraisal' ? <><div className="appraisal-read-grid"><section><h3>Goals and objectives</h3><p>{(item.goals ?? []).map(String).join(' · ') || 'No goals recorded.'}</p></section><section><h3>Key achievements</h3><p>{(item.achievements ?? []).map(String).join(' · ') || 'No achievements recorded.'}</p></section></div><section className="appraisal-feedback-block"><h3>Overall self-assessment</h3><p>{item.selfFeedback || 'No reflection submitted.'}</p></section>{kpis}</> : null}
      {tab === 'Manager Review' ? <><div className="appraisal-read-grid"><section><h3>Manager rating</h3><p className="appraisal-detail-rating">{item.managerRating ?? '—'} <small>/ 5</small></p><p>{item.managerFeedback || 'Manager feedback is not available yet.'}</p></section><section><h3>Strengths</h3><p>{item.managerStrengths || 'No strengths recorded.'}</p><h3>Improvement areas</h3><p>{item.managerImprovementAreas || 'No improvement areas recorded.'}</p></section></div>{kpis}</> : null}
      {tab === 'HR Review' ? <div className="appraisal-read-grid"><section><h3>HR evaluation</h3><p className="appraisal-detail-rating">{item.hrRating ?? '—'} <small>/ 5</small></p><p>{item.hrFeedback || 'HR review is not available yet.'}</p></section><section><h3>Review note</h3><p>{item.managementFeedback || 'No additional note.'}</p><p className="appraisal-confidential-note">Compensation and promotion recommendations are restricted to HR and management reviewers.</p></section></div> : null}
      {tab === 'Final Approval' ? <div className="appraisal-read-grid"><section><h3>Final decision</h3><p>{item.status === 'Completed' ? 'Approved and completed' : item.status === 'Rejected' ? 'Recommendation rejected' : 'Awaiting management decision'}</p><p>{item.managementFeedback || 'No final approval note recorded.'}</p></section><section><h3>Completion date</h3><p>{item.completedAt ? new Date(item.completedAt).toLocaleString() : 'Not completed'}</p><p className="appraisal-confidential-note">Confidential compensation recommendations are available only in authorized reviewer workspaces.</p></section></div> : null}
      {tab === 'History' ? <div className="appraisal-detail-timeline">{item.history?.length ? item.history.map((event, index) => <article key={`${event.createdAt}-${index}`}><i /><div><strong>{statusLabel(event.action)}</strong><span>{event.fromStatus ? `${statusLabel(event.fromStatus)} → ` : ''}{statusLabel(event.status)}</span>{event.comment ? <p>{event.comment}</p> : null}<small>{event.actor ?? event.stage} · {new Date(event.createdAt).toLocaleString()}</small></div></article>) : <p className="appraisal-muted-copy">No activity has been recorded.</p>}</div> : null}
    </section>
  </main>;
}
