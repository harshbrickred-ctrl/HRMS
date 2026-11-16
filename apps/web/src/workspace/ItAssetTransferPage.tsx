import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  assetMessage,
  fetchAssetPeople,
  fetchAssets,
  todayIso,
  transferAsset,
  type AssetPerson,
  type AssetRecord,
} from './assetsApi';
import { ItAssetIssueTabs } from './ItAssetIssueTabs';
import './it-assets.css';

export function ItAssetTransferPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [people, setPeople] = useState<AssetPerson[]>([]);
  const [assetId, setAssetId] = useState(params.get('assetId') ?? '');
  const [toEmployeeId, setToEmployeeId] = useState('');
  const [transferredOn, setTransferredOn] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAssets({ status: 'allocated' }), fetchAssetPeople()])
      .then(([allocated, staff]) => {
        setAssets(allocated);
        setPeople(staff.filter((person) => person.active));
      })
      .catch((err: unknown) => setError(assetMessage(err)));
  }, []);

  const chosen = assets.find((asset) => asset.id === assetId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await transferAsset(assetId, { toEmployeeId, transferredOn, reason });
      navigate(`/it/assets/${assetId}`, {
        state: { notice: 'Transferred. Both employees have been asked to acknowledge it.' },
      });
    } catch (err: unknown) {
      setError(assetMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="it-assets">
      <ItAssetIssueTabs />
      <p className="it-assets-note">
        The asset moves straight to the new holder and stays Allocated. Both employees are then asked to acknowledge.
      </p>
      {error ? <p className="ess-alert">{error}</p> : null}
      <form className="ess-panel it-assets-form" onSubmit={(event) => void onSubmit(event)}>
        <div className="it-assets-fields">
          <div className="ess-field">
            <label htmlFor="transfer-asset">Allocated asset</label>
            <select id="transfer-asset" value={assetId} onChange={(event) => setAssetId(event.target.value)} required>
              <option value="">Choose an asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetTag} · {asset.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="transfer-holder">Current employee</label>
            <input
              id="transfer-holder"
              value={chosen?.current ? `${chosen.current.name} · ${chosen.current.employeeCode}` : ''}
              readOnly
            />
          </div>
          <div className="ess-field">
            <label htmlFor="transfer-to">Receiving employee</label>
            <select
              id="transfer-to"
              value={toEmployeeId}
              onChange={(event) => setToEmployeeId(event.target.value)}
              required
            >
              <option value="">Choose an employee</option>
              {people
                .filter((person) => person.id !== chosen?.current?.employeeId)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.employeeCode}
                  </option>
                ))}
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="transfer-date">Transfer date</label>
            <input
              id="transfer-date"
              type="date"
              min={chosen?.current?.assignedOn}
              max={todayIso()}
              value={transferredOn}
              onChange={(event) => setTransferredOn(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="ess-field">
          <label htmlFor="transfer-reason">Reason</label>
          <textarea
            id="transfer-reason"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={3}
            maxLength={1000}
            required
          />
        </div>
        <div className="ess-actions">
          <button type="submit" className="ess-btn ess-btn-primary" disabled={busy}>
            {busy ? 'Transferring…' : 'Transfer'}
          </button>
          <Link className="ess-btn" to="/it/assets">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
