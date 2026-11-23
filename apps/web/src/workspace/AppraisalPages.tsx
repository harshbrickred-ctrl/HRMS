import { useEffect, useMemo, useState } from 'react';
import {
  createAppraisalCycle,
  closeAppraisalCycle,
  decideAppraisal,
  fetchAppraisalCycles,
  fetchAppraisalSummary,
  fetchAdminAppraisals,
  fetchHrAppraisals,
  fetchManagementAppraisals,
  fetchManagerAppraisals,
  fetchMyAppraisals,
  launchAppraisalCycle,
  saveHrReview,
  saveManagerReview,
  saveSelfAppraisal,
  setAppraisalCycleKpis,
  submitSelfAppraisal,
  type Appraisal,
} from './appraisalsApi';
import './appraisals.css';

function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function reload() {
    try { setBusy(true); setData(await loader()); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load appraisals.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void reload(); }, []);
  return { data, error, setError, busy, reload };
}

function Status({ value }: { value: string }) {
  const label = value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return <span className={`appraisal-status appraisal-status-${value.toLowerCase()}`}><i aria-hidden="true" />{label}</span>;
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="appraisal-page-header">
    <div className="appraisal-title-mark" aria-hidden="true">A</div>
    <div className="appraisal-title-copy"><p className="appraisal-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
  </header>;
}

function SectionTitle({ title, description, count }: { title: string; description?: string; count?: number }) {
  return <div className="appraisal-section-title"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{count != null ? <span>{count}</span> : null}</div>;
}

function Summary({ scope }: { scope: 'me' | 'manager' | 'hr' | 'management' }) {
  const { data } = useLoad(() => fetchAppraisalSummary(scope));
  const counts = (data?.counts ?? {}) as Record<string, number>;
  const departments = (data?.departments ?? []) as Array<{ department: string; count: number; averageFinalRating: number | null }>;
  const salary = data?.salaryRevisionSummary as { recommendations?: number; proposedIncreaseAmount?: number; averageIncreasePercent?: number | null } | undefined;
  const metrics = scope === 'me' ? [
    ['Current appraisal', Number(counts.Self_Appraisal_Pending ?? 0) + Number(counts.Manager_Review_Pending ?? 0) + Number(counts.HR_Review_Pending ?? 0) + Number(counts.Management_Approval_Pending ?? 0)],
    ['Waiting on you', Number(counts.Self_Appraisal_Pending ?? 0) + Number(counts.Revision_Requested ?? 0)],
    ['Completed', Number(counts.Completed ?? 0)],
  ] : scope === 'manager' ? [
    ['Team appraisals', Number(data?.total ?? 0)],
    ['Pending your review', Number(counts.Manager_Review_Pending ?? 0)],
    ['Reviewed', Number(data?.total ?? 0) - Number(counts.Manager_Review_Pending ?? 0)],
  ] : scope === 'hr' ? [
    ['Total appraisals', Number(data?.total ?? 0)],
    ['Pending HR review', Number(counts.HR_Review_Pending ?? 0) + Number(counts.Manager_Approved ?? 0)],
    ['Completed', Number(counts.Completed ?? 0)],
  ] : [
    ['Total appraisals', Number(data?.total ?? 0)],
    ['Awaiting approval', Number(counts.Management_Approval_Pending ?? 0)],
    ['Completed', Number(counts.Completed ?? 0)],
    ['Promotion proposals', Number(data?.promotionRecommendations ?? 0)],
    ['Salary revisions', Number(salary?.recommendations ?? 0)],
    ['Proposed increase', Number(salary?.proposedIncreaseAmount ?? 0).toLocaleString()],
  ];
  return <div className={`appraisal-summary appraisal-summary-${scope}`}>
    {metrics.map(([label, value], index) => <div className={`appraisal-metric appraisal-metric-${index + 1}`} key={String(label)}><span>{String(label)}</span><strong>{value}</strong><i aria-hidden="true" /></div>)}
    {(scope === 'hr' || scope === 'management') && departments.length ? <div className="appraisal-departments"><div className="appraisal-departments-heading"><span>Department performance</span><small>Average final rating · completed cycles</small></div><div className="appraisal-department-list">{departments.slice(0, 5).map((department) => <div className="appraisal-department" key={department.department}><div><strong>{department.department}</strong><span>{department.count} appraisals</span></div><b>{department.averageFinalRating ?? '—'}</b></div>)}</div></div> : null}
  </div>;
}

