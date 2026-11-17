import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../alumni/alumni.css';
import { formatDateTime, formatDay } from '../alumni/alumniApi';
import { Chip, Steps } from '../alumni/alumniUi';
import { EssModal } from '../ess/components/EssModal';
import { HrAlumniTabs, message } from './HrAlumniPage';
import { fetchHrEmployees, fetchHrOrg, fetchHrRoles, type HrEmployee, type HrOrg, type HrRole } from './hrApi';
import {
  archiveAnnouncement,
  cancelEvent,
  cancelRehire,
  completeRehire,
  downloadReferralResume,
  fetchEventRsvps,
  fetchHrAnnouncements,
  fetchHrApplications,
  fetchHrEvents,
  fetchHrJobs,
  fetchHrReferrals,
  publishAnnouncement,
  publishEvent,
  saveAnnouncement,
  saveEvent,
  saveJob,
  setApplicationStatus,
  setJobStatus,
  startRehire,
  updateReferral,
  type Audience,
  type HrAnnouncement,
  type HrApplication,
  type HrEvent,
  type HrJob,
  type HrReferral,
  type HrRehire,
} from './hrAlumniApi';

const EMPTY_AUDIENCE: Audience = { departments: [], exitYears: [], joinYears: [], locations: [] };

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : undefined);

const years = (text: string) =>
  text
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .filter((year) => Number.isInteger(year) && year >= 1950 && year <= 2100);

function useOrg() {
  const [org, setOrg] = useState<HrOrg | null>(null);
  useEffect(() => {
    fetchHrOrg()
      .then(setOrg)
      .catch(() => setOrg(null));
  }, []);
  return org;
}

/** Audience groups: departments, locations, joining years and exit years. Nothing chosen means all alumni. */
function AudiencePicker({ value, onChange }: { value: Audience; onChange: (value: Audience) => void }) {
  const org = useOrg();
  const [exitText, setExitText] = useState(value.exitYears.join(', '));
  const [joinText, setJoinText] = useState(value.joinYears.join(', '));
  const toggle = (key: 'departments' | 'locations', name: string) =>
    onChange({ ...value, [key]: value[key].includes(name) ? value[key].filter((item) => item !== name) : [...value[key], name] });

  return (
    <fieldset className="al-consent" style={{ padding: 10 }}>
      <legend>Who is it for? Leave everything empty for all alumni.</legend>
      <span className="al-meta">Departments</span>
      <div className="al-visibility">
        {org?.departments.map((dept) => (
          <label key={dept.id}>
            <input type="checkbox" checked={value.departments.includes(dept.name)} onChange={() => toggle('departments', dept.name)} />
            {dept.name}
          </label>
        ))}
      </div>
      <span className="al-meta">Locations</span>
      <div className="al-visibility">
        {org?.locations.map((loc) => (
          <label key={loc.id}>
            <input type="checkbox" checked={value.locations.includes(loc.name)} onChange={() => toggle('locations', loc.name)} />
            {loc.name}
          </label>
        ))}
      </div>
      <div className="al-form-row">
        <div className="ess-field">
          <label htmlFor="aud-join">Joined in (batch)</label>
          <input
            id="aud-join"
            placeholder="e.g. 2018, 2019"
            value={joinText}
            onChange={(e) => {
              setJoinText(e.target.value);
              onChange({ ...value, joinYears: years(e.target.value) });
            }}
          />
        </div>
        <div className="ess-field">
          <label htmlFor="aud-exit">Left in</label>
          <input
            id="aud-exit"
            placeholder="e.g. 2025"
            value={exitText}
            onChange={(e) => {
              setExitText(e.target.value);
              onChange({ ...value, exitYears: years(e.target.value) });
            }}
          />
        </div>
      </div>
    </fieldset>
  );
}

// ─── News and events (ALM-09) ────────────────────────────────────────────────

