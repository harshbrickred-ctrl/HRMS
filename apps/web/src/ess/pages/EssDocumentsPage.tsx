import { useMemo, useState, type FormEvent } from 'react';
import { useEssData } from '../mock/EssDataContext';

export function EssDocumentsPage() {
  const { documents, uploadDocument } = useEssData();
  const [list, setList] = useState<'mine' | 'policies'>('mine');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('KYC');
  const [toastLocal, setToastLocal] = useState<string | null>(null);

  const mine = useMemo(() => documents.filter((doc) => doc.owner === 'mine'), [documents]);
  const policies = useMemo(
    () => documents.filter((doc) => doc.owner === 'company'),
    [documents],
  );
  const rows = list === 'mine' ? mine : policies;

  function onUpload(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    uploadDocument({ name: name.trim(), category });
    setName('');
    setList('mine');
  }

  function onDownload(docName: string) {
    setToastLocal(`Download started for ${docName} (mock).`);
    window.setTimeout(() => setToastLocal(null), 2500);
  }

  return (
    <div className="ess-section-stack">
      <div className="ess-insights">
        <article className="ess-panel ess-insight">
          <p className="ess-muted">My files</p>
          <p className="ess-insight-value">{mine.length}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Policies</p>
          <p className="ess-insight-value">{policies.length}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Library</p>
          <p className="ess-insight-value">{documents.length}</p>
        </article>
      </div>

      {toastLocal ? (
        <p className="ess-muted" role="status">
          {toastLocal}
        </p>
      ) : null}

      <div className="ess-att-split">
        <section className="ess-panel">
          <div className="ess-att-toolbar">
            <h2>{list === 'mine' ? 'My documents' : 'Policies'}</h2>
            <div className="ess-tabs" role="tablist" aria-label="Document lists">
              <button
                type="button"
                role="tab"
                aria-selected={list === 'mine'}
                className={list === 'mine' ? 'ess-tab is-active' : 'ess-tab'}
                onClick={() => setList('mine')}
              >
                Mine
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={list === 'policies'}
                className={list === 'policies' ? 'ess-tab is-active' : 'ess-tab'}
                onClick={() => setList('policies')}
              >
                Policies
              </button>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="ess-empty">No documents in this list.</p>
          ) : (
            <ul className="ess-list">
              {rows.map((doc) => (
                <li key={doc.id} className="ess-list-item">
                  <div className="ess-leave-request-head">
                    <strong>{doc.name}</strong>
                    <button type="button" className="ess-btn" onClick={() => onDownload(doc.name)}>
                      Download
                    </button>
                  </div>
                  <span className="ess-list-meta">
                    <span>{doc.category}</span>
                    <span>{doc.uploadedAt}</span>
                    <span>{doc.sizeLabel}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ess-panel">
          <h2>Upload</h2>
          <form className="ess-form" onSubmit={onUpload}>
            <div className="ess-field">
              <label htmlFor="doc-name">File name</label>
              <input
                id="doc-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Passport.pdf"
                required
              />
            </div>
            <div className="ess-field">
              <label htmlFor="doc-cat">Category</label>
              <select
                id="doc-cat"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="KYC">KYC</option>
                <option value="Employment">Employment</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <button type="submit" className="ess-btn ess-btn-primary">
              Add document
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
