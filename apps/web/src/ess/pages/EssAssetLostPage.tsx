import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  assetMessage,
  fetchMyAsset,
  reportAssetLoss,
  todayIso,
  type MyAssetDetail,
} from '../../workspace/assetsApi';

export function EssAssetLostPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<MyAssetDetail | null>(null);
  const [reportType, setReportType] = useState('lost');
  const [lostOn, setLostOn] = useState(todayIso());
  const [location, setLocation] = useState('');
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
      await reportAssetLoss({ allocationId: id, reportType, lostOn, location, description }, files);
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
        <h2>Report lost or stolen{asset ? `: ${asset.assetTag}` : ''}</h2>
        <p className="ess-muted">The asset team will review this report and contact you.</p>
        <form className="ess-form" onSubmit={(event) => void onSubmit(event)}>
          <div className="ess-field">
            <label htmlFor="loss-type">Report type</label>
            <select id="loss-type" value={reportType} onChange={(event) => setReportType(event.target.value)}>
              <option value="lost">Lost</option>
              <option value="stolen">Stolen</option>
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="loss-date">Date lost</label>
            <input
              id="loss-date"
              type="date"
              min={asset?.assignedOn}
              max={todayIso()}
              value={lostOn}
              onChange={(event) => setLostOn(event.target.value)}
              required
            />
          </div>
          <div className="ess-field">
            <label htmlFor="loss-location">Location</label>
            <input
              id="loss-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              minLength={2}
              maxLength={200}
              required
            />
          </div>
          <div className="ess-field">
            <label htmlFor="loss-description">What happened?</label>
            <textarea
              id="loss-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={3}
              maxLength={4000}
              required
            />
          </div>
          <div className="ess-field">
            <label htmlFor="loss-files">Supporting documents or photos (up to 5)</label>
            <input
              id="loss-files"
              type="file"
              multiple
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(event) => setFiles([...(event.target.files ?? [])])}
            />
          </div>
          <button type="submit" className="ess-btn ess-btn-danger" disabled={busy || !asset}>
            {busy ? 'Sending…' : 'Send report'}
          </button>
        </form>
      </section>
    </div>
  );
}