export function HrAlumniEngagementPage() {
  const [posts, setPosts] = useState<HrAnnouncement[]>([]);
  const [events, setEvents] = useState<HrEvent[]>([]);
  const [post, setPost] = useState<HrAnnouncement | 'new' | null>(null);
  const [event, setEvent] = useState<HrEvent | 'new' | null>(null);
  const [rsvps, setRsvps] = useState<{ title: string; rows: Awaited<ReturnType<typeof fetchEventRsvps>> } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchHrAnnouncements(), fetchHrEvents()])
      .then(([postList, eventList]) => {
        setPosts(postList);
        setEvents(eventList);
      })
      .catch((err) => setError(message(err)));
  }, []);

  useEffect(load, [load]);

  async function act(action: () => Promise<string | void>) {
    setError(null);
    setNotice(null);
    try {
      const done = await action();
      if (done) setNotice(done);
      load();
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <div className="al-page">
      <div className="al-hr-head">
        <div>
          <h1 className="ess-page-title">Alumni news and events</h1>
          <p className="ess-page-lead">
            Publishing emails only alumni in the chosen groups who agreed to emails. Do not contact alumni never receive anything.
          </p>
        </div>
        <div className="ess-actions">
          <button type="button" className="ess-btn" onClick={() => setPost('new')}>
            New post
          </button>
          <button type="button" className="ess-btn ess-btn-primary" onClick={() => setEvent('new')}>
            New event
          </button>
        </div>
      </div>
      <HrAlumniTabs />
      {notice ? <p className="al-ok">{notice}</p> : null}
      {error ? <p className="ess-alert">{error}</p> : null}

      <section className="ess-panel">
        <h2 className="ess-panel-title">Events</h2>
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>When</th>
                <th>For</th>
                <th>Replies</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.title}
                    <span className="al-sub">{row.venue || row.meetingUrl || '—'}</span>
                  </td>
                  <td>{formatDateTime(row.startsAt)}</td>
                  <td>{row.audienceLabel}</td>
                  <td>
                    {row.counts.going} going · {row.counts.maybe} maybe
                    {row.capacity ? <span className="al-sub">Capacity {row.capacity}</span> : null}
                  </td>
                  <td>
                    <Chip status={row.status} />
                  </td>
                  <td className="al-table-actions">
                    {row.status !== 'cancelled' ? (
                      <button type="button" className="ess-btn ess-btn-ghost" onClick={() => setEvent(row)}>
                        Edit
                      </button>
                    ) : null}
                    {row.status === 'draft' ? (
                      <button
                        type="button"
                        className="ess-btn ess-btn-primary"
                        onClick={() => void act(async () => `Published. ${(await publishEvent(row.id)).emailed} alumni emailed.`)}
                      >
                        Publish
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ess-btn ess-btn-ghost"
                      onClick={() =>
                        void act(async () => {
                          setRsvps({ title: row.title, rows: await fetchEventRsvps(row.id) });
                        })
                      }
                    >
                      Replies
                    </button>
                    {row.status !== 'cancelled' ? (
                      <button
                        type="button"
                        className="ess-btn ess-btn-ghost"
                        onClick={() => void act(async () => (await cancelEvent(row.id), 'Event cancelled. Attendees were told.'))}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 ? <p className="ess-empty">No events yet.</p> : null}
        </div>
      </section>

      <section className="ess-panel">
        <h2 className="ess-panel-title">Announcements and newsletters</h2>
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                <th>Post</th>
                <th>For</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {posts.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.title}
                    <span className="al-sub">
                      {row.kind === 'newsletter' ? 'Newsletter' : 'Announcement'}
                      {row.publishedAt ? ` · published ${formatDay(row.publishedAt)}` : ''}
                    </span>
                  </td>
                  <td>{row.audienceLabel}</td>
                  <td>
                    <Chip status={row.status} />
                  </td>
                  <td className="al-table-actions">
                    {row.status !== 'archived' ? (
                      <button type="button" className="ess-btn ess-btn-ghost" onClick={() => setPost(row)}>
                        Edit
                      </button>
                    ) : null}
                    {row.status === 'draft' ? (
                      <button
                        type="button"
                        className="ess-btn ess-btn-primary"
                        onClick={() => void act(async () => `Published. ${(await publishAnnouncement(row.id)).emailed} alumni emailed.`)}
                      >
                        Publish
                      </button>
                    ) : null}
                    {row.status !== 'archived' ? (
                      <button type="button" className="ess-btn ess-btn-ghost" onClick={() => void act(async () => (await archiveAnnouncement(row.id), 'Archived.'))}>
                        Archive
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 ? <p className="ess-empty">No posts yet.</p> : null}
        </div>
      </section>

      {post ? (
        <PostModal
          post={post === 'new' ? null : post}
          onClose={() => setPost(null)}
          onSaved={() => {
            setPost(null);
            setNotice('Saved. Publish it when ready.');
            load();
          }}
        />
      ) : null}
      {event ? (
        <EventModal
          event={event === 'new' ? null : event}
          onClose={() => setEvent(null)}
          onSaved={() => {
            setEvent(null);
            setNotice('Event saved.');
            load();
          }}
        />
      ) : null}
      {rsvps ? (
        <EssModal title={`Replies: ${rsvps.title}`} onClose={() => setRsvps(null)}>
          {rsvps.rows.length === 0 ? <p className="ess-empty">No replies yet.</p> : null}
          <ul className="al-steps">
            {rsvps.rows.map((row) => (
              <li key={row.alumni.id}>
                {row.alumni.fullName} ({row.alumni.employeeCode}) · {row.response}
                {row.note ? ` · ${row.note}` : ''}
              </li>
            ))}
          </ul>
        </EssModal>
      ) : null}
    </div>
  );
}

function PostModal({ post, onClose, onSaved }: { post: HrAnnouncement | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ kind: post?.kind ?? 'announcement', title: post?.title ?? '', body: post?.body ?? '' });
  const [audience, setAudience] = useState<Audience>(post?.audience ?? EMPTY_AUDIENCE);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      await saveAnnouncement(post?.id ?? null, { ...form, audience });
      onSaved();
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <EssModal
      title={post ? 'Edit post' : 'New post'}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ess-btn ess-btn-primary" disabled={!form.title.trim() || !form.body.trim()} onClick={() => void save()}>
            Save
          </button>
        </>
      }
    >
      <div className="al-modal-form">
        {error ? <p className="ess-alert">{error}</p> : null}
        <div className="ess-field">
          <label htmlFor="post-kind">Type</label>
          <select id="post-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'announcement' | 'newsletter' })}>
            <option value="announcement">Announcement</option>
            <option value="newsletter">Newsletter</option>
          </select>
        </div>
        <div className="ess-field">
          <label htmlFor="post-title">Title</label>
          <input id="post-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="ess-field">
          <label htmlFor="post-body">Message</label>
          <textarea id="post-body" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </div>
        <AudiencePicker value={audience} onChange={setAudience} />
      </div>
    </EssModal>
  );
}