function SelfAppraisalCard({ item, onReload, onError }: { item: Appraisal; onReload: () => void; onError: (message: string) => void }) {
  const [goals, setGoals] = useState((item.goals ?? []).map(String).join('\n'));
  const [achievements, setAchievements] = useState((item.achievements ?? []).map(String).join('\n'));
  const [feedback, setFeedback] = useState(item.selfFeedback ?? '');
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string }>>(() => Object.fromEntries(item.kpiResponses.map((response) => [response.cycleKpiId, { rating: response.selfRating ?? 0, comment: response.selfComment ?? '' }])));
  const [busy, setBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const editable = ['Self_Appraisal_Pending', 'Revision_Requested'].includes(item.status);
  const ratingsComplete = item.kpiResponses.filter((response) => response.cycleKpi.required).every((response) => Number(ratings[response.cycleKpiId]?.rating ?? 0) > 0);
  const completedSections = [goals.trim(), achievements.trim(), ratingsComplete, feedback.trim()].filter(Boolean).length;
  function body() {
    return {
      goals: goals.split('\n').map((value) => value.trim()).filter(Boolean),
      achievements: achievements.split('\n').map((value) => value.trim()).filter(Boolean),
      selfFeedback: feedback,
      kpis: item.kpiResponses.map((response) => ({ cycleKpiId: response.cycleKpiId, selfRating: ratings[response.cycleKpiId]?.rating || undefined, selfComment: ratings[response.cycleKpiId]?.comment ?? '' })),
    };
  }
  async function save(submit: boolean) {
    try {
      setBusy(true);
      await saveSelfAppraisal(item.id, body());
      if (submit) await submitSelfAppraisal(item.id);
      await onReload();
    } catch (err) { onError(err instanceof Error ? err.message : 'Could not save the self-appraisal.'); }
    finally { setBusy(false); }
  }
  return <article className="appraisal-card appraisal-self-card">
    <div className="appraisal-card-head"><div className="appraisal-cycle-title"><span className="appraisal-card-kicker">APPRAISAL CYCLE</span><h3>{item.cycle.name}</h3><span>Self-appraisal due {item.cycle.selfDeadline?.slice(0, 10) ?? 'as scheduled'}</span></div><Status value={item.status} /></div>
    {editable ? <>
      <div className="appraisal-self-progress"><div><strong>Self-appraisal progress</strong><span>{completedSections} of 4 sections complete</span></div><div className="appraisal-progress-track"><i style={{ width: `${completedSections * 25}%` }} /></div><nav aria-label="Self-appraisal sections"><a href={`#goals-${item.id}`}>Goals</a><a href={`#achievements-${item.id}`}>Achievements</a><a href={`#kpis-${item.id}`}>Performance</a><a href={`#reflection-${item.id}`}>Reflection</a></nav></div>
      {item.status === 'Revision_Requested' ? <p className="appraisal-notice">Your reviewer requested changes. Update the form and submit it again.</p> : null}
      {item.history?.filter((event) => event.action === 'revision_requested').slice(-1).map((event, index) => <p className="appraisal-notice" key={`${event.createdAt}-${index}`}>{event.comment || 'Please review and update the requested sections.'}</p>)}
      <div className="appraisal-two-col"><label id={`goals-${item.id}`}>Goals<span className="appraisal-field-hint">Add one goal per line</span><textarea value={goals} onChange={(event) => setGoals(event.target.value)} placeholder="What outcomes are you working toward?" /></label>
      <label id={`achievements-${item.id}`}>Achievements<span className="appraisal-field-hint">Add one achievement per line</span><textarea value={achievements} onChange={(event) => setAchievements(event.target.value)} placeholder="What impact did you make this cycle?" /></label></div>
      <div id={`kpis-${item.id}`} className="appraisal-subsection"><div><h4>Performance evaluation</h4><p>Rate each required KPI from 1 to 5 and include a concrete example.</p></div>
      {item.kpiResponses.map((response) => <div className="appraisal-kpi" key={response.cycleKpiId}>
        <div className="appraisal-kpi-title"><span className="appraisal-kpi-weight">{response.cycleKpi.weight}%</span><div><strong>{response.cycleKpi.title}</strong><span>{response.cycleKpi.category}{response.cycleKpi.required ? ' · Required' : ''}</span></div></div>
        <label>Self rating<select value={ratings[response.cycleKpiId]?.rating ?? 0} onChange={(event) => setRatings((state) => ({ ...state, [response.cycleKpiId]: { ...state[response.cycleKpiId], rating: Number(event.target.value) } }))}>
          <option value={0}>Choose</option>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}
        </select></label>
        <input aria-label={`${response.cycleKpi.title} evidence`} value={ratings[response.cycleKpiId]?.comment ?? ''} onChange={(event) => setRatings((state) => ({ ...state, [response.cycleKpiId]: { ...state[response.cycleKpiId], comment: event.target.value } }))} placeholder="Add an example or evidence" />
      </div>)}{!ratingsComplete ? <p className="appraisal-validation-note">Complete each required KPI rating before submitting.</p> : null}</div>
      <label id={`reflection-${item.id}`}>Overall reflection<span className="appraisal-field-hint">Summarize your impact, learnings, and support needed</span><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Write a brief reflection for your manager" /></label>
      <div className="appraisal-form-footer"><span>Your draft is private until you submit it.</span><div className="appraisal-actions"><button disabled={busy} onClick={() => void save(false)}>Save draft</button><button className="primary" disabled={busy || !ratingsComplete} onClick={() => setConfirmSubmit(true)}>Submit appraisal <span aria-hidden="true">→</span></button></div></div>
      {confirmSubmit ? <div className="appraisal-action-confirm" role="alertdialog" aria-label="Confirm appraisal submission"><div><strong>Submit your self-appraisal?</strong><span>You can’t edit it after submission unless a reviewer returns it for revision.</span></div><button type="button" disabled={busy} onClick={() => setConfirmSubmit(false)}>Continue editing</button><button type="button" className="primary" disabled={busy} onClick={() => { setConfirmSubmit(false); void save(true); }}>Confirm submission</button></div> : null}
    </> : <>
      <div className="appraisal-read-grid"><section><h4>Goals</h4><p>{(item.goals ?? []).map(String).join(' · ') || 'No goals recorded.'}</p></section><section><h4>Achievements</h4><p>{(item.achievements ?? []).map(String).join(' · ') || 'No achievements recorded.'}</p></section></div>
      <section className="appraisal-feedback-block"><h4>Your reflection</h4><p>{item.selfFeedback || 'No reflection recorded.'}</p></section>
      {item.kpiResponses.length ? <div className="appraisal-read-kpis"><h4>KPI self-assessment</h4>{item.kpiResponses.map((response) => <div key={response.cycleKpiId}><span>{response.cycleKpi.title}</span><b>{response.selfRating ?? '—'} / 5</b></div>)}</div> : null}
      {item.managerFeedback || item.hrFeedback ? <section className="appraisal-feedback-block appraisal-released-feedback"><span className="appraisal-card-kicker">RELEASED FEEDBACK</span>{item.managerFeedback ? <p><strong>Manager:</strong> {item.managerFeedback}</p> : null}{item.hrFeedback ? <p><strong>HR:</strong> {item.hrFeedback}</p> : null}</section> : null}
      <div className="appraisal-history"><h4>Status history</h4><div>{item.history?.map((event, index) => <p key={`${event.createdAt}-${index}`}><span>{(event.status ?? event.toStatus ?? '').replaceAll('_', ' ')}</span>{event.comment ? <small>{event.comment}</small> : null}</p>)}</div></div>
    </>}
  </article>;
}

