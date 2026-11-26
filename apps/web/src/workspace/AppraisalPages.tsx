import { useEffect, useMemo, useState } from 'react';
import {
  createAppraisalCycle,
  closeAppraisalCycle,
  decideAppraisal,
  fetchAppraisalCycles,
  fetchAppraisalAssignmentDirectory,
  previewAppraisalAssignments,
  confirmAppraisalAssignments,
  type AssignmentRequest,
  type AssignmentPreview,
  previewAppraisalImport,
  confirmAppraisalImport,
  fetchAppraisalImportHistory,
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
  updateAppraisalCycle,
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
  const effectiveWeight = (response: Appraisal['kpiResponses'][number]) => {
    const parentWeight = Number(response.cycleKpi.weight);
    return response.cycleKpi.subKpiName?.trim()
      ? parentWeight * Number(response.cycleKpi.subWeight ?? 100) / 100
      : parentWeight;
  };
  const netRating = (value: number | null | undefined, response: Appraisal['kpiResponses'][number]) => value == null ? '-' : (Number(value) * effectiveWeight(response) / 100).toFixed(2);
  const finalSelfRating = item.kpiResponses.reduce((total, response) => total + Number(ratings[response.cycleKpiId]?.rating ?? 0) * effectiveWeight(response) / 100, 0).toFixed(2);
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
      <div className="appraisal-matrix-scroll"><table className="appraisal-rating-matrix"><thead><tr><th>S.No</th><th>KPI</th><th>Check Point</th><th>Sub Weightage</th><th>Weightage</th><th>Self Rating</th><th>Net Rating-Self</th><th>Manager Rating</th><th>Net Rating-Manager</th><th>Self Justification</th></tr></thead><tbody>{item.kpiResponses.map((response) => {
        const group = `${response.cycleKpi.category.toLowerCase()}|${response.cycleKpi.title.toLowerCase()}`;
        const siblings = item.kpiResponses.filter((entry) => `${entry.cycleKpi.category.toLowerCase()}|${entry.cycleKpi.title.toLowerCase()}` === group);
        const first = siblings[0]?.cycleKpiId === response.cycleKpiId;
        return <tr key={response.cycleKpiId}><td>{`${[...new Set(item.kpiResponses.map((entry) => `${entry.cycleKpi.category.toLowerCase()}|${entry.cycleKpi.title.toLowerCase()}`))].indexOf(group) + 1}.${siblings.indexOf(response) + 1}`}</td>{first ? <td rowSpan={siblings.length}>{response.cycleKpi.title}</td> : null}<td>{response.cycleKpi.subKpiName || response.cycleKpi.title}{response.cycleKpi.required ? <small>Required</small> : null}</td><td>{Number(response.cycleKpi.subKpiName?.trim() ? response.cycleKpi.subWeight ?? 100 : response.cycleKpi.weight)}%</td>{first ? <td rowSpan={siblings.length}>{response.cycleKpi.weight}%</td> : null}<td><label className="appraisal-matrix-rating"><span className="sr-only">Self rating for {response.cycleKpi.subKpiName || response.cycleKpi.title}</span><select value={ratings[response.cycleKpiId]?.rating ?? 0} onChange={(event) => setRatings((state) => ({ ...state, [response.cycleKpiId]: { ...state[response.cycleKpiId], rating: Number(event.target.value) } }))}><option value={0}>Choose</option>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}</select></label></td><td>{netRating(ratings[response.cycleKpiId]?.rating, response)}</td><td>{response.managerRating ?? '-'}</td><td>{netRating(response.managerRating, response)}</td><td><input aria-label={`${response.cycleKpi.subKpiName || response.cycleKpi.title} self justification`} value={ratings[response.cycleKpiId]?.comment ?? ''} onChange={(event) => setRatings((state) => ({ ...state, [response.cycleKpiId]: { ...state[response.cycleKpiId], comment: event.target.value } }))} placeholder="Add example or evidence" /></td></tr>;
      })}</tbody><tfoot><tr><th colSpan={6}>Final Rating</th><th>{finalSelfRating}</th><th></th><th>{item.managerRating ?? '-'}</th><th></th></tr></tfoot></table></div>{!ratingsComplete ? <p className="appraisal-validation-note">Complete each required KPI rating before submitting.</p> : null}</div>
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
  const effectiveWeight = (response: Appraisal['kpiResponses'][number]) => {
    const parentWeight = Number(response.cycleKpi.weight);
    return response.cycleKpi.subKpiName?.trim()
      ? parentWeight * Number(response.cycleKpi.subWeight ?? 100) / 100
      : parentWeight;
  };
  const netRating = (value: number | null | undefined, response: Appraisal['kpiResponses'][number]) => value == null ? '-' : (Number(value) * effectiveWeight(response) / 100).toFixed(2);
  const finalSelfRating = item.kpiResponses.reduce((total, response) => total + Number(response.selfRating ?? 0) * effectiveWeight(response) / 100, 0).toFixed(2);
  const finalManagerRating = item.kpiResponses.reduce((total, response) => total + Number(kpis[response.cycleKpiId]?.rating ?? 0) * effectiveWeight(response) / 100, 0).toFixed(2);
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
    <div className="appraisal-matrix-scroll"><table className="appraisal-rating-matrix"><thead><tr><th>S.No</th><th>KPI</th><th>Check Point</th><th>Sub Weightage</th><th>Weightage</th><th>Self Rating</th><th>Net Rating-Self</th><th>Manager Rating</th><th>Net Rating-Manager</th><th>Justification / Remarks</th></tr></thead><tbody>{item.kpiResponses.map((response) => {
      const group = `${response.cycleKpi.category.toLowerCase()}|${response.cycleKpi.title.toLowerCase()}`;
      const siblings = item.kpiResponses.filter((entry) => `${entry.cycleKpi.category.toLowerCase()}|${entry.cycleKpi.title.toLowerCase()}` === group);
      const first = siblings[0]?.cycleKpiId === response.cycleKpiId;
      return <tr key={response.cycleKpiId}><td>{`${[...new Set(item.kpiResponses.map((entry) => `${entry.cycleKpi.category.toLowerCase()}|${entry.cycleKpi.title.toLowerCase()}`))].indexOf(group) + 1}.${siblings.indexOf(response) + 1}`}</td>{first ? <td rowSpan={siblings.length}>{response.cycleKpi.title}</td> : null}<td>{response.cycleKpi.subKpiName || response.cycleKpi.title}</td><td>{Number(response.cycleKpi.subKpiName?.trim() ? response.cycleKpi.subWeight ?? 100 : response.cycleKpi.weight)}%</td>{first ? <td rowSpan={siblings.length}>{response.cycleKpi.weight}%</td> : null}<td>{response.selfRating ?? '-'}</td><td>{netRating(response.selfRating, response)}</td><td>{pending ? <label className="appraisal-matrix-rating"><span className="sr-only">Manager rating for {response.cycleKpi.subKpiName || response.cycleKpi.title}</span><select value={kpis[response.cycleKpiId]?.rating ?? 0} onChange={(event) => setKpis((state) => ({ ...state, [response.cycleKpiId]: { ...state[response.cycleKpiId], rating: Number(event.target.value) } }))}><option value={0}>Choose</option>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}</select></label> : response.managerRating ?? '-'}</td><td>{netRating(pending ? kpis[response.cycleKpiId]?.rating || null : response.managerRating, response)}</td><td>{pending ? <div className="appraisal-matrix-remarks"><span>{response.selfComment || 'No self justification provided.'}</span><input aria-label={`Manager remarks for ${response.cycleKpi.subKpiName || response.cycleKpi.title}`} placeholder="Manager remarks" value={kpis[response.cycleKpiId]?.comment ?? ''} onChange={(event) => setKpis((state) => ({ ...state, [response.cycleKpiId]: { ...state[response.cycleKpiId], comment: event.target.value } }))} /></div> : <span>{response.managerComment || response.selfComment || '-'}</span>}</td></tr>;
    })}</tbody><tfoot><tr><th colSpan={6}>Final Rating</th><th>{finalSelfRating}</th><th></th><th>{finalManagerRating}</th><th></th></tr></tfoot></table></div>
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
function xlsxBlob(rows: string[][]) {
  const xmlEscape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
  const columnName = (number: number) => { let name = ''; for (let value = number + 1; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name; return name; };
  const columnCount = rows.reduce((count, row) => Math.max(count, row.length), 0);
  const columns = Array.from({ length: columnCount }, (_, columnIndex) => {
    const maxLength = rows.reduce((length, row) => Math.max(length, Array.from(row[columnIndex] ?? '').length), 0);
    const width = Math.min(255, Math.max(10, maxLength + 2));
    return `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${width}" customWidth="1"/>`;
  }).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${columns}</cols><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const files: Array<[string, string]> = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="KPI Configuration" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', sheet],
  ];
  const encoder = new TextEncoder();
  const crc32 = (data: Uint8Array) => { let crc = -1; for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ -1) >>> 0; };
  const local: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  for (const [path, content] of files) {
    const name = encoder.encode(path); const data = encoder.encode(content); const crc = crc32(data);
    const header = new Uint8Array(30 + name.length); const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); header.set(name, 30);
    const directory = new Uint8Array(46 + name.length); const d = new DataView(directory.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint32(16, crc, true); d.setUint32(20, data.length, true); d.setUint32(24, data.length, true); d.setUint16(28, name.length, true); d.setUint32(42, offset, true); directory.set(name, 46);
    local.push(header, data); central.push(directory); offset += header.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0); const end = new Uint8Array(22); const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  const parts = [...local, ...central, end].map((part) => { const copy = new ArrayBuffer(part.byteLength); new Uint8Array(copy).set(part); return copy; });
  return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function downloadKpiWorkbook(rows: string[][], fileName: string) {
  const url = URL.createObjectURL(xlsxBlob(rows)); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
}

