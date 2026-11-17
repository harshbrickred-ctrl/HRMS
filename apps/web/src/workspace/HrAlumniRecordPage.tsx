import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import '../alumni/alumni.css';
import { DOCUMENT_TYPES, formatDateTime, formatDay, type DocumentType } from '../alumni/alumniApi';
import { Chip } from '../alumni/alumniUi';
import { EssModal } from '../ess/components/EssModal';
import { HrAlumniTabs, message } from './HrAlumniPage';
import {
  ACCESS_LABELS,
  ELIGIBILITY_LABELS,
  downloadAlumniDocument,
  fetchAlumniRecord,
  revokeAlumniDocument,
  revokeInvitation,
  sendInvitation,
  updateAlumniEmail,
  updateEligibility,
  uploadAlumniDocument,
  type AlumniDetail,
  type Eligibility,
} from './hrAlumniApi';

const TYPE_LABEL = Object.fromEntries(DOCUMENT_TYPES.map((type) => [type.value, type.label])) as Record<DocumentType, string>;

export function HrAlumniRecordPage() {
  const { id = '' } = useParams();
  const [record, setRecord] = useState<AlumniDetail | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility>('eligible');
  const [reason, setReason] = useState('');
  const [confirmDnc, setConfirmDnc] = useState(false);
  const [email, setEmail] = useState('');
  const [doc, setDoc] = useState<{ type: DocumentType; title: string; period: string }>({ type: 'experience_letter', title: 'Experience letter', period: '' });
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback((detail: AlumniDetail) => {
    setRecord(detail);
    setEligibility(detail.eligibility);
    setReason(detail.eligibilityReason);
    setEmail(detail.personalEmail);
  }, []);

  useEffect(() => {
    fetchAlumniRecord(id)
      .then(show)
      .catch((err) => setError(message(err)));
  }, [id, show]);

  async function act(action: () => Promise<void>, done?: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      if (done) setNotice(done);
    } catch (err) {
      setError(message(err));
    }
  }

  function onEligibility(event: FormEvent) {
    event.preventDefault();
    if (eligibility === 'do_not_contact' && record?.eligibility !== 'do_not_contact') {
      setConfirmDnc(true);
      return;
    }
    void act(async () => show(await updateEligibility(id, eligibility, reason)), 'Eligibility saved.');
  }

  function onUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    void act(async () => {
      await uploadAlumniDocument(id, doc, file);
      setFile(null);
      setFileKey((k) => k + 1);
      show(await fetchAlumniRecord(id));
    }, 'Document issued. The alumnus was emailed if they can be contacted.');
  }

  if (!record) {
    return (
      <div className="al-page">
        <Link to="/hr/alumni" className="al-back">
          ← Alumni
        </Link>
        {error ? <p className="ess-alert">{error}</p> : <p className="ess-empty">Loading…</p>}
      </div>
    );
  }

  const openInvite = record.invitations.find((invite) => !invite.acceptedAt && !invite.revokedAt && new Date(invite.expiresAt) > new Date());
  const canInvite = record.eligibility === 'eligible' && record.access !== 'registered';

  return (
    <div className="al-page">
      <Link to="/hr/alumni" className="al-back">
        ← Alumni
      </Link>
      <div className="al-hr-head">
        <div>
          <h1 className="ess-page-title">{record.fullName}</h1>
          <p className="ess-page-lead">
            {record.employeeCode} · {record.designation || '—'}
            {record.departmentName ? `, ${record.departmentName}` : ''}
          </p>
        </div>
        <div className="ess-actions">
          <Chip status={record.eligibility} label={ELIGIBILITY_LABELS[record.eligibility]} />
          <Chip status={record.access} label={ACCESS_LABELS[record.access]} />
        </div>
      </div>
      <HrAlumniTabs />
      {notice ? <p className="al-ok">{notice}</p> : null}
      {error ? <p className="ess-alert">{error}</p> : null}

      <div className="al-grid-2">
        <div className="al-page">
          <section className="ess-panel">
            <h2 className="ess-panel-title">Alumni record</h2>
            <dl className="ess-dl">
              <div>
                <dt>Joined</dt>
                <dd>{formatDay(record.joiningDate)}</dd>
              </div>
              <div>
                <dt>Last working day</dt>
                <dd>{formatDay(record.lastWorkingDay)}</dd>
              </div>
              <div>
                <dt>Tenure</dt>
                <dd>{record.tenure}</dd>
              </div>
              <div>
                <dt>Exit completed</dt>
                <dd>{formatDay(record.exitClosure?.exitCompletedOn)}</dd>
              </div>
              <div>
                <dt>F&amp;F settled</dt>
                <dd>
                  {formatDay(record.exitClosure?.fnfSettledOn)}
                  {record.exitClosure?.fnfReference ? ` · ${record.exitClosure.fnfReference}` : ''}
                </dd>
              </div>
              <div>
                <dt>Personal email</dt>
                <dd>{record.personalEmail}</dd>
              </div>
              <div>
                <dt>Login email</dt>
                <dd>{record.account?.email ?? '—'}</dd>
              </div>
            </dl>
            {record.access !== 'registered' ? (
              <form
                className="ess-actions"
                style={{ marginTop: 10, alignItems: 'end' }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void act(async () => show(await updateAlumniEmail(id, email)), 'Personal email corrected. Earlier invitation links stop working.');
                }}
              >
                <div className="ess-field" style={{ flex: 1 }}>
                  <label htmlFor="al-hr-email">Correct the personal email</label>
                  <input id="al-hr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <button type="submit" className="ess-btn" disabled={email === record.personalEmail}>
                  Save email
                </button>
              </form>
            ) : null}
          </section>

          <section className="ess-panel al-page">
            <h2 className="ess-panel-title">Documents</h2>
            <div className="ess-table-wrap">
              <table className="ess-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Issued</th>
                    <th>Downloads</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {record.documents.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.title}
                        <span className="al-sub">
                          {TYPE_LABEL[item.type]}
                          {item.period ? ` · ${item.period}` : ''}
                          {item.source === 'payslip_copy' ? ' · copied from payroll' : ''}
                        </span>
                      </td>
                      <td>
                        {formatDay(item.issuedAt)}
                        {item.revokedAt ? <span className="al-sub">Revoked {formatDay(item.revokedAt)}</span> : null}
                      </td>
                      <td>{item.downloadCount}</td>
                      <td className="al-table-actions">
                        <button type="button" className="ess-btn ess-btn-ghost" onClick={() => void act(() => downloadAlumniDocument(id, item))}>
                          Download
                        </button>
                        {!item.revokedAt ? (
                          <button
                            type="button"
                            className="ess-btn ess-btn-ghost"
                            onClick={() =>
                              void act(async () => {
                                await revokeAlumniDocument(id, item.id);
                                show(await fetchAlumniRecord(id));
                              }, 'Document revoked. The alumnus can no longer download it.')
                            }
                          >
                            Revoke
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {record.documents.length === 0 ? <p className="ess-empty">No documents yet.</p> : null}
            </div>
            <form className="al-form-row" onSubmit={onUpload} style={{ alignItems: 'end' }}>
              <div className="ess-field">
                <label htmlFor="al-doc-type">Type</label>
                <select
                  id="al-doc-type"
                  value={doc.type}
                  onChange={(e) => {
                    const type = e.target.value as DocumentType;
                    setDoc({ ...doc, type, title: TYPE_LABEL[type] });
                  }}
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ess-field">
                <label htmlFor="al-doc-title">Title</label>
                <input id="al-doc-title" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
              </div>
              <div className="ess-field">
                <label htmlFor="al-doc-period">Period</label>
                <input id="al-doc-period" placeholder="e.g. FY 2025-26" value={doc.period} onChange={(e) => setDoc({ ...doc, period: e.target.value })} />
              </div>
              <div className="ess-field">
                <label htmlFor="al-doc-file">File</label>
                <input key={fileKey} id="al-doc-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="ess-actions">
                <button type="submit" className="ess-btn ess-btn-primary" disabled={!file || !doc.title.trim()}>
                  Issue document
                </button>
              </div>
            </form>
          </section>

          <section className="ess-panel">
            <h2 className="ess-panel-title">Activity</h2>
            <ul className="al-steps">
              {record.requests.map((request) => (
                <li key={request.id}>
                  Document request · {TYPE_LABEL[request.type]} · {request.status.replace('_', ' ')} · {formatDay(request.createdAt)}
                </li>
              ))}
              {record.applications.map((app) => (
                <li key={app.id}>
                  Applied for {app.jobTitle} · {app.status} · {formatDay(app.createdAt)}
                </li>
              ))}
              {record.referrals.map((ref) => (
                <li key={ref.id}>
                  Referred {ref.candidateName} · {ref.status}
                  {ref.rewardStatus !== 'not_applicable' ? ` · reward ${ref.rewardStatus}` : ''}
                </li>
              ))}
              {record.rehires.map((rehire) => (
                <li key={rehire.id}>
                  Rehire · {rehire.status} · joining {formatDay(rehire.joiningDate)}
                </li>
              ))}
            </ul>
            {!record.requests.length && !record.applications.length && !record.referrals.length && !record.rehires.length ? (
              <p className="ess-empty">No activity yet.</p>
            ) : null}
          </section>
        </div>

        <div className="al-page">
          <form className="ess-panel ess-form" onSubmit={onEligibility}>
            <h2 className="ess-panel-title">Eligibility</h2>
            <div className="ess-field">
              <label htmlFor="al-eligibility">Status</label>
              <select id="al-eligibility" value={eligibility} onChange={(e) => setEligibility(e.target.value as Eligibility)}>
                {Object.entries(ELIGIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ess-field">
              <label htmlFor="al-reason">Reason {eligibility === 'eligible' ? '(optional)' : ''}</label>
              <textarea id="al-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {eligibility === 'do_not_contact' ? (
              <p className="al-callout">
                Do not contact closes the portal login, blocks document downloads, cancels open requests and stops all emails.
              </p>
            ) : null}
            <p className="ess-field-hint">
              {record.eligibilityUpdatedAt
                ? `Last changed ${formatDateTime(record.eligibilityUpdatedAt)} by ${record.eligibilityUpdatedBy ?? 'HR'}.`
                : 'Not changed since the record was created.'}
            </p>
            <div className="ess-actions">
              <button
                type="submit"
                className="ess-btn ess-btn-primary"
                disabled={eligibility === record.eligibility && reason === record.eligibilityReason}
              >
                Save eligibility
              </button>
            </div>
          </form>

          <section className="ess-panel al-page">
            <h2 className="ess-panel-title">Portal access</h2>
            {record.account ? (
              <dl className="ess-dl">
                <div>
                  <dt>Registered</dt>
                  <dd>{formatDateTime(record.account.registeredAt)}</dd>
                </div>
                <div>
                  <dt>Email verified</dt>
                  <dd>{formatDateTime(record.account.emailVerifiedAt)}</dd>
                </div>
                <div>
                  <dt>Last sign-in</dt>
                  <dd>{formatDateTime(record.account.lastLoginAt)}</dd>
                </div>
                <div>
                  <dt>Emails</dt>
                  <dd>{record.account.communications ? 'Agreed' : 'Off'}</dd>
                </div>
                <div>
                  <dt>Directory</dt>
                  <dd>{record.directoryOptIn ? 'Listed' : 'Not listed'}</dd>
                </div>
                {record.account.locked ? (
                  <div>
                    <dt>Locked</dt>
                    <dd>Too many failed sign-ins; unlocks automatically.</dd>
                  </div>
                ) : null}
                {record.account.statusReason ? (
                  <div>
                    <dt>Note</dt>
                    <dd>{record.account.statusReason}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="ess-muted">No alumni login yet.</p>
            )}
            {openInvite ? (
              <p className="ess-muted" style={{ margin: 0 }}>
                Invitation sent {formatDateTime(openInvite.sentAt)} to {openInvite.email}; expires {formatDateTime(openInvite.expiresAt)}.
              </p>
            ) : null}
            {record.access !== 'registered' && record.eligibility !== 'eligible' ? (
              <p className="ess-muted" style={{ margin: 0 }}>
                Only alumni marked Eligible can be invited.
              </p>
            ) : null}
            <div className="ess-actions" hidden={record.access === 'registered'}>
              <button
                type="button"
                className="ess-btn ess-btn-primary"
                disabled={!canInvite}
                onClick={() =>
                  void act(async () => {
                    const sent = await sendInvitation(id);
                    show(await fetchAlumniRecord(id));
                    setNotice(sent.emailSent ? `Invitation emailed to ${sent.email}.` : 'Invitation created, but the email could not be sent.');
                  })
                }
              >
                {openInvite ? 'Resend invitation' : 'Send invitation'}
              </button>
              {openInvite ? (
                <button
                  type="button"
                  className="ess-btn ess-btn-ghost"
                  onClick={() =>
                    void act(async () => {
                      await revokeInvitation(id);
                      show(await fetchAlumniRecord(id));
                    }, 'Invitation revoked.')
                  }
                >
                  Revoke invitation
                </button>
              ) : null}
            </div>
          </section>

          <section className="ess-panel">
            <h2 className="ess-panel-title">Consent trail</h2>
            {record.consents.length === 0 ? <p className="ess-empty">No consent recorded yet.</p> : null}
            <ul className="al-steps">
              {record.consents.map((consent, index) => (
                <li key={`${consent.recordedAt}-${index}`}>
                  {consent.type.replace('_', ' ')} {consent.granted ? 'given' : 'withdrawn'} · {formatDateTime(consent.recordedAt)} · v
                  {consent.version}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {confirmDnc ? (
        <EssModal
          title={`Mark ${record.fullName} as Do not contact?`}
          onClose={() => setConfirmDnc(false)}
          actions={
            <>
              <button type="button" className="ess-btn" onClick={() => setConfirmDnc(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="ess-btn ess-btn-danger"
                onClick={() => {
                  setConfirmDnc(false);
                  void act(async () => show(await updateEligibility(id, eligibility, reason)), 'Marked Do not contact. Access revoked and logged.');
                }}
              >
                Revoke access
              </button>
            </>
          }
        >
          <p className="ess-modal-lead">
            Their alumni login is closed at once, document downloads stop, open document requests are cancelled and no further
            emails are sent. The change is written to the audit log.
          </p>
        </EssModal>
      ) : null}
    </div>
  );
}