export function SelfAppraisalsPage() {
  const { data, error, setError, reload, busy } = useLoad(fetchMyAppraisals);
  return <main className="appraisal-page"><PageHeader eyebrow="EMPLOYEE SELF SERVICE" title="My appraisal" description="Reflect on your work, share your impact, and follow feedback through the review process." />
    <Summary scope="me" />{error ? <p className="appraisal-error">{error}</p> : null}{busy && !data ? <p className="appraisal-loading">Loading your appraisal…</p> : null}
    <SectionTitle title="Current cycle" description="Your active self-appraisal and review status." count={data?.current.length ?? 0} />
    {data?.current.length ? data.current.map((item) => <SelfAppraisalCard key={item.id} item={item} onReload={() => void reload()} onError={setError} />) : <p className="appraisal-empty">No active appraisal cycle is assigned to you.</p>}
    <SectionTitle title="Previous appraisals" description="Past cycles and feedback shared with you." count={data?.previous.length ?? 0} />{data?.previous.length ? data.previous.map((item) => <SelfAppraisalCard key={item.id} item={item} onReload={() => void reload()} onError={setError} />) : <p className="appraisal-empty">Completed appraisals will appear here.</p>}
  </main>;
}

function ManagerReviewCard({ item, onReload, onError }: { item: Appraisal; onReload: () => void; onError: (message: string) => void }) {
  const [feedback, setFeedback] = useState(item.managerFeedback ?? '');
  const [strengths, setStrengths] = useState(item.managerStrengths ?? '');
  const [improvementAreas, setImprovementAreas] = useState(item.managerImprovementAreas ?? '');
  const [rating, setRating] = useState(item.managerRating ?? 3);
  const [kpis, setKpis] = useState<Record<string, { rating: number; comment: string }>>(() => Object.fromEntries(item.kpiResponses.map((response) => [response.cycleKpiId, { rating: response.managerRating ?? 0, comment: response.managerComment ?? '' }])));
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'request-revision' | 'reject' | null>(null);
  const pending = item.status === 'Manager_Review_Pending';
  const review = () => ({ kpis: item.kpiResponses.map((response) => ({ cycleKpiId: response.cycleKpiId, managerRating: kpis[response.cycleKpiId]?.rating ?? 0, managerComment: kpis[response.cycleKpiId]?.comment ?? '' })), feedback, strengths, improvementAreas, rating, comment });
  const ratingsComplete = item.kpiResponses.every((response) => Number(kpis[response.cycleKpiId]?.rating ?? 0) > 0);
  async function decide(action: 'approve' | 'request-revision' | 'reject') {
    if (action !== 'approve' && !comment.trim()) { onError('Add a decision note before returning or rejecting this appraisal.'); return; }
    try {
      setBusy(true); await saveManagerReview(item.id, review());
      await decideAppraisal('manager', item.id, action, { comment });
      await onReload();
    } catch (err) { onError(err instanceof Error ? err.message : 'Could not save the manager review.'); }
    finally { setBusy(false); }
  }
  return <article className="appraisal-card appraisal-review-card">
    <div className="appraisal-card-head"><div className="appraisal-person-title"><span className="appraisal-avatar">{item.employee?.firstName?.slice(0, 1)}{item.employee?.lastName?.slice(0, 1)}</span><div><span className="appraisal-card-kicker">TEAM MEMBER · {item.employee?.employeeCode}</span><h3>{item.employee?.firstName} {item.employee?.lastName}</h3><span>{item.employee?.designation} · {item.cycle.name}</span></div></div><Status value={item.status} /></div>
    <p><strong>Self feedback:</strong> {item.selfFeedback || '—'}</p><p><strong>Goals:</strong> {(item.goals ?? []).map(String).join(' · ') || '—'}</p>
    {item.kpiResponses.map((response) => <div className="appraisal-kpi" key={response.cycleKpiId}>
      <div><strong>{response.cycleKpi.title}</strong><span>Self rating: {response.selfRating ?? '—'} · {response.selfComment}</span></div>
      {pending ? <><label>Manager rating<select value={kpis[response.cycleKpiId]?.rating ?? 0} onChange={(event) => setKpis((state) => ({ ...state, [response.cycleKpiId]: { ...state[response.cycleKpiId], rating: Number(event.target.value) } }))}><option value={0}>Choose</option>{[1,2,3,4,5].map((score) => <option key={score}>{score}</option>)}</select></label><input placeholder="Manager comment" value={kpis[response.cycleKpiId]?.comment ?? ''} onChange={(event) => setKpis((state) => ({ ...state, [response.cycleKpiId]: { ...state[response.cycleKpiId], comment: event.target.value } }))} /></> : <span>Manager rating: {response.managerRating ?? '—'}</span>}
    </div>)}
    {pending ? <>
      <label>Manager feedback<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label>
      <div className="appraisal-two-col"><label>Strengths<textarea value={strengths} onChange={(event) => setStrengths(event.target.value)} /></label><label>Improvement areas<textarea value={improvementAreas} onChange={(event) => setImprovementAreas(event.target.value)} /></label></div>
      <label>Overall rating<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[1,2,3,4,5].map((score) => <option key={score}>{score}</option>)}</select></label>
      <label>Decision note<textarea value={comment} onChange={(event) => setComment(event.target.value)} /></label>
      <div className="appraisal-actions"><button disabled={busy || !ratingsComplete} onClick={() => setConfirmAction('request-revision')}>Request revision</button><button disabled={busy || !ratingsComplete} onClick={() => setConfirmAction('reject')}>Reject</button><button className="primary" disabled={busy || !ratingsComplete} onClick={() => setConfirmAction('approve')}>Approve and send to HR</button></div>
      {confirmAction ? <div className="appraisal-action-confirm" role="alertdialog" aria-label="Confirm manager decision"><div><strong>Confirm {confirmAction.replace('-', ' ')}?</strong><span>{confirmAction === 'approve' ? 'This sends the appraisal to HR.' : 'A decision note is required and will be shared with the employee.'}</span></div><button type="button" onClick={() => setConfirmAction(null)}>Cancel</button><button type="button" className="primary" disabled={busy} onClick={() => { const action = confirmAction; setConfirmAction(null); void decide(action); }}>Confirm decision</button></div> : null}
    </> : <p><strong>Manager feedback:</strong> {item.managerFeedback || '—'}</p>}
  </article>;
}

