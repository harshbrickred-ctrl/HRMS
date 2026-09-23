import { useMemo, useState, type FormEvent } from 'react';
import { useEssData } from '../mock/EssDataContext';

type Tab = 'mine' | 'policies';

export function EssDocumentsPage() {
  const { documents, uploadDocument } = useEssData();
  const [tab, setTab] = useState<Tab>('mine');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('KYC');
  const [showUpload, setShowUpload] = useState(false);
  const [toastLocal, setToastLocal] = useState<string | null>(null);

  const mine = useMemo(
    () => documents.filter((d) => d.owner === 'mine'),
    [documents],
  );
  const policies = useMemo(
    () => documents.filter((d) => d.owner === 'company'),
    [documents],
  );

  function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    uploadDocument({ name: name.trim(), category });
    setName('');
    setShowUpload(false);
    setTab('mine');
  }

  function onDownload(docName: string) {
    setToastLocal(`Download started for ${docName} (mock).`);
    window.setTimeout(() => setToastLocal(null), 2500);
  }

  const rows = tab === 'mine' ? mine : policies;

  return (
    <div>
      <p className="ess-lead">
        Your documents and company policy library.
      </p>

      <div className="ess-tabs" role="tablist">
        <button
          type="button"
          className={tab === 'mine' ? 'ess-tab is-active' : 'ess-tab'}
          onClick={() => setTab('mine')}
        >
          My documents
        </button>
        <button
          type="button"
          className={tab === 'policies' ? 'ess-tab is-active' : 'ess-tab'}
          onClick={() => setTab('policies')}
        >
          Policies
        </button>
      </div>

      {toastLocal ? (
        <p className="ess-muted" role="status">
          {toastLocal}
        </p>
      ) : null}

      <section className="ess-panel">
        <div className="ess-panel-head">
          <h2>{tab === 'mine' ? 'My documents' : 'Policies'}</h2>
          {tab === 'mine' ? (
            <button
              type="button"
              className="ess-btn ess-btn-primary"
              onClick={() => setShowUpload((v) => !v)}
            >
              {showUpload ? 'Cancel' : 'Upload'}
            </button>
          ) : null}
        </div>

        {showUpload && tab === 'mine' ? (
          <form className="ess-form" onSubmit={onUpload} style={{ marginBottom: '1rem' }}>
            <div className="ess-field">
              <label htmlFor="doc-name">File name *</label>
              <input
                id="doc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Passport.pdf"
                required
              />
            </div>
            <div className="ess-field">
              <label htmlFor="doc-cat">Category *</label>
              <select
                id="doc-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
        ) : null}

        {rows.length === 0 ? (
          <p className="ess-empty">No documents in this list.</p>
        ) : (
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Uploaded</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td data-label="Name">
                      <strong>{d.name}</strong>
                    </td>
                    <td data-label="Category">{d.category}</td>
                    <td data-label="Uploaded">{d.uploadedAt}</td>
                    <td data-label="Size">{d.sizeLabel}</td>
                    <td data-label="Actions">
                      <button
                        type="button"
                        className="ess-btn"
                        onClick={() => onDownload(d.name)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