async function xlsxToCsv(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > 4_000_000) throw new Error('KPI workbook must be smaller than 4 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let at = Math.max(0, bytes.length - 65_557); at <= bytes.length - 22; at += 1) if (view.getUint32(at, true) === 0x06054b50) eocd = at;
  if (eocd < 0) throw new Error('This is not a valid .xlsx workbook.');
  const entries = view.getUint16(eocd + 10, true); let cursor = view.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < entries; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Invalid workbook directory.');
    const method = view.getUint16(cursor + 10, true); const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true); const extraLength = view.getUint16(cursor + 30, true); const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true); const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    let data = bytes.slice(dataOffset, dataOffset + compressedSize);
    if (method === 8) { const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); data = new Uint8Array(await new Response(stream).arrayBuffer()); }
    else if (method !== 0) throw new Error('This workbook uses an unsupported compression method.');
    if (name === 'xl/sharedStrings.xml' || name === 'xl/worksheets/sheet1.xml') files.set(name, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const parser = new DOMParser();
  const sharedXml = files.get('xl/sharedStrings.xml');
  const shared = sharedXml ? Array.from(parser.parseFromString(new TextDecoder().decode(sharedXml), 'application/xml').getElementsByTagName('si')).map((item) => Array.from(item.getElementsByTagName('t')).map((text) => text.textContent ?? '').join('')) : [];
  const sheet = files.get('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('The workbook has no first worksheet.');
  const xml = parser.parseFromString(new TextDecoder().decode(sheet), 'application/xml');
  const output: string[][] = [];
  for (const sheetRow of Array.from(xml.getElementsByTagName('row'))) {
    const values: string[] = [];
    for (const cell of Array.from(sheetRow.getElementsByTagName('c'))) {
      const colName = (cell.getAttribute('r') ?? '').replace(/[0-9]/g, '');
      let column = 0; for (const char of colName) column = column * 26 + char.charCodeAt(0) - 64;
      const cellType = cell.getAttribute('t'); const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
      const value = cellType === 's' ? (shared[Number(raw)] ?? '') : cellType === 'inlineStr' ? (cell.getElementsByTagName('t')[0]?.textContent ?? '') : raw;
      values[column - 1] = value;
    }
    output.push(values.map((value) => value ?? ''));
  }
  const columnIndex = (name: string) => { let value = 0; for (const char of name) value = value * 26 + char.charCodeAt(0) - 64; return value - 1; };
  for (const merge of Array.from(xml.getElementsByTagName('mergeCell'))) {
    const [start, end] = (merge.getAttribute('ref') ?? '').split(':'); if (!start || !end) continue;
    const parseCell = (ref: string) => { const match = ref.match(/^([A-Z]+)(\d+)$/i); return match ? { col: columnIndex(match[1].toUpperCase()), row: Number(match[2]) - 1 } : null; };
    const from = parseCell(start); const to = parseCell(end); if (!from || !to) continue;
    const anchor = output[from.row]?.[from.col] ?? '';
    for (let row = from.row; row <= to.row; row += 1) for (let col = from.col; col <= to.col; col += 1) { output[row] ??= []; if (!output[row][col]) output[row][col] = anchor; }
  }
  return output.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n');
}

function parseCsvRows(csv: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted && char === '"' && csv[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') { row.push(value.trim()); value = ''; }
    else if (!quoted && (char === '\r' || char === '\n')) { row.push(value.trim()); rows.push(row); row = []; value = ''; if (char === '\r' && csv[index + 1] === '\n') index += 1; }
    else value += char;
  }
  if (value || row.length) { row.push(value.trim()); rows.push(row); }
  return rows;
}

function EmployeeAssignmentPanel({ cycleId, onClose, onAssigned }: { cycleId: string; onClose: () => void; onAssigned: () => void }) {
  const [directory, setDirectory] = useState<Awaited<ReturnType<typeof fetchAppraisalAssignmentDirectory>> | null>(null);
  const [mode, setMode] = useState<AssignmentRequest['mode']>('all');
  const [filterValue, setFilterValue] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [excludedCodes, setExcludedCodes] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<NonNullable<AssignmentRequest['rows']>>([]);
  const [fileName, setFileName] = useState('');
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetchAppraisalAssignmentDirectory().then(setDirectory).catch((err) => setError(err instanceof Error ? err.message : 'Could not load active employees.')); }, []);
  const request: AssignmentRequest = { mode, ...(filterValue ? { filterValue } : {}), ...(mode === 'selected' ? { selectedEmployeeCodes: selectedCodes } : {}), ...(mode === 'excel' ? { rows: fileRows } : {}), excludedEmployeeCodes: excludedCodes };
  async function readAssignmentFile(file: File) {
    setError(''); setPreview(null); setFileErrors([]);
    if (file.size > 4_000_000) { setError('Employee assignment workbook must be smaller than 4 MB.'); return; }
    try {
      const text = file.name.toLowerCase().endsWith('.xlsx') ? await xlsxToCsv(file) : await file.text();
      const table = parseCsvRows(text.replace(/^\uFEFF/, '')).filter((line) => line.some((cell) => cell.trim()));
      const headers = (table[0] ?? []).map((header) => header.trim().toLowerCase());
      const expected = ['employee code', 'employee name', 'department', 'designation', 'reporting manager code', 'include'];
      const missing = expected.filter((header) => !headers.includes(header));
      if (missing.length) { setFileErrors([`Missing columns: ${missing.join(', ')}.`]); setFileRows([]); return; }
      const get = (cells: string[], column: string) => cells[headers.indexOf(column)]?.trim() ?? '';
      const mapped = table.slice(1).map((cells) => ({ employeeCode: get(cells, 'employee code'), employeeName: get(cells, 'employee name'), department: get(cells, 'department'), designation: get(cells, 'designation'), reportingManagerCode: get(cells, 'reporting manager code'), include: get(cells, 'include') }));
      const errors = mapped.flatMap((row, index) => [
        ...(!row.employeeCode ? [`Row ${index + 2}: Employee Code is required.`] : []),
        ...(!['yes', 'no'].includes(row.include.toLowerCase()) ? [`Row ${index + 2}: Include must be Yes or No.`] : []),
      ]);
      mapped.forEach((row) => { row.include = row.include.toLowerCase() === 'no' ? 'No' : 'Yes'; });
      setFileRows(mapped); setFileName(file.name); setMode('excel');
      setFileErrors(!mapped.length ? ['The assignment file contains no employee rows.'] : errors);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read the employee assignment file.'); }
  }
  async function showPreview() {
    setBusy(true); setError('');
    try { setPreview(await previewAppraisalAssignments(cycleId, request)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not preview employee assignments.'); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!preview?.canConfirm) return;
    setBusy(true); setError('');
    try { await confirmAppraisalAssignments(cycleId, request); onAssigned(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not assign employees.'); }
    finally { setBusy(false); }
  }
  const template = [['Employee Code', 'Employee Name', 'Department', 'Designation', 'Reporting Manager Code', 'Include']];
  return <section className="appraisal-card appraisal-assignment-panel">
    <div className="appraisal-form-heading"><div><span className="appraisal-card-kicker">EMPLOYEE ASSIGNMENT</span><h2>Assign active employees to this cycle</h2><p>KPI criteria are shared by the cycle. Each employee receives their own appraisal response record.</p></div><button type="button" onClick={onClose}>Close</button></div>
    <div className="appraisal-assignment-toolbar"><button type="button" onClick={() => downloadKpiWorkbook(template, 'employee-assignment-template.xlsx')}>Download assignment Excel template</button><label className="appraisal-grid-import">Import employee Excel / CSV<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readAssignmentFile(file); event.currentTarget.value = ''; }} /></label></div>
    {fileName ? <p>Loaded {fileName}: {fileRows.length} employee rows. Use the Include column to exclude rows.</p> : null}
    {fileErrors.map((item) => <p className="appraisal-error" key={item}>{item}</p>)}
    <label>Assignment method<select value={mode} onChange={(event) => { setMode(event.target.value as AssignmentRequest['mode']); setPreview(null); }}><option value="all">All active employees</option><option value="department">Department-wise</option><option value="designation">Designation-wise</option><option value="manager">Reporting-manager-wise</option><option value="selected">Selected individual employees</option><option value="excel">Excel-based employee assignment</option></select></label>
    {['department', 'designation', 'manager'].includes(mode) ? <label>{mode === 'department' ? 'Department' : mode === 'designation' ? 'Designation' : 'Reporting manager'}<select value={filterValue} onChange={(event) => { setFilterValue(event.target.value); setPreview(null); }}><option value="">Choose one</option>{((mode === 'department' ? directory?.departments : mode === 'designation' ? directory?.designations : directory?.managers.map((manager) => manager.employeeCode)) ?? []).map((item) => <option key={item} value={item}>{mode === 'manager' ? `${directory?.managers.find((manager) => manager.employeeCode === item)?.name} (${item})` : item}</option>)}</select></label> : null}
    {mode === 'selected' ? <div className="appraisal-assignment-checklist"><strong>Select employees ({selectedCodes.length})</strong>{directory?.employees.map((employee) => <label key={employee.id}><input type="checkbox" checked={selectedCodes.includes(employee.employeeCode)} onChange={(event) => { setSelectedCodes((codes) => event.target.checked ? [...codes, employee.employeeCode] : codes.filter((code) => code !== employee.employeeCode)); setPreview(null); }} />{employee.employeeCode} · {employee.employeeName} · {employee.department || 'Unassigned'}</label>)}</div> : null}
    {mode !== 'excel' && directory?.employees.length ? <details className="appraisal-assignment-checklist"><summary>Exclude specific employees</summary>{directory.employees.map((employee) => <label key={employee.id}><input type="checkbox" checked={excludedCodes.includes(employee.employeeCode)} onChange={(event) => { setExcludedCodes((codes) => event.target.checked ? [...codes, employee.employeeCode] : codes.filter((code) => code !== employee.employeeCode)); setPreview(null); }} />{employee.employeeCode} · {employee.employeeName}</label>)}</details> : null}
    {mode === 'excel' && fileRows.length ? <div className="appraisal-assignment-checklist"><strong>File preview: {fileRows.length} rows</strong>{fileRows.slice(0, 12).map((row, index) => <span key={`${row.employeeCode}-${index}`}>Row {index + 2}: {row.employeeCode || '(missing code)'} · Include {row.include || '(missing)'}</span>)}</div> : null}
    {error ? <p className="appraisal-error">{error}</p> : null}
    <div className="appraisal-form-footer"><span>Existing assignments will be kept and counted; retries will not create duplicates.</span><button type="button" disabled={busy || (mode === 'excel' && (!fileRows.length || fileErrors.length > 0))} onClick={() => void showPreview()}>Preview assignments</button></div>
    {preview ? <div className="appraisal-assignment-preview"><div className="appraisal-assignment-counts">{[['Eligible', preview.totalEligible], ['Selected', preview.selectedCount], ['Excluded', preview.excludedCount], ['Already assigned', preview.alreadyAssignedCount], ['To assign', preview.toAssignCount]].map(([label, count]) => <div key={String(label)}><span>{label}</span><strong>{count}</strong></div>)}</div>{preview.errors.map((item, index) => <p className="appraisal-error" key={`${item.row}-${index}`}>Row {item.row || '—'}: {item.message}</p>)}<div className="appraisal-assignment-preview-list">{preview.employees.slice(0, 30).map((employee) => <span key={employee.employeeCode}>{employee.employeeCode} · {employee.name} · {employee.department || 'Unassigned'}{employee.alreadyAssigned ? ' · Already assigned' : ''}</span>)}</div><div className="appraisal-actions"><button type="button" onClick={() => setPreview(null)}>Back to selection</button><button type="button" className="primary" disabled={busy || !preview.canConfirm || preview.toAssignCount === 0} onClick={() => void confirm()}>Confirm assignment</button></div></div> : null}
  </section>;
}

export function AppraisalCyclesPage() {
  const { data, error, setError, reload } = useLoad(fetchAppraisalCycles);
  const [name, setName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selfStart, setSelfStart] = useState('');
  const [selfDeadline, setSelfDeadline] = useState('');
  const [reviewDeadline, setReviewDeadline] = useState('');
  type CriteriaRow = { id: string; category: string; title: string; weight: number; subKpiName: string; subWeight: number; required: boolean; sortOrder: number };
  const [criteriaRows, setCriteriaRows] = useState<CriteriaRow[]>([]);
  const [criteriaActionError, setCriteriaActionError] = useState('');
  const [weightInputErrors, setWeightInputErrors] = useState<Record<string, string>>({});
  const [weightInputDrafts, setWeightInputDrafts] = useState<Record<string, string>>({});
  const [collapsedKpis, setCollapsedKpis] = useState<Set<string>>(new Set());
  const [highlightedCriteriaId, setHighlightedCriteriaId] = useState('');
  const [deleteCriteriaId, setDeleteCriteriaId] = useState('');
  const [criteriaImportOpen, setCriteriaImportOpen] = useState(false);
  const [criteriaImportFileName, setCriteriaImportFileName] = useState('');
  const [editingCycleId, setEditingCycleId] = useState('');
  const [assignmentCycleId, setAssignmentCycleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [importCycleId, setImportCycleId] = useState('');
  const [importFile, setImportFile] = useState<{ name: string; csv?: string; workbookBase64?: string } | null>(null);
  const [importPreview, setImportPreview] = useState<Awaited<ReturnType<typeof previewAppraisalImport>> | null>(null);
  const [importResult, setImportResult] = useState<{ employeesImported: number; appraisalRecordsCreated: number; skippedCount: number } | null>(null);
  const [importHistory, setImportHistory] = useState<Array<{ id: string; fileName: string; status: string; totalRows: number; importedRows: number; failedRows: number; errors: Array<{ row: number; message: string }>; createdAt: string }>>([]);
  const [criteriaImportPreview, setCriteriaImportPreview] = useState<{ rows: CriteriaRow[]; errors: string[] } | null>(null);
  const parsedKpis = useMemo(() => criteriaRows.map((row, index) => ({ title: row.title.trim(), category: row.category.trim(), weight: row.weight, subKpiName: row.subKpiName.trim(), subWeight: row.subWeight, required: row.required, sortOrder: index })), [criteriaRows]);
  const categoryWeights = new Map<string, number>(); const subWeightTotals = new Map<string, number>(); const parentNames = new Map<string, string>();
  const parentKey = (row: Pick<CriteriaRow, 'category' | 'title'>) => `${row.category.trim().toLowerCase()}|${row.title.trim().toLowerCase()}`;
  const roundWeight = (weight: number) => Math.round((weight + Number.EPSILON) * 1000) / 1000;
  const validWeight = (weight: number) => Number.isFinite(weight) && weight >= 0 && weight <= 100 && Math.abs(weight * 1000 - Math.round(weight * 1000)) < 0.000001;
  for (const row of criteriaRows) {
    const key = parentKey(row);
    if (!categoryWeights.has(key)) { categoryWeights.set(key, row.weight); parentNames.set(key, row.title); subWeightTotals.set(key, 0); }
    if (row.subKpiName.trim()) subWeightTotals.set(key, (subWeightTotals.get(key) ?? 0) + row.subWeight);
  }
  function calculateTotalKPIWeightage() {
    return roundWeight([...categoryWeights.values()].reduce((sum, weight) => sum + weight, 0));
  }
  function calculateTotalSubKPIWeightage(kpiId: string) {
    return roundWeight(subWeightTotals.get(kpiId) ?? 0);
  }
  function getRemainingKPIWeightage() {
    return roundWeight(Math.max(0, 100 - calculateTotalKPIWeightage()));
  }
  function getRemainingSubKPIWeightage(kpiId: string) {
    return roundWeight(Math.max(0, 100 - calculateTotalSubKPIWeightage(kpiId)));
  }
  const weightageTotal = calculateTotalKPIWeightage();
  const criteriaErrors = [
    ...criteriaRows.filter((row) => !row.category.trim()).map((row) => `Row ${criteriaRows.indexOf(row) + 1}: KPI name is required.`),
    ...criteriaRows.filter((row) => !validWeight(row.weight)).map((row) => `Row ${criteriaRows.indexOf(row) + 1}: Category weightage for "${row.title}" must be between 0 and 100 with at most 3 decimal places.`),
    ...criteriaRows.filter((row) => !validWeight(row.subWeight)).map((row) => `Row ${criteriaRows.indexOf(row) + 1}: Sub-KPI weightage for "${row.title}" / "${row.subKpiName || 'Unnamed Sub-KPI'}" must be between 0 and 100 with at most 3 decimal places.`),
    ...criteriaRows.filter((row) => row.subKpiName && criteriaRows.filter((other) => parentKey(other) === parentKey(row) && other.subKpiName.toLowerCase() === row.subKpiName.toLowerCase()).length > 1).map((row) => `Duplicate Sub-KPI “${row.subKpiName}” under ${row.category}.`),
    ...criteriaRows.filter((row) => !row.subKpiName.trim()).map((row) => `Row ${criteriaRows.indexOf(row) + 1}: Sub-KPI name is required.`),
    ...[...categoryWeights.entries()].filter(([key, weight]) => criteriaRows.some((row) => parentKey(row) === key && Math.abs(row.weight - weight) > 0.001)).map(([key]) => `All rows under ${parentNames.get(key)} must use the same KPI weight.`),
    ...Object.values(weightInputErrors),
    ...[...subWeightTotals.entries()].filter(([, total]) => Math.abs(total - 100) >= 0.001).map(([key, total]) => `${parentNames.get(key)}: Sub-KPI weightage totals ${roundWeight(total)}%, expected 100%.`),
    ...(weightageTotal > 100 ? [`Total KPI weightage is ${weightageTotal}%, which exceeds 100%.`] : []),
    ...(weightageTotal < 100 ? [`Total KPI weightage is ${weightageTotal}%, not 100%.`] : []),
  ];
  const dateErrors = [
    periodEnd && periodStart && periodEnd < periodStart ? 'Period end must be on or after period start.' : '',
    selfDeadline && selfStart && selfDeadline < selfStart ? 'Self-appraisal deadline must be on or after its opening date.' : '',
    reviewDeadline && selfDeadline && reviewDeadline < selfDeadline ? 'Review deadline must be on or after the self-appraisal deadline.' : '',
  ].filter(Boolean);
  const displayCriteriaRows = [...criteriaRows.reduce((groups, row) => {
    const key = row.category.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), row]);
    return groups;
  }, new Map<string, CriteriaRow[]>()).values()].flat();
  const visibleCriteriaRows = displayCriteriaRows.filter((row) => !collapsedKpis.has(row.category.toLowerCase()) || displayCriteriaRows.find((item) => item.category.toLowerCase() === row.category.toLowerCase())?.id === row.id);
  async function create() {
    try {
      setBusy(true); await createAppraisalCycle({ name, periodStart, periodEnd, selfStart, selfDeadline, reviewDeadline, kpis: parsedKpis }); setName(''); setCriteriaRows([]); setWeightInputErrors({}); setWeightInputDrafts({}); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the appraisal cycle.'); }
    finally { setBusy(false); }
  }
  async function saveConfiguration() {
    try { setBusy(true); await updateAppraisalCycle(editingCycleId, { name, periodStart, periodEnd, selfStart, selfDeadline, reviewDeadline, kpis: parsedKpis }); setEditingCycleId(''); setWeightInputErrors({}); setWeightInputDrafts({}); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update KPI configuration.'); }
    finally { setBusy(false); }
  }
  function editConfiguration(cycle: Cycle) {
    setEditingCycleId(cycle.id);
    setWeightInputErrors({});
    setWeightInputDrafts({});
    setName(cycle.name); setPeriodStart(cycle.periodStart.slice(0, 10)); setPeriodEnd(cycle.periodEnd.slice(0, 10));
    setSelfStart(cycle.selfStart.slice(0, 10)); setSelfDeadline(cycle.selfDeadline.slice(0, 10)); setReviewDeadline(cycle.reviewDeadline.slice(0, 10));
    setCriteriaRows(cycle.kpis.map((kpi, index) => ({ id: `edit-${index}`, category: kpi.subKpiName ? kpi.category : kpi.title, title: kpi.title, weight: Number(kpi.weight), subKpiName: kpi.subKpiName ?? '', subWeight: Number(kpi.subWeight ?? 100), required: kpi.required, sortOrder: index })));
  }
  function addKpi() {
    setCriteriaActionError('');
    const remaining = getRemainingKPIWeightage();
    if (remaining <= 0) return;
    const id = crypto.randomUUID();
    let nextNumber = criteriaRows.length + 1;
    while (criteriaRows.some((row) => row.title.toLowerCase() === `new kpi ${nextNumber}`.toLowerCase())) nextNumber += 1;
    const newName = `New KPI ${nextNumber}`;
    setCriteriaRows((rows) => [...rows, { id, category: newName, title: newName, weight: remaining, subKpiName: '', subWeight: 0, required: true, sortOrder: rows.length }]);
    setHighlightedCriteriaId(id);
    window.setTimeout(() => document.getElementById(`kpi-name-${id}`)?.focus(), 0);
  }
  function addSubKpi(key: string) {
    const pendingSubKpi = criteriaRows.find((row) => parentKey(row) === key && !row.subKpiName.trim());
    if (pendingSubKpi) { document.getElementById(`subkpi-${pendingSubKpi.id}`)?.focus(); return; }
    let newId = '';
    setCriteriaRows((rows) => {
      const siblings = rows.filter((row) => parentKey(row) === key);
      const total = roundWeight(siblings.reduce((sum, row) => sum + (row.subKpiName.trim() ? row.subWeight : 0), 0));
      if (!siblings.length || total >= 100) return rows;
      const parent = siblings[0];
      const remaining = roundWeight(100 - total);
      const lastSiblingIndex = rows.reduce((last, row, index) => parentKey(row) === key ? index : last, -1);
      const next = [...rows];
      newId = crypto.randomUUID();
      next.splice(lastSiblingIndex + 1, 0, { ...parent, id: newId, subKpiName: '', subWeight: remaining, sortOrder: lastSiblingIndex + 1 });
      return next.map((row, index) => ({ ...row, sortOrder: index }));
    });
    window.setTimeout(() => { if (newId) { setHighlightedCriteriaId(newId); document.getElementById(`subkpi-${newId}`)?.focus(); } }, 0);
  }
  function updateCriteria(id: string, field: 'category' | 'title' | 'weight' | 'subKpiName' | 'subWeight', value: string) {
    setCriteriaRows((rows) => {
      const target = rows.find((row) => row.id === id);
      if (!target) return rows;
      if (field === 'weight') { const percentage = value === '' ? 0 : Number(value); return rows.map((row) => parentKey(row) === parentKey(target) ? { ...row, weight: percentage } : row); }
      if (field === 'category' || field === 'title') return rows.map((row) => parentKey(row) === parentKey(target) ? { ...row, category: value, title: value } : row);
      if (field === 'subKpiName' && value.trim() && target.subWeight === 0) {
        const allocated = rows.filter((row) => row.id !== id && parentKey(row) === parentKey(target) && row.subKpiName.trim()).reduce((sum, row) => sum + row.subWeight, 0);
        const remaining = Math.max(0, 100 - allocated);
        return rows.map((row) => row.id === id ? { ...row, subKpiName: value, subWeight: remaining } : row);
      }
      return rows.map((row) => row.id === id ? { ...row, [field]: field === 'subWeight' ? (value === '' ? 0 : Number(value)) : value } : row);
    });
  }
  function weightErrorMessage(row: CriteriaRow, field: 'weight' | 'subWeight') {
    const label = field === 'weight' ? 'Category' : 'Sub-KPI';
    return `${label} weightage for "${row.title}"${field === 'subWeight' ? ` / "${row.subKpiName || 'Unnamed Sub-KPI'}"` : ''} must be between 0 and 100 with at most 3 decimal places.`;
  }
  function getWeightValidationError(row: CriteriaRow, field: 'weight' | 'subWeight', value: string) {
    if (value !== '' && !/^\d*(?:\.\d{0,3})?$/.test(value)) return weightErrorMessage(row, field);
    if (value === '.') return '';
    const numericValue = value === '' ? 0 : Number(value);
    if (!Number.isFinite(numericValue) || numericValue > 100) return weightErrorMessage(row, field);
    if (field === 'weight') {
      const currentCategoryWeight = categoryWeights.get(parentKey(row)) ?? 0;
      const maximum = roundWeight(Math.max(0, getRemainingKPIWeightage() + currentCategoryWeight));
      if (numericValue > maximum) return `Total category weightage cannot exceed 100%. Maximum available for "${row.title}" is ${maximum}%.`;
    } else {
      const siblings = criteriaRows.filter((item) => parentKey(item) === parentKey(row) && item.id !== row.id);
      const allocatedElsewhere = siblings.reduce((total, item) => total + item.subWeight, 0);
      const maximum = roundWeight(Math.max(0, 100 - allocatedElsewhere));
      if (numericValue > maximum) return `Sub-KPI total under "${row.title}" cannot exceed 100%. Maximum available for "${row.subKpiName || 'Unnamed Sub-KPI'}" is ${maximum}%.`;
    }
    return '';
  }
  function updateWeight(row: CriteriaRow, field: 'weight' | 'subWeight', value: string) {
    const draftId = `${row.id}:${field}`;
    setWeightInputDrafts((current) => ({ ...current, [draftId]: value }));
    const errorId = `${row.id}:${field}`;
    const validationError = getWeightValidationError(row, field, value);
    if (validationError) {
      setWeightInputErrors((current) => ({ ...current, [errorId]: validationError }));
      return;
    }
    if (value === '.') {
      setWeightInputErrors((current) => ({ ...current, [errorId]: weightErrorMessage(row, field) }));
      return;
    }
    setWeightInputErrors((current) => {
      const next = { ...current };
      delete next[errorId];
      return next;
    });
    updateCriteria(row.id, field, value);
  }
  function handleWeightKeyDown(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; preventDefault: () => void; currentTarget: { value: string } }, row: CriteriaRow, field: 'weight' | 'subWeight') {
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && !/^\d$/.test(event.key) && !(event.key === '.' && !event.currentTarget.value.includes('.'))) {
      event.preventDefault();
      setWeightInputErrors((current) => ({ ...current, [`${row.id}:${field}`]: weightErrorMessage(row, field) }));
    }
  }
  function handleWeightPaste(event: { clipboardData: { getData: (type: string) => string }; preventDefault: () => void }, row: CriteriaRow, field: 'weight' | 'subWeight') {
    const pasted = event.clipboardData.getData('text').trim();
    const validationError = getWeightValidationError(row, field, pasted);
    if (validationError) {
      event.preventDefault();
      setWeightInputErrors((current) => ({ ...current, [`${row.id}:${field}`]: validationError }));
    }
  }
  function finishWeightInput(row: CriteriaRow, field: 'weight' | 'subWeight') {
    const draftId = `${row.id}:${field}`;
    setWeightInputDrafts((current) => {
      const next = { ...current };
      delete next[draftId];
      return next;
    });
  }
  function deleteCriteria(id: string) { setCriteriaRows((rows) => rows.filter((row) => row.id !== id).map((row, index) => ({ ...row, sortOrder: index }))); setWeightInputErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${id}:`)))); setWeightInputDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${id}:`)))); setDeleteCriteriaId(''); }
  async function previewCriteriaImport(file: File) {
    setCriteriaImportPreview(null);
    setCriteriaImportFileName(file.name);
    setCriteriaImportOpen(true);
    if (file.size > 4_000_000) { setError('KPI template must be smaller than 4 MB.'); return; }
    let text: string;
    try { text = file.name.toLowerCase().endsWith('.xlsx') ? await xlsxToCsv(file) : await file.text(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not read the KPI template.'); return; }
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    const split = (line: string) => { const cells: string[] = []; let value = ''; let quoted = false; for (let i = 0; i < line.length; i += 1) { const char = line[i]; if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; } else value += char; } cells.push(value.trim()); return cells; };
    const headers = split(lines[0]).map((header) => header.toLowerCase());
    const names = ['kpi name', 'kpi weightage', 'sub-kpi name', 'sub-kpi weightage'];
    const indices = names.map((name) => headers.indexOf(name));
    const errors: string[] = indices.some((index) => index < 0) ? [`Missing required headers: ${names.filter((_, index) => indices[index] < 0).join(', ')}.`] : [];
    const grouped = new Map<string, CriteriaRow>();
    const imported: CriteriaRow[] = [];
    const importedRowNumbers: number[] = [];
    const seenSubKpis = new Set<string>();
    if (!errors.length) lines.slice(1).forEach((line, offset) => {
      const values = split(line); const rowNumber = offset + 2;
      const title = values[indices[0]] ?? ''; const weightText = values[indices[1]] ?? ''; const weight = Number(weightText); const subKpiName = values[indices[2]] ?? ''; const subWeightText = values[indices[3]] ?? ''; const subWeight = Number(subWeightText);
      if (!title) errors.push(`Row ${rowNumber}: Missing KPI Name.`);
      if (!/^\d+(?:\.\d{1,3})?$/.test(weightText) || !validWeight(weight)) errors.push(`Row ${rowNumber}: KPI "${title}" category weightage must be between 0 and 100 with at most 3 decimal places.`);
      if (!subKpiName) errors.push(`Row ${rowNumber}: Missing Sub-KPI Name.`);
      if (!/^\d+(?:\.\d{1,3})?$/.test(subWeightText) || !validWeight(subWeight)) errors.push(`Row ${rowNumber}: KPI "${title}" / Sub-KPI "${subKpiName}" weightage must be between 0 and 100 with at most 3 decimal places.`);
      const key = title.toLowerCase();
      const duplicateKey = `${key}|${subKpiName.toLowerCase()}`;
      if (seenSubKpis.has(duplicateKey)) errors.push(`Row ${rowNumber}: Duplicate Sub-KPI “${subKpiName}” under ${title}.`);
      seenSubKpis.add(duplicateKey);
      if (!grouped.has(key)) { grouped.set(key, { id: crypto.randomUUID(), category: title, title, weight, subKpiName, subWeight, required: true, sortOrder: imported.length }); }
      else { const parent = grouped.get(key)!; if (Math.abs(parent.weight - weight) > 0.001) errors.push(`Row ${rowNumber}: KPI Weightage differs from other rows for ${title}.`); grouped.set(key, { ...parent, id: crypto.randomUUID(), subKpiName, subWeight, sortOrder: imported.length }); }
      imported.push(grouped.get(key)!);
      importedRowNumbers.push(rowNumber);
    });
    const parentTotal = roundWeight([...grouped.values()].reduce((sum, parent) => sum + parent.weight, 0));
    if (Math.abs(parentTotal - 100) >= 0.001 && imported.length) {
      const lastRow = imported[imported.length - 1];
      errors.push(`Row ${importedRowNumbers[importedRowNumbers.length - 1]}: KPI "${lastRow.title}" / Sub-KPI "${lastRow.subKpiName}" brings total category weightage to ${parentTotal}%; expected exactly 100%.`);
    }
    for (const [key, parent] of grouped) {
      const rows = imported.map((row, index) => ({ row, rowNumber: importedRowNumbers[index] })).filter(({ row }) => row.title.toLowerCase() === key);
      if (rows.every(({ row }) => validWeight(row.subWeight))) {
        const total = roundWeight(rows.reduce((sum, { row }) => sum + row.subWeight, 0));
        if (Math.abs(total - 100) > 0.001) {
          const lastRow = rows[rows.length - 1];
          errors.push(`Row ${lastRow.rowNumber}: KPI "${parent.title}" / Sub-KPI "${lastRow.row.subKpiName}" total is ${total}%; expected 100%.`);
        }
      }
    }
    setCriteriaImportPreview({ rows: imported, errors });
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
  async function previewImport() {
    if (!importFile || !importCycleId) return;
    try { setBusy(true); setImportResult(null); setImportPreview(await previewAppraisalImport({ cycleId: importCycleId, fileName: importFile.name, csv: importFile.csv, workbookBase64: importFile.workbookBase64 })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not validate the CSV.'); }
    finally { setBusy(false); }
  }
  async function confirmImport() {
    if (!importFile || !importCycleId || !importPreview?.canImport) return;
    try { setBusy(true); const result = await confirmAppraisalImport({ cycleId: importCycleId, fileName: importFile.name, csv: importFile.csv, workbookBase64: importFile.workbookBase64 }); setImportResult(result); setImportFile(null); setImportPreview(null); await reload(); setImportHistory(await fetchAppraisalImportHistory()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not import the CSV.'); try { setImportHistory(await fetchAppraisalImportHistory()); } catch { /* keep the import error visible */ } }
    finally { setBusy(false); }
  }
  useEffect(() => { void fetchAppraisalImportHistory().then(setImportHistory).catch(() => undefined); }, []);
  function cycleCriteriaValid(cycle: Cycle) {
    if (!cycle.kpis.length || cycle.kpis.some((kpi) => !kpi.title.trim() || !kpi.category.trim())) return false;
    if (cycle.kpis.some((kpi) => !validWeight(Number(kpi.weight)) || !validWeight(Number(kpi.subWeight ?? 100)))) return false;
    const hierarchical = cycle.kpis.some((kpi) => Boolean(kpi.subKpiName?.trim()));
    if (!hierarchical) return Math.abs(cycle.kpis.reduce((sum, kpi) => sum + Number(kpi.weight), 0) - 100) < 0.01;
    const parents = new Map<string, number>(); const subs = new Map<string, number>(); const seen = new Set<string>();
    for (const kpi of cycle.kpis) {
      const category = kpi.category.toLowerCase(); const group = `${category}|${kpi.title.toLowerCase()}`; const weight = Number(kpi.weight);
      if (parents.has(group) && Math.abs(parents.get(group)! - weight) > 0.001) return false;
      parents.set(group, weight);
      if (!kpi.subKpiName?.trim()) return false;
      const combo = `${group}|${kpi.subKpiName.toLowerCase()}`;
      if (seen.has(combo)) return false;
      seen.add(combo); subs.set(group, (subs.get(group) ?? 0) + Number(kpi.subWeight ?? 100));
    }
    return Math.abs([...parents.values()].reduce((sum, weight) => sum + weight, 0) - 100) < 0.01 && [...subs.values()].every((weight) => Math.abs(weight - 100) < 0.01);
  }
  return <main className="appraisal-page"><PageHeader eyebrow="HR ADMINISTRATION" title="Appraisal cycles" description="Set the review period, submission windows, and weighted KPI criteria for your team." />
    {error ? <p className="appraisal-error">{error}</p> : null}<section className="appraisal-card appraisal-cycle-form">    <div className="appraisal-form-heading"><div><span className="appraisal-card-kicker">BULK EXCEL / CSV IMPORT</span><h2>Import employee appraisals</h2><p>Template includes all checkpoint rows. {data?.find((cycle) => cycle.id === importCycleId)?.status === 'Active' ? 'For an active cycle, enter EmployeeCode on every row; employees who already have an appraisal cannot be imported again.' : 'Enter EmployeeCode for employee-specific imports, or leave EmployeeCode blank on every row to apply the same data to all active employees.'} Net rating columns are recalculated during import.</p></div><button type="button" onClick={() => { const rows: string[][] = [['EmployeeCode','EmployeeName','Department','Designation','AppraisalPeriod','KPICategory','KPIName','KPIWeightage','SubKPIName','SubKPIWeightage','Action','SelfRating','SelfJustification','NetRatingSelf','ManagerRating','ManagerRemarks','NetRatingManager'], ...[['Key Competencies Areas','25','Process Adherence','20'],['Key Competencies Areas','25','Accountability/Ownership of tasks','30'],['Key Competencies Areas','25','Problem solving/trouble shooting capabilities','20'],['Key Competencies Areas','25','No. of Appreciations/Escalations received from clients','15'],['Key Competencies Areas','25',"Initiatives to take new POC's/Pilots",'15'],['Personal Competencies Areas','25','Development of new skills/learnings/certificates','25'],['Personal Competencies Areas','25','Proactiveness in highlighting risks','20'],['Personal Competencies Areas','25','Taking initiative beyond defined role','20'],['Personal Competencies Areas','25','Cross-team collaboration','15'],['Personal Competencies Areas','25','Guide/help colleagues to increase efficiency','20'],['Process & Time Management','20','Daily availability and active participation','55'],['Process & Time Management','20','Company and/or client process','45'],['Adaptability & Innovation','30','Flexibility to adopt challenges','30'],['Adaptability & Innovation','30','Adopt new requirements','20'],['Adaptability & Innovation','30','Active involvement in company events','20'],['Adaptability & Innovation','30','New initiatives and driving them to closure','30']].map(([category,weight,checkpoint,share]) => ['','','','','',category,category,weight,checkpoint,share,'','','','','','',''])]; downloadKpiWorkbook(rows, 'appraisal-import-template.xlsx'); }}>Download Excel template</button></div>{importResult ? <p className="appraisal-allocation-note is-valid" role="status">Import successful: {importResult.employeesImported} employees, {importResult.appraisalRecordsCreated} appraisal records created, {importResult.skippedCount} skipped.</p> : null}<label>Appraisal cycle<select value={importCycleId} onChange={(event) => { setImportCycleId(event.target.value); setImportPreview(null); }}><option value="">Choose a cycle</option>{(data ?? []).filter((cycle) => cycle.status === 'Draft' || cycle.status === 'Active').sort((left, right) => Number(right.status === 'Active') - Number(left.status === 'Active')).map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name} ({cycle.status})</option>)}</select></label>    <label>Excel or CSV file<input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { if (file.size > 4_000_000) throw new Error('Import file exceeds the 4 MB limit.'); const isXlsx = file.name.toLowerCase().endsWith('.xlsx'); let payload: { csv?: string; workbookBase64?: string }; if (isXlsx) { const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)); payload = { workbookBase64: btoa(binary) }; } else payload = { csv: await file.text() }; setImportFile({ name: file.name, ...payload }); setImportPreview(null); setError(''); } catch (err) { setError(err instanceof Error ? err.message : 'Could not read import file.'); setImportFile(null); } }} /></label><div className="appraisal-form-footer"><span>{importFile?.name ?? 'Select an Excel or CSV file up to 4 MB.'}</span>{importFile ? <button type="button" onClick={() => { setImportFile(null); setImportPreview(null); setError(''); }}>Clear file</button> : null}<button disabled={busy || !importFile || !importCycleId} onClick={() => void previewImport()}>Preview import</button>{importPreview?.canImport ? <button className="primary" disabled={busy} onClick={() => void confirmImport()}>Confirm import</button> : null}</div>{importPreview ? <><p>{importPreview.totalRows} rows · {importPreview.validRows} valid · {importPreview.invalidRows} invalid</p>{importPreview.errors.map((item, index) => <p className="appraisal-error" key={`${item.row}-${index}`}>Row {item.row || '—'}: {item.message}</p>)}</> : null}<div>{importHistory.slice(0, 5).map((item) => <p key={item.id}>{item.fileName} · {item.importedRows}/{item.totalRows} rows imported · {new Date(item.createdAt).toLocaleString()} {item.errors?.length ? <a download={`${item.fileName.replace(/\.csv$/i, '')}-errors.csv`} href={`data:text/csv;charset=utf-8,${encodeURIComponent(`Row,Error\n${item.errors.map((entry) => `${entry.row},"${entry.message.replaceAll('"', '""')}"`).join('\n')}\n`)}`}>Download errors</a> : null}</p>)}</div></section><section className="appraisal-card appraisal-cycle-form"><div className="appraisal-form-heading"><div><span className="appraisal-card-kicker">CYCLE SETUP</span><h2>{editingCycleId ? 'Edit a draft cycle' : 'Create a cycle'}</h2><p>{editingCycleId ? 'Update cycle dates and criteria before launching.' : 'Save a draft first. Employees are notified only after launch.'}</p></div><span className={`appraisal-cycle-state ${criteriaErrors.length === 0 && dateErrors.length === 0 && name.trim() && periodStart && periodEnd && selfStart && selfDeadline && reviewDeadline ? 'is-ready' : 'is-incomplete'}`}><i />{criteriaErrors.length === 0 && dateErrors.length === 0 && name.trim() && periodStart && periodEnd && selfStart && selfDeadline && reviewDeadline ? 'Ready to launch' : 'Draft - Incomplete'}</span></div><label>Cycle name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="FY 2026 annual appraisal" /></label>
      <div className="appraisal-two-col">{[['Period start', periodStart, setPeriodStart], ['Period end', periodEnd, setPeriodEnd], ['Self-appraisal opens', selfStart, setSelfStart], ['Self-appraisal deadline', selfDeadline, setSelfDeadline], ['Review deadline', reviewDeadline, setReviewDeadline]].map(([label, value, setter]) => <label key={label as string}>{label as string}<input type="date" value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} /></label>)}</div>
      <div className="appraisal-kpi-editor">
        <div className="appraisal-section-title"><div><h4>Performance criteria</h4><p>Configure parent KPI allocations totaling 100%. Each KPI’s Sub-KPI allocations are independent and must also total 100%.</p></div></div>
        <div className="appraisal-weightage-cards"><article className={weightageTotal === 100 ? 'is-valid' : weightageTotal > 100 ? 'is-over' : 'is-pending'}><span>Total KPI weightage</span><strong>{weightageTotal}% <small>/ 100%</small></strong></article><article className={weightageTotal === 100 ? 'is-valid' : weightageTotal > 100 ? 'is-over' : 'is-pending'}><span>Remaining weightage</span><strong>{Math.round((100 - weightageTotal) * 100) / 100}%</strong></article><article><span>KPI categories</span><strong>{categoryWeights.size} <small>{categoryWeights.size === 1 ? 'category' : 'categories'}</small></strong></article></div>
        {criteriaErrors.length ? <p className={`appraisal-allocation-note ${weightageTotal > 100 ? 'is-over' : ''}`} role="status">{weightageTotal > 100 ? `KPI allocation exceeds 100% by ${roundWeight(weightageTotal - 100)}%.` : `Remaining category weightage: ${getRemainingKPIWeightage()}%. Every Sub-KPI group must total 100% independently.`}</p> : null}
        <div className="appraisal-grid-toolbar"><div className="appraisal-grid-toolbar-label"><strong>Performance Criteria</strong><span>Manage KPI groups and allocations</span></div><div className="appraisal-grid-toolbar-actions">
          <button type="button" title="Download an Excel template" onClick={() => downloadKpiWorkbook([['KPI Name', 'KPI Weightage', 'Sub-KPI Name', 'Sub-KPI Weightage'], ['Key Competencies Areas', '25', 'Process Adherence', '20'], ['Key Competencies Areas', '25', 'Accountability / Ownership', '30'], ['Key Competencies Areas', '25', 'Problem Solving', '20'], ['Key Competencies Areas', '25', 'Client Feedback', '15'], ['Key Competencies Areas', '25', 'Initiatives and Pilots', '15'], ['Personal Competencies Areas', '25', 'Skills and Learning', '25'], ['Personal Competencies Areas', '25', 'Risk Proactivity', '20'], ['Personal Competencies Areas', '25', 'Individual Initiative', '20'], ['Personal Competencies Areas', '25', 'Cross-team Collaboration', '15'], ['Personal Competencies Areas', '25', 'Efficiency', '20'], ['Process & Time Management', '20', 'Daily Availability', '55'], ['Process & Time Management', '20', 'Process Participation', '45'], ['Adaptability & Innovation', '30', 'Flexibility', '30'], ['Adaptability & Innovation', '30', 'Adopt New Requirements', '20'], ['Adaptability & Innovation', '30', 'Active Involvement', '20'], ['Adaptability & Innovation', '30', 'New Initiatives', '30']], 'appraisal-kpi-template.xlsx')}>Download Template</button>
          <button type="button" title="Import criteria from Excel or CSV" onClick={() => setCriteriaImportOpen(true)}>Import Excel / CSV</button>
          <button type="button" title="Export current KPI criteria" onClick={() => downloadKpiWorkbook([['KPI Name', 'KPI Weightage', 'Sub-KPI Name', 'Sub-KPI Weightage'], ...criteriaRows.map((row) => [row.title, String(row.weight), row.subKpiName, String(row.subWeight)])], 'appraisal-kpis.xlsx')}>Export Excel</button>
          {getRemainingKPIWeightage() > 0 ? <button className="appraisal-add-kpi" type="button" onClick={addKpi}>+ Add KPI</button> : null}
        </div></div>
        <div className="appraisal-grid-scroll"><table className="appraisal-kpi-grid"><thead><tr><th>S.No</th><th>KPI Category / KPI Name</th><th>Category Weightage (%)</th><th>Sub-KPI Name</th><th>Sub-KPI Weightage (%)</th><th>Actions</th></tr></thead><tbody>
          {visibleCriteriaRows.map((row, index) => {
            const siblings = visibleCriteriaRows.filter((item) => parentKey(item) === parentKey(row));
            const firstSibling = siblings[0]?.id === row.id; const lastSibling = siblings[siblings.length - 1]?.id === row.id;
            const key = parentKey(row);
            const groupNumber = [...new Set(displayCriteriaRows.map((item) => parentKey(item)))].indexOf(key) + 1;
            const subTotal = calculateTotalSubKPIWeightage(key);
            const remaining = getRemainingSubKPIWeightage(key);
            const parentMaximum = Math.min(100, roundWeight(getRemainingKPIWeightage() + (categoryWeights.get(key) ?? 0)));
            const subMaximum = Math.min(100, roundWeight(remaining + row.subWeight));
            return <tr key={row.id} className={`${firstSibling ? 'appraisal-grid-group-start ' : ''}${highlightedCriteriaId === row.id ? 'is-new' : ''}`} onAnimationEnd={() => { if (highlightedCriteriaId === row.id) setHighlightedCriteriaId(''); }}>
              {firstSibling ? <td rowSpan={siblings.length} className="appraisal-grid-number">{groupNumber}</td> : null}
              {firstSibling ? <td rowSpan={siblings.length} className="appraisal-grid-parent-cell"><button className="appraisal-group-toggle" type="button" aria-label={`${collapsedKpis.has(row.category.toLowerCase()) ? 'Expand' : 'Collapse'} ${row.title}`} onClick={() => setCollapsedKpis((current) => { const next = new Set(current); const key = row.category.toLowerCase(); if (next.has(key)) next.delete(key); else next.add(key); return next; })}>{collapsedKpis.has(row.category.toLowerCase()) ? '+' : '-'}</button><input id={`kpi-name-${row.id}`} aria-label={`KPI name ${row.title}`} aria-invalid={!row.title.trim()} title={!row.title.trim() ? 'KPI name is required' : undefined} value={row.title} onChange={(event) => updateCriteria(row.id, 'category', event.target.value)} /></td> : null}
              {firstSibling ? <td rowSpan={siblings.length} className="appraisal-grid-parent-cell"><div className="appraisal-grid-weight"><input type="number" min="0" max={parentMaximum} step="1" aria-invalid={Boolean(weightInputErrors[`${row.id}:weight`]) || !validWeight(row.weight) || weightageTotal > 100} value={weightInputDrafts[`${row.id}:weight`] ?? row.weight} onKeyDown={(event) => handleWeightKeyDown(event, row, 'weight')} onPaste={(event) => handleWeightPaste(event, row, 'weight')} onChange={(event) => updateWeight(row, 'weight', event.target.value)} onBlur={() => finishWeightInput(row, 'weight')} /><span>%</span></div>{weightInputErrors[`${row.id}:weight`] ? <small className="appraisal-grid-input-error" role="alert">{weightInputErrors[`${row.id}:weight`]}</small> : null}<small>Parent Weightage: {roundWeight(row.weight)}%</small></td> : null}
              <td><input id={`subkpi-${row.id}`} aria-label={`Sub-KPI name row ${index + 1}`} aria-invalid={!row.subKpiName.trim()} title={!row.subKpiName.trim() ? 'Sub-KPI name is required' : undefined} value={row.subKpiName} onChange={(event) => updateCriteria(row.id, 'subKpiName', event.target.value)} placeholder="Enter Sub-KPI" /></td>
              <td><div className="appraisal-grid-weight"><input type="number" min="0" max={subMaximum} step="1" aria-invalid={Boolean(weightInputErrors[`${row.id}:subWeight`]) || !validWeight(row.subWeight) || subTotal > 100} value={weightInputDrafts[`${row.id}:subWeight`] ?? row.subWeight} onKeyDown={(event) => handleWeightKeyDown(event, row, 'subWeight')} onPaste={(event) => handleWeightPaste(event, row, 'subWeight')} onChange={(event) => updateWeight(row, 'subWeight', event.target.value)} onBlur={() => finishWeightInput(row, 'subWeight')} /></div>{weightInputErrors[`${row.id}:subWeight`] ? <small className="appraisal-grid-input-error" role="alert">{weightInputErrors[`${row.id}:subWeight`]}</small> : null}{lastSibling ? <small className={`appraisal-grid-remaining ${Math.abs(subTotal - 100) < 0.001 ? 'is-valid' : subTotal > 100 ? 'is-over' : ''}`}><span className="appraisal-progress-track"><i style={{ width: `${Math.min(100, Math.max(0, subTotal))}%` }} /></span>Sub-KPI Total: {subTotal}% / 100% · Remaining: {remaining}%</small> : null}</td>
              <td className="appraisal-grid-actions">{lastSibling && remaining > 0 ? <button type="button" onClick={() => addSubKpi(key)}>+ Add Sub-KPI</button> : null}<button type="button" className="appraisal-grid-delete" onClick={() => setDeleteCriteriaId(row.id)} aria-label={`Delete ${row.subKpiName || row.title}`} title="Delete this Sub-KPI">x</button></td>
            </tr>;
          })}
          {!criteriaRows.length ? <tr><td colSpan={6} className="appraisal-grid-empty">Add a KPI category to start configuring this cycle.</td></tr> : null}
        </tbody><tfoot><tr><th colSpan={2}>Total Category Weightage</th><th className={weightageTotal === 100 ? 'is-valid' : weightageTotal > 100 ? 'is-over' : 'is-incomplete'}>{weightageTotal}% / 100%</th><th colSpan={2}>{[...subWeightTotals.entries()].map(([key, total]) => { const roundedTotal = roundWeight(total); return <span className={`appraisal-grid-total-chip ${Math.abs(roundedTotal - 100) < 0.001 ? 'is-valid' : roundedTotal > 100 ? 'is-over' : 'is-incomplete'}`} key={key}>{parentNames.get(key)}: {roundedTotal}% / 100% Remaining {getRemainingSubKPIWeightage(key)}%</span>; })}</th><th>{getRemainingKPIWeightage() > 0 ? <button type="button" onClick={addKpi}>+ Add KPI</button> : null}</th></tr></tfoot></table></div>
        {criteriaActionError ? <p className="appraisal-error" role="alert">{criteriaActionError}</p> : null}{dateErrors.length > 0 ? <div className="appraisal-grid-errors" role="status">{dateErrors.map((message) => <p key={message}>{message}</p>)}</div> : null}{criteriaErrors.length > 0 ? <div className="appraisal-grid-errors" role="status">{criteriaErrors.map((message, index) => <p key={`${index}-${message}`}>{message}</p>)}</div> : <p className="appraisal-grid-success">Category allocations total 100%, and every Sub-KPI group independently totals 100%.</p>}
        {criteriaImportOpen ? <div className="appraisal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCriteriaImportOpen(false); }}><section className="appraisal-import-modal" role="dialog" aria-modal="true" aria-labelledby="criteria-import-title"><div className="appraisal-form-heading"><div><span className="appraisal-card-kicker">KPI CONFIGURATION</span><h2 id="criteria-import-title">Import criteria</h2><p>Upload an Excel or CSV template, review validation, then apply the rows.</p></div><button type="button" className="appraisal-modal-close" onClick={() => setCriteriaImportOpen(false)} aria-label="Close import dialog">x</button></div><label className="appraisal-drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void previewCriteriaImport(file); }}><span className="appraisal-drop-icon">Upload</span><strong>Drop your Excel or CSV file here</strong><span>Supported formats: XLSX and CSV. Maximum 4 MB</span><input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void previewCriteriaImport(file); event.currentTarget.value = ''; }} /></label><div className="appraisal-import-file"><span>{criteriaImportFileName || 'No file selected'}</span><a download="appraisal-kpi-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent('KPI Name,KPI Weightage,Sub-KPI Name,Sub-KPI Weightage\nKey Competencies,100,Process Adherence,40\nKey Competencies,100,Accountability,60\n')}`}>Download template</a></div>{criteriaImportPreview ? <><div className="appraisal-import-validation"><strong>{criteriaImportPreview.errors.length ? `${criteriaImportPreview.errors.length} validation issue(s)` : `${criteriaImportPreview.rows.length} rows ready to import`}</strong>{criteriaImportPreview.errors.map((message) => <p className="appraisal-error" key={message}>{message}</p>)}</div><div className="appraisal-import-preview-table"><table className="appraisal-kpi-grid"><thead><tr><th>KPI</th><th>Weight</th><th>Sub-KPI</th><th>Sub-weight</th></tr></thead><tbody>{criteriaImportPreview.rows.slice(0, 12).map((row) => <tr key={row.id}><td>{row.title}</td><td>{row.weight}%</td><td>{row.subKpiName}</td><td>{row.subWeight}%</td></tr>)}</tbody></table>{criteriaImportPreview.rows.length > 12 ? <small>Showing 12 of {criteriaImportPreview.rows.length} rows.</small> : null}</div></> : null}<div className="appraisal-modal-actions"><button type="button" onClick={() => { setCriteriaImportOpen(false); setCriteriaImportPreview(null); }}>Cancel</button>{criteriaImportPreview && criteriaImportPreview.errors.length === 0 && criteriaImportPreview.rows.length ? <button type="button" className="primary" onClick={() => { setWeightInputErrors({}); setWeightInputDrafts({}); setCriteriaRows(criteriaImportPreview.rows); setCriteriaImportPreview(null); setCriteriaImportOpen(false); }}>Use imported criteria</button> : null}</div></section></div> : null}
        {deleteCriteriaId ? <div className="appraisal-modal-backdrop"><section className="appraisal-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-kpi-title"><h2 id="delete-kpi-title">Delete Sub-KPI?</h2><p>{`This will remove '${criteriaRows.find((row) => row.id === deleteCriteriaId)?.subKpiName || criteriaRows.find((row) => row.id === deleteCriteriaId)?.title}' from this KPI configuration.`}</p><div className="appraisal-modal-actions"><button type="button" onClick={() => setDeleteCriteriaId('')}>Cancel</button><button type="button" className="appraisal-confirm-delete" onClick={() => deleteCriteria(deleteCriteriaId)}>Delete Sub-KPI</button></div></section></div> : null}
      </div><div className="appraisal-form-footer"><span>Parent and per-KPI Sub-KPI allocations must each total 100% before saving.</span><button className="primary" disabled={busy || (!editingCycleId && (!name.trim() || !periodStart || !periodEnd || !selfStart || !selfDeadline || !reviewDeadline)) || parsedKpis.length === 0 || criteriaErrors.length > 0 || dateErrors.length > 0} onClick={() => void (editingCycleId ? saveConfiguration() : create())}>{editingCycleId ? 'Save configuration' : 'Save draft cycle'} <span aria-hidden="true">→</span></button>{editingCycleId ? <button type="button" onClick={() => { setEditingCycleId(''); setCriteriaRows([]); setWeightInputErrors({}); setWeightInputDrafts({}); }}>Cancel</button> : null}</div>
    </section><SectionTitle title="Cycles" description="Manage active and previous review periods." count={data?.length ?? 0} />{(data ?? []).map((cycle) => <div key={cycle.id}><article className="appraisal-card appraisal-cycle-row"><div className="appraisal-cycle-row-title"><span className="appraisal-cycle-symbol" aria-hidden="true">FY</span><div><h3>{cycle.name}</h3><span>{cycle._count.appraisals} employees · {cycle.kpis.length} KPI rows</span></div></div><div className="appraisal-cycle-row-actions"><Status value={cycle.status} />{cycle.status === 'Draft' ? <><span className={`appraisal-grid-total-chip ${cycleCriteriaValid(cycle) ? 'is-valid' : 'is-incomplete'}`}>{cycleCriteriaValid(cycle) ? 'Criteria complete' : 'Criteria incomplete'}</span>{cycle._count.appraisals === 0 ? <button disabled={busy} onClick={() => editConfiguration(cycle)}>Edit criteria</button> : <span className="appraisal-grid-total-chip is-valid">KPI template locked</span>}<button disabled={busy} onClick={() => setAssignmentCycleId(cycle.id)}>Assign employees</button><button disabled={busy || !cycleCriteriaValid(cycle)} title={!cycleCriteriaValid(cycle) ? 'Parent KPI allocations and each independent Sub-KPI group must each total 100%.' : undefined} onClick={() => void launch(cycle)}>Launch cycle <span aria-hidden="true">→</span></button></> : null}{cycle.status === 'Active' ? <button disabled={busy} onClick={() => void close(cycle)}>Close cycle</button> : null}</div></article>{assignmentCycleId === cycle.id && cycle.status === 'Draft' ? <EmployeeAssignmentPanel cycleId={cycle.id} onClose={() => setAssignmentCycleId('')} onAssigned={() => { setAssignmentCycleId(''); void reload(); }} /> : null}</div>)}
    {!data?.length ? <p className="appraisal-empty"><strong>No cycles yet</strong><span>Create a cycle above to begin appraisal planning.</span></p> : null}
  </main>;
}
