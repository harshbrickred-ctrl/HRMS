import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FAULT_CATEGORIES,
  assetMessage,
  fetchMyAsset,
  reportAssetFault,
  type MyAssetDetail,
} from '../../workspace/assetsApi';

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function EssAssetFaultPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<MyAssetDetail | null>(null);
  const [category, setCategory] = useState('hardware');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyAsset(id)
      .then(setAsset)
      .catch((err: unknown) => setError(assetMessage(err)));
  }, [id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (files.length > 5) {
      setError('Attach up to 5 files.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reportAssetFault({ allocationId: id, category, priority, description }, files);
      navigate('/ess/assets/reports');
    } catch (err: unknown) {
      setError(assetMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="ess-section-stack ess-assets">
      <Link className="ess-btn ess-btn-ghost it-assets-back" to={`/ess/assets/${id}`}>
        ← Back to asset
      </Link>
      {error ? <p className="ess-alert">{error}</p> : null}
      <section className="ess-panel">
        <h2>Report a fault{asset ? `: ${asset.assetTag}` : ''}</h2>
        <form className="ess-form" onSubmit={(event) => void onSubmit(event)}>
          <div className="ess-field">
            <label htmlFor="fault-category">Issue category</label>
            <select id="fault-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              {FAULT_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="fault-priority">Priority</label>
            <select id="fault-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="fault-description">What is wrong?</label>
            <textarea
              id="fault-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={3}
              maxLength={4000}
              required
            />
          </div>
          <div className="ess-field">
            <label htmlFor="fault-files">Photos (up to 5)</label>
            <input
              id="fault-files"
              type="file"
              multiple
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(event) => setFiles([...(event.target.files ?? [])])}
            />
          </div>
          <button type="submit" className="ess-btn ess-btn-primary" disabled={busy || !asset}>
            {busy ? 'Sending…' : 'Send report'}
          </button>
        </form>
      </section>
    </div>
  );
}
