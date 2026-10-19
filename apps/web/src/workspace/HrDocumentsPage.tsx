import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { EmployeePhoto } from '../ess/components/EmployeePhoto';
import {
  deleteHrDocument,
  downloadHrDocument,
  fetchHrEmployee,
  fetchHrEmployees,
  uploadHrDocument,
  type HrDocument,
  type HrEmployee,
} from './hrApi';
import {
  fetchEmployeePayslips,
  uploadEmployeePayslip,
  type PayslipDto,
} from './payslipApi';
import './hr-docs.css';

const CATEGORIES = [
  'Employee Documents',
  'Brickred Documents',
  'Educational Certificates',
  'Past Employment Documents',
] as const;

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.doc,.docx';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function extension(fileName: string) {
  const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
  return ext.length > 4 ? ext.slice(0, 4) : ext;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploaded(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function allowedFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'].includes(ext);
}

export function HrDocumentsPage() {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [query, setQuery] = useState('');
  const [fileQuery, setFileQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [detail, setDetail] = useState<HrEmployee | null>(null);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchHrEmployees()
      .then((rows) => {
        const sorted = [...rows].sort((a, b) => fullName(a).localeCompare(fullName(b)));
        setEmployees(sorted);
        setEmployeeId((current) => current || sorted[0]?.id || '');
        setReady(true);
      })
      .catch((err) => {
        setError(messageOf(err));
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    setDetail(null);
    setFileQuery('');
    void fetchHrEmployee(employeeId)
      .then((person) => {
        if (!cancelled) setDetail(person);
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const documents = detail?.id === employeeId ? (detail.documents ?? []) : [];
  const categories = useMemo(() => {
    const extra = documents.map((item) => item.category).filter((item) => !CATEGORIES.includes(item as (typeof CATEGORIES)[number]));
    return [...CATEGORIES, ...new Set(extra)];
  }, [documents]);

  const filteredPeople = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((person) =>
      [fullName(person), person.employeeCode, person.designation, person.departmentName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [employees, query]);

  const groups = useMemo(() => {
    const needle = fileQuery.trim().toLowerCase();
    const rows = documents.filter((item) =>
      needle ? `${item.fileName} ${item.category}`.toLowerCase().includes(needle) : true,
    );
    const order = [...categories];
    return order
      .map((name) => ({
        name,
        docs: rows.filter((item) => item.category === name),
      }))
      .filter((group) => group.docs.length > 0);
  }, [categories, documents, fileQuery]);

  function clearFile() {
    setFile(null);
    setFileKey((current) => current + 1);
  }

  function selectEmployee(id: string) {
    if (id === employeeId) return;
    if (file) {
      const leave = window.confirm('A file is selected but not uploaded. Switch people anyway?');
      if (!leave) return;
    }
    clearFile();
    setError(null);
    setMessage(null);
    setEmployeeId(id);
  }

  function onChoose(next: File | null) {
    setMessage(null);
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!allowedFile(next)) {
      clearFile();
      setError('Use a PDF, PNG, JPG, DOC, or DOCX file.');
      return;
    }
    if (next.size > MAX_BYTES) {
      clearFile();
      setError('Choose a file up to 10 MB.');
      return;
    }
    setFile(next);
  }

  async function onUpload(event: FormEvent) {
    event.preventDefault();
    if (!file || !employeeId) {
      setError('Choose a file to upload.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await uploadHrDocument(employeeId, file, category.trim());
      setDetail(updated);
      clearFile();
      setMessage(`${file.name} saved in ${category.trim()}.`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDownload(document: HrDocument) {
    if (!detail) return;
    setWorkingId(document.id);
    setError(null);
    try {
      await downloadHrDocument(detail.id, document.id, document.fileName);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setWorkingId(null);
    }
  }

  async function onRemove(document: HrDocument) {
    if (!detail) return;
    const confirmed = window.confirm(`Remove ${document.fileName}? This deletes the file.`);
    if (!confirmed) return;
    setWorkingId(document.id);
    setError(null);
    setMessage(null);
    try {
      const updated = await deleteHrDocument(detail.id, document.id);
      setDetail(updated);
      setMessage(`${document.fileName} removed.`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setWorkingId(null);
    }
  }

  if (!ready) {
    return <p className="hr-docs-empty">Loading documents…</p>;
  }

  const loaded = detail?.id === employeeId;

  return (
    <div className="hr-docs">
      <p className="hr-docs-lead">
        Keep each person’s files in a category. Upload a PDF, image, or Word document, then download
        or remove it here.
      </p>
      {error && !loaded ? (
        <p className="hr-docs-alert" role="alert">
          {error}
        </p>
      ) : null}
      <dl className="hr-docs-stats">
        <div>
          <dt>People</dt>
          <dd>{employees.length}</dd>
        </div>
        <div>
          <dt>Files</dt>
          <dd>{loaded ? documents.length : '—'}</dd>
        </div>
        <div>
          <dt>Categories</dt>
          <dd>{loaded ? new Set(documents.map((item) => item.category)).size : '—'}</dd>
        </div>
      </dl>

      <div className="hr-docs-workspace">
        <aside className="hr-docs-rail" aria-label="Employees">
          <div className="hr-docs-rail-head">
            <h2>People</h2>
            <span>{employees.length}</span>
          </div>
          <label className="hr-docs-search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              aria-label="Search people"
              value={query}
              placeholder="Search name, code, or team"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <ul className="hr-docs-people">
            {filteredPeople.map((person) => {
              const name = fullName(person);
              const selected = person.id === employeeId;
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    className={selected ? 'is-selected' : undefined}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => selectEmployee(person.id)}
                  >
                    <EmployeePhoto src={person.photo} name={name} size="sm" />
                    <span>
                      <strong>{name}</strong>
                      <span>
                        {person.employeeCode}
                        {person.departmentName ? ` · ${person.departmentName}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {filteredPeople.length === 0 ? (
            <p className="hr-docs-empty">No people match that search.</p>
          ) : null}
        </aside>

        <section className="hr-docs-detail">
          {!loaded || !detail ? (
            <p className="hr-docs-empty">Loading files…</p>
          ) : (
            <>
              <header className="hr-docs-person">
                <EmployeePhoto src={detail.photo} name={fullName(detail)} size="md" />
                <div>
                  <h2>{fullName(detail)}</h2>
                  <p>
                    {detail.employeeCode}
                    {detail.designation ? ` · ${detail.designation}` : ''}
                  </p>
                  <p>
                    {[detail.departmentName, detail.locationName].filter(Boolean).join(' · ') ||
                      'No department assigned'}
                  </p>
                  <p role={error ? 'alert' : 'status'} className={error ? 'is-error' : undefined}>
                    {error ?? message ?? `${documents.length === 1 ? '1 file' : `${documents.length} files`} on record.`}
                  </p>
                </div>
              </header>

              <form className="hr-docs-upload" onSubmit={(event) => void onUpload(event)}>
                <label>
                  <span>Category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="hr-docs-file">
                  <span>File</span>
                  <span className="hr-docs-file-control">
                    <input
                      key={fileKey}
                      ref={fileInput}
                      type="file"
                      accept={ACCEPT}
                      aria-label="Choose a file"
                      onChange={(event) => onChoose(event.target.files?.[0] ?? null)}
                    />
                    <button type="button" onClick={() => fileInput.current?.click()}>
                      Choose file
                    </button>
                    <span>
                      {file
                        ? `${file.name} · ${formatSize(file.size)}`
                        : 'PDF, PNG, JPG, DOC, or DOCX · up to 10 MB'}
                    </span>
                  </span>
                </div>
                <button type="submit" className="ess-btn ess-btn-primary" disabled={!file || busy}>
                  {busy ? 'Uploading…' : 'Upload'}
                </button>
              </form>

              {documents.length > 0 ? (
                <label className="hr-docs-search">
                  <Search size={16} aria-hidden />
                  <input
                    type="search"
                    aria-label="Search files"
                    value={fileQuery}
                    placeholder="Search file name"
                    onChange={(event) => setFileQuery(event.target.value)}
                  />
                </label>
              ) : null}

              {documents.length === 0 ? (
                <p className="hr-docs-empty">No files for this person yet.</p>
              ) : groups.length === 0 ? (
                <p className="hr-docs-empty">No files match that search.</p>
              ) : (
                <div className="hr-docs-groups">
                  {groups.map((group) => (
                    <section key={group.name}>
                      <h3>{group.name}</h3>
                      <ul>
                        {group.docs.map((document) => (
                          <li key={document.id}>
                            <span className="hr-docs-ext" aria-hidden>
                              {extension(document.fileName)}
                            </span>
                            <span className="hr-docs-file-copy">
                              <strong>{document.fileName}</strong>
                              <span>{formatUploaded(document.uploadedAt)}</span>
                            </span>
                            <span className="hr-docs-row-actions">
                              <button
                                type="button"
                                className="ess-btn"
                                disabled={workingId === document.id}
                                onClick={() => void onDownload(document)}
                              >
                                Download
                              </button>
                              <button
                                type="button"
                                className="ess-btn ess-btn-danger"
                                disabled={workingId === document.id}
                                onClick={() => void onRemove(document)}
                              >
                                Remove
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
      {selectedId ? <PayslipUploadPanel employeeId={selectedId} /> : null}
    </div>
  );
}

function PayslipUploadPanel({ employeeId }: { employeeId: string }) {
  const [payslips, setPayslips] = useState<PayslipDto[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetchEmployeePayslips(employeeId)
      .then(setPayslips)
      .catch((err: unknown) => setError(messageOf(err)));
  }

  useEffect(() => {
    load();
  }, [employeeId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Choose a PDF payslip.');
      return;
    }
    try {
      await uploadEmployeePayslip(employeeId, month, label || `Payslip ${month}`, file);
      setFile(null);
      setLabel('');
      setMessage('Payslip uploaded.');
      setError(null);
      load();
    } catch (err: unknown) {
      setError(messageOf(err));
    }
  }

  return (
    <section className="ess-panel" style={{ marginTop: 16 }}>
      <h2>Payslip PDFs</h2>
      <p className="ess-muted">Upload the monthly PDF. PeopleOS does not calculate payroll.</p>
      {error ? <p className="ess-alert">{error}</p> : null}
      {message ? <p className="ess-muted">{message}</p> : null}
      <ul className="ess-list">
        {payslips.map((slip) => (
          <li key={slip.id} className="ess-list-item">
            <strong>{slip.label}</strong>
            <span className="ess-muted">
              {slip.month} · {slip.fileName}
            </span>
          </li>
        ))}
      </ul>
      <form className="ess-form" onSubmit={(event) => void onSubmit(event)}>
        <div className="ess-field">
          <label htmlFor="payslip-month">Month</label>
          <input
            id="payslip-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            required
          />
        </div>
        <div className="ess-field">
          <label htmlFor="payslip-label">Label</label>
          <input
            id="payslip-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="September 2026"
          />
        </div>
        <div className="ess-field">
          <label htmlFor="payslip-file">PDF</label>
          <input
            id="payslip-file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </div>
        <button type="submit" className="ess-btn ess-btn-primary">
          Upload payslip
        </button>
      </form>
    </section>
  );
}