function EventModal({ event, onClose, onSaved }: { event: HrEvent | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: event?.title ?? '',
    description: event?.description ?? '',
    startsAt: toLocalInput(event?.startsAt),
    endsAt: toLocalInput(event?.endsAt),
    venue: event?.venue ?? '',
    meetingUrl: event?.meetingUrl ?? '',
    capacity: event?.capacity ? String(event.capacity) : '',
    rsvpBy: toLocalInput(event?.rsvpBy),
  });
  const [audience, setAudience] = useState<Audience>(event?.audience ?? EMPTY_AUDIENCE);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    try {
      await saveEvent(event?.id ?? null, {
        title: form.title,
        description: form.description,
        startsAt: fromLocalInput(form.startsAt),
        endsAt: fromLocalInput(form.endsAt),
        venue: form.venue,
        meetingUrl: form.meetingUrl || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        rsvpBy: fromLocalInput(form.rsvpBy),
        audience,
      });
      onSaved();
    } catch (err) {
      setError(message(err));
    }
  }

  const input = (key: keyof typeof form, label: string, type = 'text') => (
    <div className="ess-field">
      <label htmlFor={`event-${key}`}>{label}</label>
      <input id={`event-${key}`} type={type} value={form[key]} onChange={(e) => set(key)(e.target.value)} />
    </div>
  );

  return (
    <EssModal
      title={event ? 'Edit event' : 'New event'}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ess-btn ess-btn-primary" disabled={!form.title.trim() || !form.startsAt} onClick={() => void save()}>
            Save
          </button>
        </>
      }
    >
      <div className="al-modal-form">
        {error ? <p className="ess-alert">{error}</p> : null}
        {input('title', 'Title')}
        <div className="ess-field">
          <label htmlFor="event-description">Description</label>
          <textarea id="event-description" value={form.description} onChange={(e) => set('description')(e.target.value)} />
        </div>
        <div className="al-form-row">
          {input('startsAt', 'Starts', 'datetime-local')}
          {input('endsAt', 'Ends', 'datetime-local')}
          {input('venue', 'Venue')}
          {input('meetingUrl', 'Online link', 'url')}
          {input('capacity', 'Capacity', 'number')}
          {input('rsvpBy', 'Reply by', 'datetime-local')}
        </div>
        <AudiencePicker value={audience} onChange={setAudience} />
      </div>
    </EssModal>
  );
}

