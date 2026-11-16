import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../alumni/alumni.css';
import { formatDay } from '../alumni/alumniApi';
import { Chip, Steps } from '../alumni/alumniUi';
import { EssModal } from '../ess/components/EssModal';
import { HrAlumniTabs, message } from './HrAlumniPage';
import { decideRequest, fetchDocumentRequests, issueRequest, reviewRequest, type HrDocumentRequest } from './hrAlumniApi';

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'submitted', label: 'New' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved, to issue' },
  { value: 'issued', label: 'Issued' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

/** ALM-08: review, decide, then issue. Every step is kept in the history. */
export function HrAlumniRequestsPage() {
  const [filter, setFilter] = useState('open');
  const [rows, setRows] = useState<HrDocumentRequest[]>([]);
  const [rejecting, setRejecting] = useState<HrDocumentRequest | null>(null);
  const [issuing, setIssuing] = useState<HrDocumentRequest | null>(null);
  const [note, setNote] = useState('');
  const [issue, setIssue] = useState<{ title: string; period: string; file: File | null }>({ title: '', period: '', file: null });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchDocumentRequests(filter === 'open' ? undefined : filter)
      .then((list) => setRows(filter === 'open' ? list.filter((row) => ['submitted', 'under_review', 'approved'].includes(row.status)) : list))
      .catch((err) => setError(message(err)));
  }, [filter]);

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

  return (
    <div className="al-page">
      <div className="al-hr-head">
        <div>
          <h1 className="ess-page-title">Alumni document requests</h1>
          <p className="ess-page-lead">Duplicate copies and documents that are not in an alumnus's vault. The alumnus is emailed at each decision.</p>
        </div>
      </div>
      <HrAlumniTabs />
      {notice ? <p className="al-ok">{notice}</p> : null}
      {error ? <p className="ess-alert">{error}</p> : null}
      <div className="ess-tabs" role="tablist" style={{ marginBottom: 0 }}>
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filter === item.value}
            className={`ess-tab${filter === item.value ? ' is-active' : ''}`}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section className="ess-panel">
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                <th>Alumnus</th>
                <th>Document</th>
                <th>Reason</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link className="al-linkbtn" to={`/hr/alumni/${row.alumni.id}`}>
                      {row.alumni.fullName}
                    </Link>
                    <span className="al-sub">
                      {row.alumni.employeeCode} · sent {formatDay(row.createdAt)}
                    </span>
                  </td>
                  <td>
                    {row.typeLabel}
                    {row.period ? <span className="al-sub">{row.period}</span> : null}
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    {row.reason}
                    {row.decisionNote ? <span className="al-sub">HR: {row.decisionNote}</span> : null}
                  </td>
                  <td>
                    <Chip status={row.status} />
                    <Steps history={row.history} />
                  </td>
                  <td className="al-table-actions">
                    {row.status === 'submitted' ? (
                      <button type="button" className="ess-btn" onClick={() => void act(() => reviewRequest(row.id), 'Marked under review.')}>
                        Start review
                      </button>
                    ) : null}
                    {row.status === 'submitted' || row.status === 'under_review' ? (
                      <>
                        <button
                          type="button"
                          className="ess-btn ess-btn-primary"
                          onClick={() => void act(() => decideRequest(row.id, 'approve', ''), 'Approved. Issue the document when it is ready.')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="ess-btn ess-btn-ghost"
                          onClick={() => {
                            setNote('');
                            setRejecting(row);
                          }}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {row.status === 'approved' ? (
                      <button
                        type="button"
                        className="ess-btn ess-btn-primary"
                        onClick={() => {
                          setIssue({ title: row.typeLabel, period: row.period, file: null });
                          setIssuing(row);
                        }}
                      >
                        Issue document
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="ess-empty">No requests here.</p> : null}
        </div>
      </section>

      {rejecting ? (
        <EssModal
          title={`Reject ${rejecting.typeLabel} request`}
          onClose={() => setRejecting(null)}
          actions={
            <>
              <button type="button" className="ess-btn" onClick={() => setRejecting(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="ess-btn ess-btn-danger"
                disabled={note.trim().length < 3}
                onClick={() => {
                  const target = rejecting;
                  setRejecting(null);
                  void act(() => decideRequest(target.id, 'reject', note.trim()), 'Request rejected. The alumnus was told why.');
                }}
              >
                Reject
              </button>
            </>
          }
        >
          <div className="al-modal-form">
            <div className="ess-field">
              <label htmlFor="al-reject-note">Reason (sent to {rejecting.alumni.fullName})</label>
              <textarea id="al-reject-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </EssModal>
      ) : null}

      {issuing ? (
        <EssModal
          title={`Issue ${issuing.typeLabel}`}
          onClose={() => setIssuing(null)}
          actions={
            <>
              <button type="button" className="ess-btn" onClick={() => setIssuing(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="ess-btn ess-btn-primary"
                disabled={!issue.file}
                onClick={() => {
                  const target = issuing;
                  setIssuing(null);
                  void act(() => issueRequest(target.id, issue, issue.file!), 'Document issued and emailed to the alumnus.');
                }}
              >
                Issue
              </button>
            </>
          }
        >
          <div className="al-modal-form">
            <p className="ess-modal-lead">The file goes into {issuing.alumni.fullName}'s document vault, visible only to them.</p>
            <div className="ess-field">
              <label htmlFor="al-issue-title">Title</label>
              <input id="al-issue-title" value={issue.title} onChange={(e) => setIssue({ ...issue, title: e.target.value })} />
            </div>
            <div className="ess-field">
              <label htmlFor="al-issue-period">Period</label>
              <input id="al-issue-period" value={issue.period} onChange={(e) => setIssue({ ...issue, period: e.target.value })} />
            </div>
            <div className="ess-field">
              <label htmlFor="al-issue-file">File (PDF, image or Word, up to 10 MB)</label>
              <input
                id="al-issue-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={(e) => setIssue({ ...issue, file: e.target.files?.[0] ?? null })}
              />
            </div>
          </div>
        </EssModal>
      ) : null}
    </div>
  );
}