export function ManagerAppraisalsPage() {
  const { data, error, setError, reload } = useLoad(fetchManagerAppraisals);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const matches = (item: Appraisal) => (!statusFilter || item.status === statusFilter) && (!search || `${item.employee?.firstName ?? ''} ${item.employee?.lastName ?? ''} ${item.employee?.employeeCode ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const pending = (data ?? []).filter((item) => item.status === 'Manager_Review_Pending' && matches(item));
  const completed = (data ?? []).filter((item) => item.status !== 'Manager_Review_Pending' && matches(item));
  return <main className="appraisal-page"><PageHeader eyebrow="MANAGER WORKSPACE" title="Team appraisals" description="Review self-assessments assigned to you and follow each decision through the cycle." />
    <Summary scope="manager" />{error ? <p className="appraisal-error">{error}</p> : null}<div className="appraisal-queue-toolbar"><input aria-label="Search team appraisals" placeholder="Search by employee name or ID" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter team appraisals by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{[...new Set((data ?? []).map((item) => item.status))].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select><span>{(data ?? []).length} team records</span></div><SectionTitle title="Pending your review" description="These team members have submitted their self-appraisal." count={pending.length} />
    {pending.map((item) => <ManagerReviewCard key={item.id} item={item} onReload={() => void reload()} onError={setError} />)}
    {!pending.length ? <p className="appraisal-empty"><strong>You’re all caught up</strong><span>No team appraisals are waiting for your review.</span></p> : null}<SectionTitle title="Other team appraisals" description="Appraisals already routed or completed." count={completed.length} />{completed.map((item) => <details className="appraisal-collapsible-review" key={item.id}><summary><span>{item.employee?.firstName} {item.employee?.lastName} · {item.cycle.name}</span><Status value={item.status} /></summary><ManagerReviewCard item={item} onReload={() => void reload()} onError={setError} /></details>)}
  </main>;
}

function HrReviewCard({ item, onReload, onError }: { item: Appraisal; onReload: () => void; onError: (message: string) => void }) {
  const [feedback, setFeedback] = useState(item.hrFeedback ?? '');
  const [rating, setRating] = useState(item.hrRating ?? item.managerRating ?? 3);
  const [promotion, setPromotion] = useState(item.promotionRecommendation ?? '');
  const [salaryPercent, setSalaryPercent] = useState(item.salaryIncreasePercent ?? '');
  const [salaryAmount, setSalaryAmount] = useState(item.salaryIncreaseAmount ?? '');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'request-revision' | 'reject' | null>(null);
  const pending = ['Manager_Approved', 'HR_Review_Pending'].includes(item.status);
  async function decision(action: 'approve' | 'request-revision' | 'reject') {
    if (action !== 'approve' && !comment.trim()) { onError('Add a decision note before requesting clarification or rejecting.'); return; }
    try {
      setBusy(true);
      if (action === 'approve') await saveHrReview(item.id, { feedback, rating, promotionRecommendation: promotion, salaryIncreasePercent: salaryPercent === '' ? undefined : Number(salaryPercent), salaryIncreaseAmount: salaryAmount === '' ? undefined : Number(salaryAmount), comment });
      else await decideAppraisal('hr', item.id, action, { comment });
      await onReload();
    } catch (err) { onError(err instanceof Error ? err.message : 'Could not save HR review.'); }
    finally { setBusy(false); }
  }
  return <article className="appraisal-card appraisal-review-card">
    <div className="appraisal-card-head"><div className="appraisal-person-title"><span className="appraisal-avatar">{item.employee?.firstName?.slice(0, 1)}{item.employee?.lastName?.slice(0, 1)}</span><div><span className="appraisal-card-kicker">HR REVIEW · {item.employee?.employeeCode}</span><h3>{item.employee?.firstName} {item.employee?.lastName}</h3><span>{item.employee?.designation} · {item.employee?.department?.name ?? 'Unassigned'} · {item.cycle.name}</span></div></div><Status value={item.status} /></div>
    <p><strong>Manager feedback:</strong> {item.managerFeedback || '—'}</p><p><strong>Strengths:</strong> {item.managerStrengths || '—'} <strong> · Improvement areas:</strong> {item.managerImprovementAreas || '—'}</p>
    {item.kpiResponses.map((response) => <div className="appraisal-kpi" key={response.cycleKpiId}><div><strong>{response.cycleKpi.title}</strong><span>Self {response.selfRating ?? '—'} · Manager {response.managerRating ?? '—'}</span></div><span>{response.managerComment}</span></div>)}
    {pending ? <>
      <label>HR feedback<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label><label>HR rating<select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[1,2,3,4,5].map((score) => <option key={score}>{score}</option>)}</select></label>
      <div className="appraisal-confidential-section"><div className="appraisal-section-title"><div><h4>Recommendations</h4><p>Visible only to authorized HR and management reviewers.</p></div><span className="appraisal-confidential-tag">CONFIDENTIAL</span></div><div className="appraisal-two-col"><label>Promotion recommendation<textarea value={promotion} onChange={(event) => setPromotion(event.target.value)} /></label><label>Salary increase percent<input type="number" min="0" max="100" value={salaryPercent} onChange={(event) => setSalaryPercent(event.target.value)} /></label></div>
      <label>Salary increase amount<input type="number" min="0" value={salaryAmount} onChange={(event) => setSalaryAmount(event.target.value)} /></label><label>Decision / clarification note<textarea value={comment} onChange={(event) => setComment(event.target.value)} /></label>
      </div>
      <div className="appraisal-actions"><button disabled={busy} onClick={() => setConfirmAction('request-revision')}>Request clarification</button><button disabled={busy} onClick={() => setConfirmAction('reject')}>Reject</button><button className="primary" disabled={busy} onClick={() => setConfirmAction('approve')}>Approve for management</button></div>
      {confirmAction ? <div className="appraisal-action-confirm" role="alertdialog" aria-label="Confirm HR decision"><div><strong>Confirm {confirmAction.replace('-', ' ')}?</strong><span>{confirmAction === 'approve' ? 'The recommendation will move to management approval.' : 'Your decision note will be shared with the employee.'}</span></div><button type="button" onClick={() => setConfirmAction(null)}>Cancel</button><button type="button" className="primary" disabled={busy} onClick={() => { const action = confirmAction; setConfirmAction(null); void decision(action); }}>Confirm decision</button></div> : null}
    </> : <><p><strong>HR feedback:</strong> {item.hrFeedback || '—'}</p><p><strong>Final rating:</strong> {item.finalRating ?? item.hrRating ?? '—'}</p></>}
  </article>;
}

export function HrAppraisalsPage() {
  const { data, error, setError, reload } = useLoad(fetchHrAppraisals);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const matches = (item: Appraisal) => (!statusFilter || item.status === statusFilter) && (!search || `${item.employee?.firstName ?? ''} ${item.employee?.lastName ?? ''} ${item.employee?.employeeCode ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const pending = (data ?? []).filter((item) => ['Manager_Approved', 'HR_Review_Pending'].includes(item.status) && matches(item));
  const others = (data ?? []).filter((item) => !['Manager_Approved', 'HR_Review_Pending'].includes(item.status) && matches(item));
  return <main className="appraisal-page"><PageHeader eyebrow="HUMAN RESOURCES" title="Appraisal review" description="Verify manager assessments, record HR feedback, and route recommendations to management." />
    <Summary scope="hr" />{error ? <p className="appraisal-error">{error}</p> : null}<div className="appraisal-queue-toolbar"><input aria-label="Search HR appraisals" placeholder="Search by employee name or ID" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter HR appraisals by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{[...new Set((data ?? []).map((item) => item.status))].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select><span>{(data ?? []).length} appraisal records</span></div><SectionTitle title="Pending HR review" description="Manager-approved appraisals ready for HR evaluation." count={pending.length} />
    {pending.map((item) => <HrReviewCard key={item.id} item={item} onReload={() => void reload()} onError={setError} />)}
    {!pending.length ? <p className="appraisal-empty"><strong>No pending HR reviews</strong><span>New appraisals will appear here after manager review.</span></p> : null}<SectionTitle title="Other appraisals" description="Records already routed or finalized." count={others.length} />{others.map((item) => <details className="appraisal-collapsible-review" key={item.id}><summary><span>{item.employee?.firstName} {item.employee?.lastName} · {item.cycle.name}</span><Status value={item.status} /></summary><HrReviewCard item={item} onReload={() => void reload()} onError={setError} /></details>)}
  </main>;
}

export function AdminAppraisalsPage() {
  const { data, error, busy } = useLoad(fetchAdminAppraisals);
  const appraisals = data ?? [];
  return <main className="appraisal-page">
    <PageHeader eyebrow="ADMINISTRATION" title="Appraisal overview" description="Track appraisal progress and review assessment details across the organization." />
    <div className="appraisal-summary">
      {[
        ['Total appraisals', appraisals.length],
        ['In progress', appraisals.filter((item) => !['Completed', 'Rejected'].includes(item.status)).length],
        ['Completed', appraisals.filter((item) => item.status === 'Completed').length],
      ].map(([label, value], index) => <div className={`appraisal-metric appraisal-metric-${index + 1}`} key={String(label)}><span>{label}</span><strong>{value}</strong><i aria-hidden="true" /></div>)}
    </div>
    {error ? <p className="appraisal-error">{error}</p> : null}
    {busy && !data ? <p className="appraisal-loading">Loading appraisals…</p> : null}
    <SectionTitle title="Organization appraisals" description="Review status, employee self-assessment, and reviewer feedback." count={appraisals.length} />
    {appraisals.map((item) => <article className="appraisal-card appraisal-review-card" key={item.id}>
      <div className="appraisal-card-head"><div className="appraisal-person-title"><span className="appraisal-avatar">{item.employee?.firstName?.slice(0, 1)}{item.employee?.lastName?.slice(0, 1)}</span><div><span className="appraisal-card-kicker">{item.employee?.employeeCode} · {item.cycle.name}</span><h3>{item.employee?.firstName} {item.employee?.lastName}</h3><span>{item.employee?.designation} · {item.employee?.department?.name ?? 'Unassigned'}</span></div></div><Status value={item.status} /></div>
      <div className="appraisal-read-grid"><section><h4>Employee reflection</h4><p>{item.selfFeedback || 'No reflection recorded.'}</p></section><section><h4>Manager feedback</h4><p>{item.managerFeedback || 'No manager feedback recorded.'}</p></section></div>
      {item.kpiResponses.length ? <div className="appraisal-read-kpis"><h4>KPI assessments</h4>{item.kpiResponses.map((response) => <div key={response.cycleKpiId}><span>{response.cycleKpi.title}</span><b>Self {response.selfRating ?? '—'} / 5 · Manager {response.managerRating ?? '—'} / 5</b></div>)}</div> : null}
    </article>)}
    {!appraisals.length && !busy ? <p className="appraisal-empty"><strong>No appraisals yet</strong><span>Appraisal records will appear here when a cycle is launched.</span></p> : null}
  </main>;
}

function ManagementReviewCard({ item, onReload, onError }: { item: Appraisal; onReload: () => void; onError: (message: string) => void }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  async function decide(action: 'approve' | 'reject') {
    if (action === 'reject' && !comment.trim()) { onError('Add a decision note before rejecting the recommendation.'); return; }
    try { setBusy(true); await decideAppraisal('management', item.id, action, { comment }); await onReload(); }
    catch (err) { onError(err instanceof Error ? err.message : 'Could not save the final decision.'); }
    finally { setBusy(false); }
  }
  return <article className="appraisal-card appraisal-review-card">
    <div className="appraisal-card-head"><div className="appraisal-person-title"><span className="appraisal-avatar">{item.employee?.firstName?.slice(0, 1)}{item.employee?.lastName?.slice(0, 1)}</span><div><span className="appraisal-card-kicker">FINAL REVIEW · {item.employee?.employeeCode}</span><h3>{item.employee?.firstName} {item.employee?.lastName}</h3><span>{item.employee?.designation} · {item.employee?.department?.name ?? 'Unassigned'} · {item.cycle.name}</span></div></div><Status value={item.status} /></div>
    <div className="appraisal-read-grid"><section><h4>HR evaluation</h4><p><strong>Rating:</strong> {item.hrRating ?? '—'} / 5</p><p>{item.hrFeedback || 'No HR feedback provided.'}</p></section><section><h4>Promotion recommendation</h4><p>{item.promotionRecommendation || 'No promotion recommendation.'}</p></section></div>
    <section className="appraisal-confidential-section"><div className="appraisal-section-title"><div><h4>Compensation recommendation</h4><p>Confidential · management review only</p></div><span className="appraisal-confidential-tag">CONFIDENTIAL</span></div><div className="appraisal-recommendation-value"><strong>{item.salaryIncreasePercent ?? 0}%</strong><span>proposed increase</span><strong>{item.salaryIncreaseAmount == null ? 'Amount not set' : Number(item.salaryIncreaseAmount).toLocaleString()}</strong></div></section>
    <label>Final decision note<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add context for the decision (optional)" /></label>
    <div className="appraisal-actions"><button disabled={busy} onClick={() => setConfirmAction('reject')}>Reject recommendation</button><button className="primary" disabled={busy} onClick={() => setConfirmAction('approve')}>Approve and complete <span aria-hidden="true">→</span></button></div>
    {confirmAction ? <div className="appraisal-action-confirm" role="alertdialog" aria-label="Confirm final appraisal decision"><div><strong>Confirm {confirmAction}?</strong><span>{confirmAction === 'approve' ? 'This completes the appraisal workflow.' : 'A decision note is required for the employee record.'}</span></div><button type="button" onClick={() => setConfirmAction(null)}>Cancel</button><button type="button" className="primary" disabled={busy} onClick={() => { const action = confirmAction; setConfirmAction(null); void decide(action); }}>Confirm decision</button></div> : null}
  </article>;
}

export function ManagementAppraisalsPage() {
  const { data, error, setError, reload } = useLoad(fetchManagementAppraisals);
  const pending = data ?? [];
  return <main className="appraisal-page"><PageHeader eyebrow="MANAGEMENT" title="Final appraisal approvals" description="Review HR evaluation and confidential recommendations before making the final decision." />
    <Summary scope="management" />{error ? <p className="appraisal-error">{error}</p> : null}<SectionTitle title="Pending final approval" description="HR-approved appraisals awaiting management decision." count={pending.length} />
    {pending.map((item) => <ManagementReviewCard key={item.id} item={item} onReload={() => void reload()} onError={setError} />)}
    {!pending.length ? <p className="appraisal-empty"><strong>No final approvals pending</strong><span>HR-approved appraisals will appear here for your decision.</span></p> : null}
  </main>;
}

type Cycle = Awaited<ReturnType<typeof fetchAppraisalCycles>>[number];
export function AppraisalCyclesPage() {
  const { data, error, setError, reload } = useLoad(fetchAppraisalCycles);
  const [name, setName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selfStart, setSelfStart] = useState('');
  const [selfDeadline, setSelfDeadline] = useState('');
  const [reviewDeadline, setReviewDeadline] = useState('');
  const [kpiLines, setKpiLines] = useState('Goals delivery|Performance|40\nQuality|Performance|30\nCollaboration|Values|30');
  const [busy, setBusy] = useState(false);
  const parsedKpis = useMemo(() => kpiLines.split('\n').map((line) => line.split('|')).filter((parts) => parts[0]?.trim()).map((parts, index) => ({ title: parts[0].trim(), category: parts[1]?.trim() || 'Performance', weight: Number(parts[2] ?? 0), required: true, sortOrder: index })), [kpiLines]);
  async function create() {
    try {
      setBusy(true); const cycle = await createAppraisalCycle({ name, periodStart, periodEnd, selfStart, selfDeadline, reviewDeadline });
      await setAppraisalCycleKpis(cycle.id, parsedKpis); setName(''); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the appraisal cycle.'); }
    finally { setBusy(false); }
  }
  async function launch(cycle: Cycle) {
    try { setBusy(true); await launchAppraisalCycle(cycle.id); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not launch the appraisal cycle.'); }
    finally { setBusy(false); }
  }
  async function close(cycle: Cycle) {
    try { setBusy(true); await closeAppraisalCycle(cycle.id); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not close the appraisal cycle.'); }
    finally { setBusy(false); }
  }
  return <main className="appraisal-page"><PageHeader eyebrow="HR ADMINISTRATION" title="Appraisal cycles" description="Set the review period, submission windows, and weighted KPI criteria for your team." />
    {error ? <p className="appraisal-error">{error}</p> : null}<section className="appraisal-card appraisal-cycle-form"><div className="appraisal-form-heading"><div><span className="appraisal-card-kicker">CYCLE SETUP</span><h2>Create a cycle</h2><p>Save a draft first. Employees are notified only after launch.</p></div><span className="appraisal-form-number">01</span></div><label>Cycle name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="FY 2026 annual appraisal" /></label>
      <div className="appraisal-two-col">{[['Period start', periodStart, setPeriodStart], ['Period end', periodEnd, setPeriodEnd], ['Self-appraisal opens', selfStart, setSelfStart], ['Self-appraisal deadline', selfDeadline, setSelfDeadline], ['Review deadline', reviewDeadline, setReviewDeadline]].map(([label, value, setter]) => <label key={label as string}>{label as string}<input type="date" value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} /></label>)}</div>
      <div className="appraisal-kpi-editor"><div className="appraisal-section-title"><div><h4>Performance criteria</h4><p>One KPI per line, formatted as title | category | weight.</p></div><span className={Math.abs(parsedKpis.reduce((sum, kpi) => sum + kpi.weight, 0) - 100) < 0.01 ? 'appraisal-weight-total is-valid' : 'appraisal-weight-total'}>{parsedKpis.reduce((sum, kpi) => sum + kpi.weight, 0)}% total</span></div><textarea rows={4} value={kpiLines} onChange={(event) => setKpiLines(event.target.value)} /></div><div className="appraisal-form-footer"><span>Weights need to add up to 100%.</span><button className="primary" disabled={busy || !name || parsedKpis.length === 0 || Math.abs(parsedKpis.reduce((sum, kpi) => sum + kpi.weight, 0) - 100) >= 0.01} onClick={() => void create()}>Save draft cycle <span aria-hidden="true">→</span></button></div>
    </section><SectionTitle title="Cycles" description="Manage active and previous review periods." count={data?.length ?? 0} />{(data ?? []).map((cycle) => <article className="appraisal-card appraisal-cycle-row" key={cycle.id}><div className="appraisal-cycle-row-title"><span className="appraisal-cycle-symbol" aria-hidden="true">FY</span><div><h3>{cycle.name}</h3><span>{cycle._count.appraisals} employees · {cycle.kpis.length} KPIs</span></div></div><div className="appraisal-cycle-row-actions"><Status value={cycle.status} />{cycle.status === 'Draft' ? <button disabled={busy} onClick={() => void launch(cycle)}>Launch cycle <span aria-hidden="true">→</span></button> : null}{cycle.status === 'Active' ? <button disabled={busy} onClick={() => void close(cycle)}>Close cycle</button> : null}</div></article>)}
    {!data?.length ? <p className="appraisal-empty"><strong>No cycles yet</strong><span>Create a cycle above to begin appraisal planning.</span></p> : null}
  </main>;
}