// ─── Jobs, applications, rehire and referrals (ALM-10, ALM-11) ───────────────

type CareersTab = 'applications' | 'jobs' | 'referrals';

export function HrAlumniCareersPage() {
  const [tab, setTab] = useState<CareersTab>('applications');
  const [jobs, setJobs] = useState<HrJob[]>([]);
  const [applications, setApplications] = useState<HrApplication[]>([]);
  const [referrals, setReferrals] = useState<HrReferral[]>([]);
  const [job, setJob] = useState<HrJob | 'new' | null>(null);
  const [starting, setStarting] = useState<HrApplication | null>(null);
  const [completing, setCompleting] = useState<HrRehire | null>(null);
  const [referral, setReferral] = useState<HrReferral | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchHrJobs(), fetchHrApplications(), fetchHrReferrals()])
      .then(([jobList, apps, refs]) => {
        setJobs(jobList);
        setApplications(apps);
        setReferrals(refs);
      })
      .catch((err) => setError(message(err)));
  }, []);

  useEffect(load, [load]);

  async function act(action: () => Promise<unknown>, done: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(done);
      load();
    } catch (err) {
      setError(message(err));
    }
  }

  const tabs: { value: CareersTab; label: string }[] = [
    { value: 'applications', label: `Applications ${applications.length}` },
    { value: 'jobs', label: `Jobs ${jobs.length}` },
    { value: 'referrals', label: `Referrals ${referrals.length}` },
  ];

  return (
    <div className="al-page">
      <div className="al-hr-head">
        <div>
          <h1 className="ess-page-title">Alumni jobs and referrals</h1>
          <p className="ess-page-lead">
            Fast-track rehire reuses the alumnus's past record and creates a new employee; the old employment record never changes.
          </p>
        </div>
        <button type="button" className="ess-btn ess-btn-primary" onClick={() => setJob('new')}>
          New job
        </button>
      </div>
      <HrAlumniTabs />
      {notice ? <p className="al-ok">{notice}</p> : null}
      {error ? <p className="ess-alert">{error}</p> : null}
      <div className="ess-tabs" role="tablist" style={{ marginBottom: 0 }}>
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`ess-tab${tab === item.value ? ' is-active' : ''}`}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'applications' ? (
        <section className="ess-panel">
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Alumnus</th>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Move to</th>
                  <th>Rehire</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => {
                  const live = ['applied', 'shortlisted', 'interviewing', 'offered'].includes(app.status);
                  return (
                    <tr key={app.id}>
                      <td>
                        <Link className="al-linkbtn" to={`/hr/alumni/${app.alumni.id}`}>
                          {app.alumni.fullName}
                        </Link>
                        <span className="al-sub">
                          {app.alumni.employeeCode} · was {app.alumni.designation || '—'} · {app.alumni.tenure} · left {formatDay(app.alumni.lastWorkingDay)}
                        </span>
                        {app.note ? <span className="al-sub">“{app.note}”</span> : null}
                      </td>
                      <td>{app.job.title}</td>
                      <td>
                        <Chip status={app.status} />
                        {app.fastTrack ? <span className="al-sub">Fast-tracked</span> : null}
                        <Steps history={app.history} />
                      </td>
                      <td>
                        {live ? (
                          <select
                            aria-label="Move application"
                            value=""
                            onChange={(e) => void act(() => setApplicationStatus(app.id, e.target.value, ''), 'Application updated.')}
                          >
                            <option value="">Choose…</option>
                            {['shortlisted', 'interviewing', 'offered', 'rejected']
                              .filter((status) => status !== app.status)
                              .map((status) => (
                                <option key={status} value={status}>
                                  {status[0].toUpperCase() + status.slice(1)}
                                </option>
                              ))}
                          </select>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="al-table-actions">
                        {app.rehire?.status === 'initiated' ? (
                          <>
                            <button type="button" className="ess-btn ess-btn-primary" onClick={() => setCompleting(app.rehire)}>
                              Complete rehire
                            </button>
                            <button
                              type="button"
                              className="ess-btn ess-btn-ghost"
                              onClick={() => void act(() => cancelRehire(app.rehire!.id, ''), 'Rehire cancelled.')}
                            >
                              Cancel
                            </button>
                          </>
                        ) : app.rehire?.status === 'completed' ? (
                          <span className="al-meta">New employee created · joins {formatDay(app.rehire.joiningDate)}</span>
                        ) : live && app.alumni.eligibility === 'eligible' ? (
                          <button type="button" className="ess-btn" onClick={() => setStarting(app)}>
                            Start fast-track rehire
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {applications.length === 0 ? <p className="ess-empty">No applications yet.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === 'jobs' ? (
        <section className="ess-panel">
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Closes</th>
                  <th>Applications</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.title}
                      <span className="al-sub">{[row.departmentName, row.location, row.employmentType].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td>{formatDay(row.closesOn)}</td>
                    <td>
                      {row.applications ?? 0}
                      <span className="al-sub">{row.referrals ?? 0} referrals</span>
                    </td>
                    <td>
                      <Chip status={row.status} />
                    </td>
                    <td className="al-table-actions">
                      <button type="button" className="ess-btn ess-btn-ghost" onClick={() => setJob(row)}>
                        Edit
                      </button>
                      {row.status !== 'open' ? (
                        <button type="button" className="ess-btn ess-btn-primary" onClick={() => void act(() => setJobStatus(row.id, 'open'), 'Job is open to alumni.')}>
                          Open
                        </button>
                      ) : (
                        <button type="button" className="ess-btn" onClick={() => void act(() => setJobStatus(row.id, 'closed'), 'Job closed.')}>
                          Close
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {jobs.length === 0 ? <p className="ess-empty">No jobs yet.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === 'referrals' ? (
        <section className="ess-panel">
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Referred by</th>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Reward</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {referrals.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.candidateName}
                      <span className="al-sub">
                        {row.candidateEmail}
                        {row.candidatePhone ? ` · ${row.candidatePhone}` : ''}
                      </span>
                      {row.hasResume ? (
                        <button type="button" className="al-linkbtn" onClick={() => void act(() => downloadReferralResume(row), 'CV downloaded.')}>
                          Download CV
                        </button>
                      ) : null}
                    </td>
                    <td>
                      <Link className="al-linkbtn" to={`/hr/alumni/${row.alumni.id}`}>
                        {row.alumni.fullName}
                      </Link>
                      <span className="al-sub">{row.relationship}</span>
                    </td>
                    <td>{row.job?.title ?? 'Any role'}</td>
                    <td>
                      <Chip status={row.status} />
                    </td>
                    <td>
                      {row.rewardStatus === 'not_applicable' ? '—' : <Chip status={row.rewardStatus} />}
                      {row.rewardAmount ? (
                        <span className="al-sub">
                          {row.rewardCurrency} {row.rewardAmount.toLocaleString('en-IN')}
                          {row.rewardPaidOn ? ` · paid ${formatDay(row.rewardPaidOn)}` : ''}
                        </span>
                      ) : null}
                    </td>
                    <td className="al-table-actions">
                      <button type="button" className="ess-btn ess-btn-ghost" onClick={() => setReferral(row)}>
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {referrals.length === 0 ? <p className="ess-empty">No referrals yet.</p> : null}
          </div>
        </section>
      ) : null}

      {job ? (
        <JobModal
          job={job === 'new' ? null : job}
          onClose={() => setJob(null)}
          onSaved={() => {
            setJob(null);
            setTab('jobs');
            setNotice('Job saved. Open it to show it to alumni.');
            load();
          }}
        />
      ) : null}
      {starting ? (
        <StartRehireModal
          application={starting}
          onClose={() => setStarting(null)}
          onStarted={(rehire) => {
            setStarting(null);
            setCompleting(rehire);
            load();
          }}
        />
      ) : null}
      {completing ? (
        <CompleteRehireModal
          rehire={completing}
          onClose={() => setCompleting(null)}
          onDone={(code) => {
            setCompleting(null);
            setNotice(`Rehired as new employee ${code}. The previous employment record is unchanged.`);
            load();
          }}
        />
      ) : null}
      {referral ? (
        <ReferralModal
          referral={referral}
          onClose={() => setReferral(null)}
          onSaved={() => {
            setReferral(null);
            setNotice('Referral updated.');
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function JobModal({ job, onClose, onSaved }: { job: HrJob | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: job?.title ?? '',
    departmentName: job?.departmentName ?? '',
    location: job?.location ?? '',
    employmentType: job?.employmentType ?? 'Full-time',
    experience: job?.experience ?? '',
    description: job?.description ?? '',
    closesOn: job?.closesOn ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    try {
      await saveJob(job?.id ?? null, { ...form, closesOn: form.closesOn || undefined });
      onSaved();
    } catch (err) {
      setError(message(err));
    }
  }

  const input = (key: keyof typeof form, label: string, type = 'text') => (
    <div className="ess-field">
      <label htmlFor={`job-${key}`}>{label}</label>
      <input id={`job-${key}`} type={type} value={form[key]} onChange={(e) => set(key)(e.target.value)} />
    </div>
  );

  return (
    <EssModal
      title={job ? 'Edit job' : 'New job'}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ess-btn ess-btn-primary" disabled={!form.title.trim() || !form.description.trim()} onClick={() => void save()}>
            Save
          </button>
        </>
      }
    >
      <div className="al-modal-form">
        {error ? <p className="ess-alert">{error}</p> : null}
        {input('title', 'Title')}
        <div className="al-form-row">
          {input('departmentName', 'Department')}
          {input('location', 'Location')}
          {input('employmentType', 'Employment type')}
          {input('experience', 'Experience')}
          {input('closesOn', 'Closes on', 'date')}
        </div>
        <div className="ess-field">
          <label htmlFor="job-description">Description</label>
          <textarea id="job-description" rows={6} value={form.description} onChange={(e) => set('description')(e.target.value)} />
        </div>
      </div>
    </EssModal>
  );
}

function StartRehireModal({
  application,
  onClose,
  onStarted,
}: {
  application: HrApplication;
  onClose: () => void;
  onStarted: (rehire: HrRehire) => void;
}) {
  const org = useOrg();
  const [form, setForm] = useState({ joiningDate: '', workEmail: '', designation: application.job.title, departmentId: '', locationId: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function start() {
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
      onStarted(await startRehire(application.id, payload));
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <EssModal
      title={`Fast-track rehire: ${application.alumni.fullName}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ess-btn ess-btn-primary" disabled={!form.joiningDate || !form.workEmail} onClick={() => void start()}>
            Continue
          </button>
        </>
      }
    >
      <div className="al-modal-form">
        {error ? <p className="ess-alert">{error}</p> : null}
        <p className="ess-modal-lead">
          Previously {application.alumni.designation || '—'} in {application.alumni.departmentName || '—'} for {application.alumni.tenure}, left{' '}
          {formatDay(application.alumni.lastWorkingDay)} ({application.alumni.employeeCode}). This history is kept as it is.
        </p>
        <div className="al-form-row">
          <div className="ess-field">
            <label htmlFor="rh-join">New joining date</label>
            <input id="rh-join" type="date" value={form.joiningDate} onChange={(e) => set('joiningDate')(e.target.value)} />
          </div>
          <div className="ess-field">
            <label htmlFor="rh-email">New work email</label>
            <input id="rh-email" type="email" value={form.workEmail} onChange={(e) => set('workEmail')(e.target.value)} />
          </div>
          <div className="ess-field">
            <label htmlFor="rh-desig">Designation</label>
            <input id="rh-desig" value={form.designation} onChange={(e) => set('designation')(e.target.value)} />
          </div>
          <div className="ess-field">
            <label htmlFor="rh-dept">Department</label>
            <select id="rh-dept" value={form.departmentId} onChange={(e) => set('departmentId')(e.target.value)}>
              <option value="">Same as before</option>
              {org?.departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="rh-loc">Location</label>
            <select id="rh-loc" value={form.locationId} onChange={(e) => set('locationId')(e.target.value)}>
              <option value="">Same as before</option>
              {org?.locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="ess-field">
          <label htmlFor="rh-notes">Notes</label>
          <textarea id="rh-notes" value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
        </div>
      </div>
    </EssModal>
  );
}

function CompleteRehireModal({ rehire, onClose, onDone }: { rehire: HrRehire; onClose: () => void; onDone: (code: string) => void }) {
  const [roles, setRoles] = useState<HrRole[]>([]);
  const [managers, setManagers] = useState<HrEmployee[]>([]);
  const [form, setForm] = useState({ password: '', roleCodes: ['EMPLOYEE'], managerId: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const prev = rehire.previousEmployment;

  useEffect(() => {
    Promise.all([fetchHrRoles(), fetchHrEmployees()])
      .then(([roleList, employees]) => {
        setRoles(roleList);
        setManagers(employees.filter((employee) => employee.status === 'ACTIVE'));
      })
      .catch((err) => setError(message(err)));
  }, []);

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      const done = await completeRehire(rehire.id, {
        password: form.password,
        roleCodes: form.roleCodes,
        managerId: form.managerId || undefined,
      });
      onDone(done.newEmployeeCode ?? '');
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <EssModal
      title="Create the new employment"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Later
          </button>
          <button
            type="button"
            className="ess-btn ess-btn-primary"
            disabled={busy || form.password.length < 8 || !form.roleCodes.length}
            onClick={() => void complete()}
          >
            {busy ? 'Creating…' : 'Create new employee'}
          </button>
        </>
      }
    >
      <div className="al-modal-form">
        {error ? <p className="ess-alert">{error}</p> : null}
        <dl className="ess-dl">
          <div>
            <dt>Previous</dt>
            <dd>
              {prev.employeeCode} · {prev.designation || '—'} · {prev.departmentName || '—'} · {formatDay(prev.joiningDate)} to{' '}
              {formatDay(prev.lastWorkingDay)}
            </dd>
          </div>
          <div>
            <dt>New</dt>
            <dd>
              {rehire.designation} · joins {formatDay(rehire.joiningDate)} · {rehire.workEmail}
            </dd>
          </div>
        </dl>
        <p className="ess-field-hint">
          A new employee record and login are created the same way as on the Employees page. The previous record is not changed.
        </p>
        <div className="ess-field">
          <label htmlFor="rh-pw">Initial password</label>
          <input id="rh-pw" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p className="ess-field-hint">At least 8 characters. Share it securely; they can change it after signing in.</p>
        </div>
        <span className="al-meta">Roles</span>
        <div className="al-visibility">
          {roles.map((role) => (
            <label key={role.code}>
              <input
                type="checkbox"
                checked={form.roleCodes.includes(role.code)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    roleCodes: e.target.checked ? [...form.roleCodes, role.code] : form.roleCodes.filter((code) => code !== role.code),
                  })
                }
              />
              {role.name}
            </label>
          ))}
        </div>
        <div className="ess-field">
          <label htmlFor="rh-mgr">Reporting manager (optional)</label>
          <select id="rh-mgr" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
            <option value="">None</option>
            {managers.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName} · {employee.employeeCode}
              </option>
            ))}
          </select>
        </div>
      </div>
    </EssModal>
  );
}

function ReferralModal({ referral, onClose, onSaved }: { referral: HrReferral; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    status: referral.status,
    hrNote: referral.hrNote,
    rewardStatus: referral.rewardStatus,
    rewardAmount: referral.rewardAmount ? String(referral.rewardAmount) : '',
    rewardCurrency: referral.rewardCurrency,
    rewardPaidOn: referral.rewardPaidOn ?? '',
    rewardReference: referral.rewardReference,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    try {
      await updateReferral(referral.id, {
        status: form.status,
        hrNote: form.hrNote,
        rewardStatus: form.rewardStatus,
        rewardAmount: form.rewardAmount ? Number(form.rewardAmount) : undefined,
        rewardCurrency: form.rewardCurrency || undefined,
        rewardPaidOn: form.rewardPaidOn || undefined,
        rewardReference: form.rewardReference,
      });
      onSaved();
    } catch (err) {
      setError(message(err));
    }
  }

  const select = (key: 'status' | 'rewardStatus', label: string, values: string[]) => (
    <div className="ess-field">
      <label htmlFor={`ref-${key}`}>{label}</label>
      <select id={`ref-${key}`} value={form[key]} onChange={(e) => set(key)(e.target.value)}>
        {values.map((value) => (
          <option key={value} value={value}>
            {value.replace('_', ' ')}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <EssModal
      title={`Referral: ${referral.candidateName}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ess-btn ess-btn-primary" onClick={() => void save()}>
            Save
          </button>
        </>
      }
    >
      <div className="al-modal-form">
        {error ? <p className="ess-alert">{error}</p> : null}
        {referral.note ? <p className="ess-modal-lead">“{referral.note}”</p> : null}
        <Steps history={referral.history} />
        <div className="al-form-row">
          {select('status', 'Status', ['submitted', 'screening', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn'])}
          {select('rewardStatus', 'Reward', ['not_applicable', 'pending', 'approved', 'paid', 'cancelled'])}
          <div className="ess-field">
            <label htmlFor="ref-amount">Reward amount</label>
            <input id="ref-amount" type="number" min="0" step="0.01" value={form.rewardAmount} onChange={(e) => set('rewardAmount')(e.target.value)} />
          </div>
          <div className="ess-field">
            <label htmlFor="ref-currency">Currency</label>
            <input id="ref-currency" maxLength={3} value={form.rewardCurrency} onChange={(e) => set('rewardCurrency')(e.target.value.toUpperCase())} />
          </div>
          <div className="ess-field">
            <label htmlFor="ref-paid">Paid on</label>
            <input id="ref-paid" type="date" value={form.rewardPaidOn} onChange={(e) => set('rewardPaidOn')(e.target.value)} />
          </div>
          <div className="ess-field">
            <label htmlFor="ref-reference">Payment reference</label>
            <input id="ref-reference" value={form.rewardReference} onChange={(e) => set('rewardReference')(e.target.value)} />
          </div>
        </div>
        <div className="ess-field">
          <label htmlFor="ref-note">HR note</label>
          <textarea id="ref-note" value={form.hrNote} onChange={(e) => set('hrNote')(e.target.value)} />
        </div>
        <p className="ess-field-hint">A reward can only be pending, approved or paid once the candidate is hired. Paid needs the date.</p>
      </div>
    </EssModal>
  );
}
