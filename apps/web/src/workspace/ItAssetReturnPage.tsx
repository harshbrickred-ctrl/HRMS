import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  RETURN_CONDITIONS,
  assetMessage,
  fetchAsset,
  fetchAssetPeople,
  fetchEmployeeAllocations,
  returnAsset,
  todayIso,
  type AssetPerson,
  type EmployeeAllocation,
  type ReturnCondition,
} from './assetsApi';
import { ItAssetIssueTabs } from './ItAssetIssueTabs';
import './it-assets.css';

export function ItAssetReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [people, setPeople] = useState<AssetPerson[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [held, setHeld] = useState<EmployeeAllocation[]>([]);
  const [assetId, setAssetId] = useState(params.get('assetId') ?? '');
  const [returnedOn, setReturnedOn] = useState(todayIso());
  // "Raise repair" on an allocated asset lands here with the condition already chosen.
  const [condition, setCondition] = useState<ReturnCondition>(
    RETURN_CONDITIONS.find((item) => item.value === params.get('condition'))?.value ?? 'good',
  );
  const [damageNotes, setDamageNotes] = useState('');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssetPeople()
      .then(setPeople)
      .catch((err: unknown) => setError(assetMessage(err)));
    const preset = params.get('assetId');
    if (preset) {
      fetchAsset(preset)
        .then((asset) => setEmployeeId(asset.current?.employeeId ?? ''))
        .catch((err: unknown) => setError(assetMessage(err)));
    }
  }, [params]);

  useEffect(() => {
    if (!employeeId) return;
    let live = true;
    fetchEmployeeAllocations(employeeId)
      .then((data) => {
        if (live) setHeld(data.current);
      })
      .catch((err: unknown) => {
        if (live) setError(assetMessage(err));
      });
    return () => {
      live = false;
    };
  }, [employeeId]);

  const allocation = held.find((row) => row.asset.id === assetId);
  const target = RETURN_CONDITIONS.find((item) => item.value === condition)?.goesTo;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (photos.length > 5) {
      setError('Add up to 5 photos.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await returnAsset(assetId, { returnedOn, condition, damageNotes, inspectionNotes }, photos);
      navigate(`/it/assets/${assetId}`, { state: { notice: `Returned. The asset is now ${target}.` } });
    } catch (err: unknown) {
      setError(assetMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="it-assets">
      <ItAssetIssueTabs />
      <p className="it-assets-note">
        Good returns go back to In Stock. Anything else goes to Under Maintenance and opens a repair record.
      </p>
      {error ? <p className="ess-alert">{error}</p> : null}
      <form className="ess-panel it-assets-form" onSubmit={(event) => void onSubmit(event)}>
        <div className="it-assets-fields">
          <div className="ess-field">
            <label htmlFor="return-employee">Employee</label>
            <select
              id="return-employee"
              value={employeeId}
              onChange={(event) => {
                setEmployeeId(event.target.value);
                setAssetId('');
                setHeld([]);
              }}
              required
            >
              <option value="">Choose an employee</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} · {person.employeeCode}
                </option>
              ))}
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="return-asset">Allocated asset</label>
            <select id="return-asset" value={assetId} onChange={(event) => setAssetId(event.target.value)} required>
              <option value="">{employeeId && held.length === 0 ? 'Nothing allocated' : 'Choose an asset'}</option>
              {held.map((row) => (
                <option key={row.id} value={row.asset.id}>
                  {row.asset.assetTag} · {row.asset.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="return-date">Return date</label>
            <input
              id="return-date"
              type="date"
              min={allocation?.assignedOn}
              max={todayIso()}
              value={returnedOn}
              onChange={(event) => setReturnedOn(event.target.value)}
              required
            />
          </div>
          <div className="ess-field">
            <label htmlFor="return-condition">Returned condition</label>
            <select
              id="return-condition"
              value={condition}
              onChange={(event) => setCondition(event.target.value as ReturnCondition)}
            >
              {RETURN_CONDITIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="return-photos">Photos (up to 5)</label>
            <input
              id="return-photos"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setPhotos([...(event.target.files ?? [])])}
            />
          </div>
        </div>

        {allocation ? (
          <p className="it-assets-note">
            Issued {allocation.assignedOn}
            {allocation.issueCondition ? ` in ${allocation.issueCondition} condition` : ''}
            {allocation.accessories ? ` with ${allocation.accessories}` : ''}. This return moves it to {target}.
          </p>
        ) : null}

        <div className="ess-field">
          <label htmlFor="return-damage">Damage notes</label>
          <textarea
            id="return-damage"
            rows={2}
            value={damageNotes}
            onChange={(event) => setDamageNotes(event.target.value)}
            maxLength={1000}
          />
        </div>
        <div className="ess-field">
          <label htmlFor="return-inspection">Inspection details</label>
          <textarea
            id="return-inspection"
            rows={2}
            value={inspectionNotes}
            onChange={(event) => setInspectionNotes(event.target.value)}
            maxLength={1000}
          />
        </div>
        <div className="ess-actions">
          <button type="submit" className="ess-btn ess-btn-primary" disabled={busy || !assetId}>
            {busy ? 'Saving…' : 'Record return'}
          </button>
          <Link className="ess-btn" to="/it/assets">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
