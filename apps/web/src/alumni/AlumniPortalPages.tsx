import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { EssModal } from '../ess/components/EssModal';
import {
  PROFILE_FIELDS,
  changeAlumniPassword,
  confirmEmailChange,
  fetchAnnouncements,
  fetchConsents,
  fetchDirectory,
  fetchEvents,
  fetchJobs,
  fetchMyDocuments,
  fetchMyRequests,
  formatDateTime,
  formatDay,
  removeAlumniPhoto,
  requestEmailChange,
  setConsent,
  updateAlumniProfile,
  uploadAlumniPhoto,
  type Announcement,
  type AlumniEvent,
  type Consents,
  type DirectoryResult,
  type ProfileField,
} from './alumniApi';
import { useAlumni } from './AlumniLayout';
import { Avatar } from './alumniUi';

// ─── Home ─────────────────────────────────────────────────────────────────────

export function AlumniHomePage() {
  const { me, fail } = useAlumni();
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<AlumniEvent[]>([]);
  const [counts, setCounts] = useState({ documents: 0, requests: 0, jobs: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAnnouncements(), fetchEvents(), fetchMyDocuments(), fetchMyRequests(), fetchJobs()])
      .then(([announcements, upcoming, documents, requests, jobs]) => {
        setPosts(announcements);
        setEvents(upcoming.filter((event) => event.status === 'published' && new Date(event.startsAt) > new Date()));
        setCounts({
          documents: documents.length,
          requests: requests.filter((r) => ['submitted', 'under_review', 'approved'].includes(r.status)).length,
          jobs: jobs.length,
        });
      })
      .catch((err) => setError(fail(err)));
  }, [fail]);

  return (
    <div className="al-page">
      <div className="ess-page-head">
        <div>
          <h1 className="ess-page-title">Welcome back, {me.fullName.split(' ')[0]}</h1>
          <p className="ess-page-lead">
            {me.designation || 'Alumnus'}
            {me.departmentName ? `, ${me.departmentName}` : ''} · {formatDay(me.joiningDate)} to {formatDay(me.lastWorkingDay)} ·{' '}
            {me.tenure}
          </p>
        </div>
      </div>
      {error ? <p className="ess-alert">{error}</p> : null}
      <div className="al-stats">
        <Link className="al-stat" to="/alumni/documents">
          <strong>{counts.documents}</strong>
          <span>Documents ready to download</span>
        </Link>
        <Link className="al-stat" to="/alumni/documents">
          <strong>{counts.requests}</strong>
          <span>Open document requests</span>
        </Link>
        <Link className="al-stat" to="/alumni/events">
          <strong>{events.length}</strong>
          <span>Upcoming events</span>
        </Link>
        <Link className="al-stat" to="/alumni/jobs">
          <strong>{counts.jobs}</strong>
          <span>Open jobs</span>
        </Link>
      </div>
      <div className="al-grid-2">
        <section className="ess-panel">
          <h2 className="ess-panel-title">News</h2>
          {posts.length === 0 ? <p className="ess-empty">No announcements yet.</p> : null}
          <div className="al-page">
            {posts.slice(0, 5).map((post) => (
              <article key={post.id} className="al-card">
                <span className="al-meta">
                  {post.kind === 'newsletter' ? 'Newsletter' : 'Announcement'} · {formatDay(post.publishedAt)}
                </span>
                <h3>{post.title}</h3>
                <p className="al-body">{post.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="ess-panel">
          <h2 className="ess-panel-title">Coming up</h2>
          {events.length === 0 ? <p className="ess-empty">No upcoming events.</p> : null}
          <div className="al-page">
            {events.slice(0, 3).map((event) => (
              <article key={event.id} className="al-card">
                <span className="al-meta">{formatDateTime(event.startsAt)}</span>
                <h3>{event.title}</h3>
                <p className="al-meta">{event.myResponse ? `Your reply: ${event.myResponse}` : 'You have not replied yet.'}</p>
              </article>
            ))}
            {events.length ? (
              <Link to="/alumni/events" className="ess-btn">
                See all events
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Profile (ALM-05) ────────────────────────────────────────────────────────

export function AlumniProfilePage() {
  const { me, setMe, fail } = useAlumni();
  const p = me.profile;
  const [form, setForm] = useState({
    currentEmployer: p.currentEmployer,
    currentDesignation: p.currentDesignation,
    industry: p.industry,
    location: p.location,
    phone: p.phone,
    contactEmail: p.contactEmail,
    linkedinUrl: p.linkedinUrl,
    skills: p.skills.join(', '),
  });
  const [visibility, setVisibility] = useState<Record<ProfileField, boolean>>(p.visibility);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const skills = form.skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);
      setMe(await updateAlumniProfile({ ...form, skills, visibility }));
      setNotice('Profile saved.');
    } catch (err) {
      setError(fail(err));
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setMe(await uploadAlumniPhoto(file));
      setPhotoVersion((v) => v + 1);
    } catch (err) {
      setError(fail(err));
    }
  }

  const text = (key: keyof typeof form, label: string, type = 'text', hint?: string) => (
    <div className="ess-field">
      <label htmlFor={`al-${key}`}>{label}</label>
      <input id={`al-${key}`} type={type} value={form[key]} onChange={(e) => set(key)(e.target.value)} />
      {hint ? <p className="ess-field-hint">{hint}</p> : null}
    </div>
  );

  return (
    <div className="al-page">
      <div className="ess-page-head">
        <div>
          <h1 className="ess-page-title">Your profile</h1>
          <p className="ess-page-lead">
            Only you and HR see everything here. In the directory, other alumni see just the fields you switch on below.
          </p>
        </div>
      </div>
      {notice ? <p className="al-ok">{notice}</p> : null}
      {error ? <p className="ess-alert">{error}</p> : null}
      <div className="al-grid-2">
        <form className="ess-panel al-page" onSubmit={save}>
          <h2 className="ess-panel-title">Where you are now</h2>
          <div className="al-form-row">
            {text('currentEmployer', 'Current employer')}
            {text('currentDesignation', 'Current designation')}
            {text('industry', 'Industry')}
            {text('location', 'Location', 'text', 'City, country')}
            {text('phone', 'Phone', 'tel')}
            {text('contactEmail', 'Contact email', 'email')}
            <div className="al-field-wide">{text('linkedinUrl', 'LinkedIn URL', 'url', 'https://www.linkedin.com/in/…')}</div>
            <div className="al-field-wide">{text('skills', 'Skills', 'text', 'Separate skills with commas.')}</div>
          </div>
          <h2 className="ess-panel-title">Show to other alumni</h2>
          <div className="al-visibility">
            {PROFILE_FIELDS.map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={visibility[key]}
                  onChange={(e) => setVisibility((current) => ({ ...current, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="ess-field-hint">
            Your name is always shown. You are {p.directoryOptIn ? 'listed' : 'not listed'} in the directory; change that under{' '}
            <Link to="/alumni/privacy">Privacy</Link>.
          </p>
          <div className="ess-actions">
            <button type="submit" className="ess-btn ess-btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
        <div className="al-page">
          <section className="ess-panel al-page">
            <h2 className="ess-panel-title">Photo</h2>
            <div className="al-person" style={{ gridTemplateColumns: '88px 1fr' }}>
              <Avatar id={me.id} name={me.fullName} hasPhoto={p.hasPhoto} large version={photoVersion} />
              <div className="ess-actions">
                <label className="ess-btn">
                  {p.hasPhoto ? 'Replace photo' : 'Upload photo'}
                  <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => void onPhoto(e.target.files?.[0])} />
                </label>
                {p.hasPhoto ? (
                  <button
                    type="button"
                    className="ess-btn ess-btn-ghost"
                    onClick={() => removeAlumniPhoto().then(setMe).catch((err) => setError(fail(err)))}
                  >
                    Remove
                  </button>
                ) : null}
                <p className="ess-field-hint">PNG or JPG, up to 2 MB.</p>
              </div>
            </div>
          </section>
          <section className="ess-panel">
            <h2 className="ess-panel-title">From your employment record</h2>
            <dl className="ess-dl">
              <div>
                <dt>Employee ID</dt>
                <dd>{me.employeeCode}</dd>
              </div>
              <div>
                <dt>Last designation</dt>
                <dd>{me.designation || '—'}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{me.departmentName || '—'}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{formatDay(me.joiningDate)}</dd>
              </div>
              <div>
                <dt>Last working day</dt>
                <dd>{formatDay(me.lastWorkingDay)}</dd>
              </div>
              <div>
                <dt>Tenure</dt>
                <dd>{me.tenure}</dd>
              </div>
            </dl>
            <p className="ess-field-hint" style={{ marginTop: 8 }}>
              These come from HR. Ask HR if something is wrong.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Directory (ALM-06) ──────────────────────────────────────────────────────

export function AlumniDirectoryPage() {
  const { me, setMe, fail } = useAlumni();
  const [filters, setFilters] = useState({ q: '', department: '', batch: '', exitYear: '', location: '', industry: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<DirectoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const optedIn = me.profile.directoryOptIn;

  useEffect(() => {
    if (!optedIn) return;
    const timer = setTimeout(() => {
      fetchDirectory({ ...filters, page })
        .then(setResult)
        .catch((err) => setError(fail(err)));
    }, 200);
    return () => clearTimeout(timer);
  }, [filters, page, optedIn, fail]);

  async function optIn() {
    try {
      await setConsent('directory', true);
      setMe({ ...me, profile: { ...me.profile, directoryOptIn: true } });
    } catch (err) {
      setError(fail(err));
    }
  }

  const change = (key: keyof typeof filters) => (value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const options = result?.options;
  const select = (key: keyof typeof filters, label: string, values: (string | number)[] = []) => (
    <label className="ess-filter-field">
      {label}
      <select value={filters[key]} onChange={(e) => change(key)(e.target.value)}>
        <option value="">Any</option>
        {values.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="al-page">
      <div className="ess-page-head">
        <div>
          <h1 className="ess-page-title">Alumni directory</h1>
          <p className="ess-page-lead">Former colleagues who chose to be listed. You see only the details each person shares.</p>
        </div>
      </div>
      {error ? <p className="ess-alert">{error}</p> : null}
      {!optedIn ? (
        <section className="ess-panel al-page">
          <p className="al-callout">The directory is open to alumni who are listed in it themselves.</p>
          <p className="ess-muted">
            Turning this on lists your name and the profile fields you have switched on. You can leave the directory at any
            time under Privacy.
          </p>
          <div className="ess-actions">
            <button type="button" className="ess-btn ess-btn-primary" onClick={() => void optIn()}>
              List me and open the directory
            </button>
            <Link to="/alumni/profile" className="ess-btn ess-btn-ghost">
              Check my visible fields first
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="ess-panel">
            <div className="ess-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              <label className="ess-filter-field" style={{ gridColumn: 'span 2' }}>
                Search
                <input value={filters.q} placeholder="Name, company, skill" onChange={(e) => change('q')(e.target.value)} />
              </label>
              {select('department', 'Department', options?.departments)}
              {select('batch', 'Batch (joined)', options?.batches)}
              {select('exitYear', 'Exit year', options?.exitYears)}
              {select('location', 'Location', options?.locations)}
              {select('industry', 'Industry', options?.industries)}
            </div>
          </section>
          {result && result.items.length === 0 ? <p className="ess-empty">No alumni match these filters.</p> : null}
          <div className="al-grid">
            {result?.items.map((card) => (
              <article key={card.id} className="al-card">
                <div className="al-person">
                  <Avatar id={card.id} name={card.fullName} hasPhoto={card.hasPhoto} />
                  <div>
                    <h3>{card.fullName}</h3>
                    <p className="al-meta">
                      {[card.currentDesignation, card.currentEmployer].filter(Boolean).join(' at ') || 'Alumnus'}
                    </p>
                  </div>
                </div>
                <p className="al-meta">
                  {[
                    card.department,
                    card.batch ? `Joined ${card.batch}` : null,
                    card.exitYear ? `Left ${card.exitYear}` : null,
                    card.location,
                    card.industry,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {card.skills?.length ? (
                  <div className="al-tags">
                    {card.skills.map((skill) => (
                      <span key={skill} className="al-tag">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="ess-actions">
                  {card.linkedinUrl ? (
                    <a href={card.linkedinUrl} target="_blank" rel="noreferrer noopener" className="ess-btn ess-btn-ghost">
                      LinkedIn
                    </a>
                  ) : null}
                  {card.contactEmail ? (
                    <a href={`mailto:${card.contactEmail}`} className="ess-btn ess-btn-ghost">
                      Email
                    </a>
                  ) : null}
                  {card.phone ? <span className="al-meta">{card.phone}</span> : null}
                </div>
              </article>
            ))}
          </div>
          {result && result.total > result.pageSize ? (
            <div className="al-pager">
              <span className="al-meta">
                {result.total} alumni · page {result.page} of {Math.ceil(result.total / result.pageSize)}
              </span>
              <div className="ess-actions">
                <button type="button" className="ess-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <button
                  type="button"
                  className="ess-btn"
                  disabled={page >= Math.ceil(result.total / result.pageSize)}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// ─── Privacy, consent and login (rules 5 and 6, ALM-04) ─────────────────────

export function AlumniPrivacyPage() {
  const { me, setMe, fail, signOut } = useAlumni();
  const [consents, setConsents] = useState<Consents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [emailStep, setEmailStep] = useState<'idle' | 'code'>('idle');
  const [emailForm, setEmailForm] = useState({ email: '', password: '', otp: '' });

  useEffect(() => {
    fetchConsents()
      .then(setConsents)
      .catch((err) => setError(fail(err)));
  }, [fail]);

  async function toggle(type: 'communications' | 'directory', granted: boolean) {
    setError(null);
    try {
      const result = await setConsent(type, granted);
      if ('current' in result) setConsents(result);
      if (type === 'directory') setMe({ ...me, profile: { ...me.profile, directoryOptIn: granted } });
      setNotice('Your choice was saved.');
    } catch (err) {
      setError(fail(err));
    }
  }

  async function withdraw() {
    try {
      await setConsent('data_processing', false);
      signOut('You withdrew your consent and your alumni access has ended. Contact HR if you want to come back.');
    } catch (err) {
      setError(fail(err));
    }
  }

  async function onPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await changeAlumniPassword(passwords.current, passwords.next);
      setPasswords({ current: '', next: '' });
      setNotice('Password changed. Other devices were signed out.');
    } catch (err) {
      setError(fail(err));
    }
  }

  async function onEmail(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (emailStep === 'idle') {
        const result = await requestEmailChange(emailForm.email, emailForm.password);
        setNotice(result.message);
        setEmailStep('code');
      } else {
        const result = await confirmEmailChange(emailForm.otp);
        setMe({ ...me, loginEmail: result.email });
        setEmailForm({ email: '', password: '', otp: '' });
        setEmailStep('idle');
        setNotice(`Your login email is now ${result.email}.`);
      }
    } catch (err) {
      setError(fail(err));
    }
  }

  const row = (type: 'communications' | 'directory', title: string, text: string) => {
    const state = consents?.current[type];
    return (
      <div className="al-consent-row">
        <div>
          <strong>{title}</strong>
          <p className="al-meta">
            {text} {state ? `Last changed ${formatDateTime(state.recordedAt)}.` : ''}
          </p>
        </div>
        <label className="al-switch">
          <input type="checkbox" checked={Boolean(state?.granted)} onChange={(e) => void toggle(type, e.target.checked)} />
          {state?.granted ? 'On' : 'Off'}
        </label>
      </div>
    );
  };

  return (
    <div className="al-page">
      <div className="ess-page-head">
        <div>
          <h1 className="ess-page-title">Privacy and login</h1>
          <p className="ess-page-lead">Every change of consent is saved with the date and time.</p>
        </div>
      </div>
      {notice ? <p className="al-ok">{notice}</p> : null}
      {error ? <p className="ess-alert">{error}</p> : null}
      <div className="al-grid-2">
        <section className="ess-panel">
          <h2 className="ess-panel-title">Your choices</h2>
          {row('communications', 'Alumni emails', 'News, newsletters, events and job openings.')}
          {row('directory', 'Directory listing', 'Show your name and chosen profile fields to other listed alumni.')}
          <div className="al-consent-row">
            <div>
              <strong>Use of my data for the alumni portal</strong>
              <p className="al-meta">
                Given {formatDateTime(consents?.current.data_processing?.recordedAt)}. Withdrawing ends your portal access and
                removes you from the directory and all emails.
              </p>
            </div>
            <button type="button" className="ess-btn ess-btn-danger" onClick={() => setConfirmWithdraw(true)}>
              Withdraw
            </button>
          </div>
          <h2 className="ess-panel-title" style={{ marginTop: 16 }}>
            History
          </h2>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Consent</th>
                  <th>Choice</th>
                </tr>
              </thead>
              <tbody>
                {consents?.history.map((item, index) => (
                  <tr key={`${item.recordedAt}-${index}`}>
                    <td>{formatDateTime(item.recordedAt)}</td>
                    <td>{item.type.replace('_', ' ')}</td>
                    <td>{item.granted ? 'Given' : 'Withdrawn'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="al-page">
          <form className="ess-panel ess-form" onSubmit={onPassword}>
            <h2 className="ess-panel-title">Change password</h2>
            <div className="ess-field">
              <label htmlFor="al-cur-pw">Current password</label>
              <input
                id="al-cur-pw"
                type="password"
                autoComplete="current-password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              />
            </div>
            <div className="ess-field">
              <label htmlFor="al-new-pw">New password</label>
              <input
                id="al-new-pw"
                type="password"
                autoComplete="new-password"
                value={passwords.next}
                onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
              />
              <p className="ess-field-hint">At least 8 characters, with a letter and a number.</p>
            </div>
            <div className="ess-actions">
              <button type="submit" className="ess-btn ess-btn-primary" disabled={!passwords.current || !passwords.next}>
                Change password
              </button>
            </div>
          </form>
          <form className="ess-panel ess-form" onSubmit={onEmail}>
            <h2 className="ess-panel-title">Login email</h2>
            <p className="ess-muted" style={{ margin: 0 }}>
              You sign in with <strong>{me.loginEmail}</strong>. A new address must be confirmed with a code sent to it.
            </p>
            {emailStep === 'idle' ? (
              <>
                <div className="ess-field">
                  <label htmlFor="al-new-email">New email</label>
                  <input
                    id="al-new-email"
                    type="email"
                    value={emailForm.email}
                    onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                  />
                </div>
                <div className="ess-field">
                  <label htmlFor="al-email-pw">Your password</label>
                  <input
                    id="al-email-pw"
                    type="password"
                    autoComplete="current-password"
                    value={emailForm.password}
                    onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <div className="ess-field">
                <label htmlFor="al-email-otp">6-digit code</label>
                <input id="al-email-otp" inputMode="numeric" value={emailForm.otp} onChange={(e) => setEmailForm({ ...emailForm, otp: e.target.value })} />
              </div>
            )}
            <div className="ess-actions">
              <button type="submit" className="ess-btn ess-btn-primary">
                {emailStep === 'idle' ? 'Send code' : 'Confirm new email'}
              </button>
              {emailStep === 'code' ? (
                <button type="button" className="ess-btn ess-btn-ghost" onClick={() => setEmailStep('idle')}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
      {confirmWithdraw ? (
        <EssModal
          title="Withdraw consent?"
          onClose={() => setConfirmWithdraw(false)}
          actions={
            <>
              <button type="button" className="ess-btn" onClick={() => setConfirmWithdraw(false)}>
                Keep my access
              </button>
              <button type="button" className="ess-btn ess-btn-danger" onClick={() => void withdraw()}>
                Withdraw and sign out
              </button>
            </>
          }
        >
          <p className="ess-modal-lead">
            Your alumni access ends straight away: you are signed out, removed from the directory and receive no more emails.
            Your employment record with HR is not affected.
          </p>
        </EssModal>
      ) : null}
    </div>
  );
}
