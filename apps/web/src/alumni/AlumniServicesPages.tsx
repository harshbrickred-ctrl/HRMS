import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { EssModal } from '../ess/components/EssModal';
import {
  DOCUMENT_TYPES,
  applyForJob,
  cancelDocumentRequest,
  createDocumentRequest,
  createReferral,
  downloadMyDocument,
  fetchAnnouncements,
  fetchApplications,
  fetchEvents,
  fetchJobs,
  fetchMyDocuments,
  fetchMyRequests,
  fetchReferrals,
  formatDateTime,
  formatDay,
  rsvpEvent,
  withdrawApplication,
  type AlumniDocument,
  type AlumniEvent,
  type Announcement,
  type Application,
  type DocumentRequest,
  type DocumentType,
  type Job,
  type Referral,
} from './alumniApi';
import { useAlumni } from './AlumniLayout';
import { Chip, Steps } from './alumniUi';

// ─── Documents and requests (ALM-07, ALM-08) ─────────────────────────────────

export function AlumniDocumentsPage() {
  const { fail } = useAlumni();
  const [documents, setDocuments] = useState<AlumniDocument[]>([]);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [form, setForm] = useState<{ type: DocumentType; period: string; reason: string }>({
    type: 'experience_letter',
    period: '',
    reason: '',
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchMyDocuments(), fetchMyRequests()])
      .then(([docs, reqs]) => {
        setDocuments(docs);
        setRequests(reqs);
      })
      .catch((err) => setError(fail(err)));
  }, [fail]);

  useEffect(load, [load]);

  async function download(doc: Pick<AlumniDocument, 'id' | 'fileName'>) {
    setError(null);
    try {
      await downloadMyDocument(doc);
    } catch (err) {
      setError(fail(err));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createDocumentRequest({ type: form.type, period: form.period.trim() || undefined, reason: form.reason.trim() });
      setForm({ ...form, period: '', reason: '' });
      setNotice('Request sent to HR. You will get an email when it is decided.');
      load();
    } catch (err) {
      setError(fail(err));
    }
  }

  async function cancel(id: string) {
    try {
      await cancelDocumentRequest(id);
      load();
    } catch (err) {
      setError(fail(err));
    }
  }

  return (
    <div className="al-page">
      <div className="ess-page-head">
        <div>
          <h1 className="ess-page-title">Your documents</h1>
          <p className="ess-page-lead">
            Download anything HR has issued to you. For a duplicate copy or a document that is not here, send a request; HR
            approves it first.
          </p>
        </div>
      </div>
      {notice ? <p className="al-ok">{notice}</p> : null}
      {error ? <p className="ess-alert">{error}</p> : null}
      <div className="al-grid-2">
        <section className="ess-panel">
          <h2 className="ess-panel-title">Ready to download</h2>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Period</th>
                  <th>Issued</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      {doc.title}
                      {doc.typeLabel !== doc.title ? <span className="al-sub">{doc.typeLabel}</span> : null}
                    </td>
                    <td>{doc.period || '—'}</td>
                    <td>{formatDay(doc.issuedAt)}</td>
                    <td className="al-table-actions">
                      <button type="button" className="ess-btn" onClick={() => void download(doc)}>
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {documents.length === 0 ? <p className="ess-empty">No documents yet.</p> : null}
          </div>
        </section>
        <form className="ess-panel ess-form" onSubmit={submit}>
          <h2 className="ess-panel-title">Request a document</h2>
          <div className="ess-field">
            <label htmlFor="al-req-type">Document</label>
            <select id="al-req-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DocumentType })}>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="al-req-period">Period (optional)</label>
            <input id="al-req-period" placeholder="e.g. 2025-03 or FY 2024-25" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
          </div>
          <div className="ess-field">
            <label htmlFor="al-req-reason">Why do you need it?</label>
            <textarea id="al-req-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="ess-actions">
            <button type="submit" className="ess-btn ess-btn-primary" disabled={form.reason.trim().length < 5}>
              Send request
            </button>
          </div>
        </form>
      </div>
      <section className="ess-panel">
        <h2 className="ess-panel-title">Your requests</h2>
        {requests.length === 0 ? <p className="ess-empty">No requests yet.</p> : null}
        <div className="al-grid">
          {requests.map((request) => (
            <article key={request.id} className="al-card">
              <div className="ess-actions" style={{ justifyContent: 'space-between' }}>
                <h3>{request.typeLabel}</h3>
                <Chip status={request.status} />
              </div>
              <p className="al-meta">
                {request.period ? `${request.period} · ` : ''}Sent {formatDay(request.createdAt)}
              </p>
              <p>{request.reason}</p>
              {request.decisionNote ? <p className="al-meta">HR: {request.decisionNote}</p> : null}
              <Steps history={request.history} />
              <div className="ess-actions">
                {request.documentId ? (
                  <button
                    type="button"
                    className="ess-btn"
                    onClick={() =>
                      void download({
                        id: request.documentId!,
                        fileName: documents.find((doc) => doc.id === request.documentId)?.fileName ?? `${request.typeLabel}.pdf`,
                      })
                    }
                  >
                    Download
                  </button>
                ) : null}
                {request.status === 'submitted' || request.status === 'under_review' ? (
                  <button type="button" className="ess-btn ess-btn-ghost" onClick={() => void cancel(request.id)}>
                    Cancel request
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── News and events (ALM-09) ────────────────────────────────────────────────

export function AlumniEventsPage() {
  const { fail } = useAlumni();
  const [events, setEvents] = useState<AlumniEvent[]>([]);
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchEvents(), fetchAnnouncements()])
      .then(([eventList, postList]) => {
        setEvents(eventList);
        setPosts(postList);
      })
      .catch((err) => setError(fail(err)));
  }, [fail]);

  async function answer(id: string, response: 'going' | 'maybe' | 'declined') {
    setError(null);
    try {
      const updated = await rsvpEvent(id, response);
      setEvents((current) => current.map((event) => (event.id === id ? updated : event)));
    } catch (err) {
      setError(fail(err));
    }
  }

  const now = new Date();
  const upcoming = events.filter((event) => new Date(event.startsAt) > now);
  const past = events.filter((event) => new Date(event.startsAt) <= now);

  return (
    <div className="al-page">
      <div className="ess-page-head">
        <div>
          <h1 className="ess-page-title">News and events</h1>
          <p className="ess-page-lead">Events and posts HR has shared with your alumni group.</p>
        </div>
      </div>
      {error ? <p className="ess-alert">{error}</p> : null}
      <section className="ess-panel">
        <h2 className="ess-panel-title">Upcoming events</h2>
        {upcoming.length === 0 ? <p className="ess-empty">No upcoming events.</p> : null}
        <div className="al-grid">
          {upcoming.map((event) => {
            const closed = event.status === 'cancelled' || Boolean(event.rsvpBy && new Date(event.rsvpBy) < now);
            return (
              <article key={event.id} className="al-card">
                <div className="ess-actions" style={{ justifyContent: 'space-between' }}>
                  <h3>{event.title}</h3>
                  {event.status === 'cancelled' ? <Chip status="cancelled" /> : null}
                </div>
                <p className="al-meta">
                  {formatDateTime(event.startsAt)}
                  {event.venue ? ` · ${event.venue}` : ''}
                </p>
                {event.description ? <p className="al-body">{event.description}</p> : null}
                {event.meetingUrl ? (
                  <a href={event.meetingUrl} target="_blank" rel="noreferrer noopener" className="al-meta">
                    Join link
                  </a>
                ) : null}
                <p className="al-meta">
                  {event.going} going{event.spotsLeft !== null ? ` · ${event.spotsLeft} spots left` : ''}
                  {event.rsvpBy ? ` · reply by ${formatDateTime(event.rsvpBy)}` : ''}
                </p>
                {!closed ? (
                  <div className="ess-actions">
                    {(['going', 'maybe', 'declined'] as const).map((response) => (
                      <button
                        key={response}
                        type="button"
                        className={`ess-btn${event.myResponse === response ? ' ess-btn-primary' : ''}`}
                        onClick={() => void answer(event.id, response)}
                        disabled={response === 'going' && event.spotsLeft === 0 && event.myResponse !== 'going'}
                      >
                        {response === 'going' ? 'Going' : response === 'maybe' ? 'Maybe' : "Can't go"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="al-meta">{event.myResponse ? `Your reply: ${event.myResponse}` : 'Replies are closed.'}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section className="ess-panel">
        <h2 className="ess-panel-title">Announcements and newsletters</h2>
        {posts.length === 0 ? <p className="ess-empty">Nothing yet.</p> : null}
        <div className="al-page">
          {posts.map((post) => (
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
      {past.length ? (
        <section className="ess-panel">
          <h2 className="ess-panel-title">Recent events</h2>
          <ul className="al-steps">
            {past.map((event) => (
              <li key={event.id}>
                {event.title} · {formatDateTime(event.startsAt)}
                {event.status === 'cancelled' ? ' · cancelled' : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

// ─── Job board (ALM-10) ──────────────────────────────────────────────────────

export function AlumniJobsPage() {
  const { fail } = useAlumni();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applying, setApplying] = useState<Job | null>(null);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchJobs(), fetchApplications()])
      .then(([jobList, apps]) => {
        setJobs(jobList);
        setApplications(apps);
      })
      .catch((err) => setError(fail(err)));
  }, [fail]);

  useEffect(load, [load]);

  async function apply() {
    if (!applying) return;
    try {
      await applyForJob(applying.id, note.trim());
      setNotice(`Applied for ${applying.title}. As a former employee you skip the first screening round.`);
      setApplying(null);
      setNote('');
      load();
    } catch (err) {
      setError(fail(err));
    }
  }

  async function withdraw(id: string) {
    try {
      await withdrawApplication(id);
      load();
    } catch (err) {
      setError(fail(err));
    }
  }

  return (
    <div className="al-page">
      <div className="ess-page-head">
        <div>
          <h1 className="ess-page-title">Jobs</h1>
          <p className="ess-page-lead">Open roles for alumni. Former employees are fast-tracked and HR reuses your past record.</p>
        </div>
      </div>
      {notice ? <p className="al-ok">{notice}</p> : null}
      {error ? <p className="ess-alert">{error}</p> : null}
      {jobs.length === 0 ? <p className="ess-empty">No open jobs right now.</p> : null}
      <div className="al-grid">
        {jobs.map((job) => (
          <article key={job.id} className="al-card">
            <h3>{job.title}</h3>
            <p className="al-meta">
              {[job.departmentName, job.location, job.employmentType, job.experience].filter(Boolean).join(' · ')}
            </p>
            <p className="al-body">{job.description}</p>
            {job.closesOn ? <p className="al-meta">Closes {formatDay(job.closesOn)}</p> : null}
            <div className="ess-actions">
              {job.myApplication ? (
                <Chip status={job.myApplication.status} label={`Applied · ${job.myApplication.status}`} />
              ) : (
                <button type="button" className="ess-btn ess-btn-primary" onClick={() => setApplying(job)}>
                  Apply
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <section className="ess-panel">
        <h2 className="ess-panel-title">Your applications</h2>
        {applications.length === 0 ? <p className="ess-empty">You have not applied yet.</p> : null}
        <div className="al-grid">
          {applications.map((app) => (
            <article key={app.id} className="al-card">
              <div className="ess-actions" style={{ justifyContent: 'space-between' }}>
                <h3>{app.job.title}</h3>
                <Chip status={app.status} />
              </div>
              <p className="al-meta">
                Applied {formatDay(app.createdAt)}
                {app.fastTrack ? ' · fast-tracked' : ''}
              </p>
              <Steps history={app.history} />
              {['applied', 'shortlisted', 'interviewing', 'offered'].includes(app.status) ? (
                <div className="ess-actions">
                  <button type="button" className="ess-btn ess-btn-ghost" onClick={() => void withdraw(app.id)}>
                    Withdraw
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
      {applying ? (
        <EssModal
          title={`Apply: ${applying.title}`}
          onClose={() => setApplying(null)}
          actions={
            <>
              <button type="button" className="ess-btn" onClick={() => setApplying(null)}>
                Cancel
              </button>
              <button type="button" className="ess-btn ess-btn-primary" onClick={() => void apply()}>
                Send application
              </button>
            </>
          }
        >
          <div className="al-modal-form">
            <p className="ess-modal-lead">HR already has your previous employment details, so a short note is enough.</p>
            <div className="ess-field">
              <label htmlFor="al-apply-note">Note to HR (optional)</label>
              <textarea id="al-apply-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </EssModal>
      ) : null}
    </div>
  );
}

// ─── Referrals (ALM-11) ──────────────────────────────────────────────────────

export function AlumniReferralsPage() {
  const { fail } = useAlumni();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState({ jobId: '', candidateName: '', candidateEmail: '', candidatePhone: '', relationship: '', note: '' });
  const [resume, setResume] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchReferrals(), fetchJobs()])
      .then(([refs, jobList]) => {
        setReferrals(refs);
        setJobs(jobList);
      })
      .catch((err) => setError(fail(err)));
  }, [fail]);

  useEffect(load, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createReferral(form, resume);
      setForm({ jobId: '', candidateName: '', candidateEmail: '', candidatePhone: '', relationship: '', note: '' });
      setResume(null);
      setFileKey((k) => k + 1);
      setNotice('Thank you. HR will review the referral.');
      load();
    } catch (err) {
      setError(fail(err));
    }
  }

  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="al-page">
      <div className="ess-page-head">
        <div>
          <h1 className="ess-page-title">Referrals</h1>
          <p className="ess-page-lead">Refer someone you trust. You can follow the status and any reward here.</p>
        </div>
      </div>
      {notice ? <p className="al-ok">{notice}</p> : null}
      {error ? <p className="ess-alert">{error}</p> : null}
      <div className="al-grid-2">
        <section className="ess-panel">
          <h2 className="ess-panel-title">Your referrals</h2>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Reward</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => (
                  <tr key={ref.id}>
                    <td>
                      {ref.candidateName}
                      <span className="al-sub">{ref.candidateEmail}</span>
                    </td>
                    <td>{ref.job?.title ?? 'Any suitable role'}</td>
                    <td>
                      <Chip status={ref.status} />
                    </td>
                    <td>
                      {ref.rewardStatus === 'not_applicable' ? (
                        '—'
                      ) : (
                        <>
                          <Chip status={ref.rewardStatus} />
                          <span className="al-sub">
                            {ref.rewardAmount ? `${ref.rewardCurrency} ${ref.rewardAmount.toLocaleString('en-IN')}` : ''}
                            {ref.rewardPaidOn ? ` · paid ${formatDay(ref.rewardPaidOn)}` : ''}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {referrals.length === 0 ? <p className="ess-empty">No referrals yet.</p> : null}
          </div>
        </section>
        <form className="ess-panel ess-form" onSubmit={submit}>
          <h2 className="ess-panel-title">Refer a candidate</h2>
          <div className="ess-field">
            <label htmlFor="al-ref-job">Job</label>
            <select id="al-ref-job" value={form.jobId} onChange={(e) => set('jobId')(e.target.value)}>
              <option value="">Any suitable role</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="al-ref-name">Candidate name</label>
            <input id="al-ref-name" value={form.candidateName} onChange={(e) => set('candidateName')(e.target.value)} />
          </div>
          <div className="ess-field">
            <label htmlFor="al-ref-email">Candidate email</label>
            <input id="al-ref-email" type="email" value={form.candidateEmail} onChange={(e) => set('candidateEmail')(e.target.value)} />
          </div>
          <div className="ess-field">
            <label htmlFor="al-ref-phone">Candidate phone (optional)</label>
            <input id="al-ref-phone" type="tel" value={form.candidatePhone} onChange={(e) => set('candidatePhone')(e.target.value)} />
          </div>
          <div className="ess-field">
            <label htmlFor="al-ref-rel">How do you know them? (optional)</label>
            <input id="al-ref-rel" value={form.relationship} onChange={(e) => set('relationship')(e.target.value)} />
          </div>
          <div className="ess-field">
            <label htmlFor="al-ref-note">Note (optional)</label>
            <textarea id="al-ref-note" value={form.note} onChange={(e) => set('note')(e.target.value)} />
          </div>
          <div className="ess-field">
            <label htmlFor="al-ref-cv">CV (optional, PDF or Word, up to 5 MB)</label>
            <input
              key={fileKey}
              id="al-ref-cv"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResume(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="ess-field-hint">Make sure the candidate is happy for you to share their details.</p>
          <div className="ess-actions">
            <button type="submit" className="ess-btn ess-btn-primary" disabled={form.candidateName.trim().length < 2 || !form.candidateEmail.trim()}>
              Send referral
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
