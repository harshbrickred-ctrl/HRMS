import { useEffect, useState, type FormEvent } from 'react';
import {
  ASSET_CATEGORIES,
  assignAsset,
  categoryLabel,
  createAsset,
  fetchAssetHistory,
  fetchAssetPeople,
  fetchAssets,
  returnAsset,
  type AssetHistoryRow,
  type AssetPerson,
  type AssetRecord,
} from './assetsApi';
import './it-assets.css';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function ItAssetsPage() {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [people, setPeople] = useState<AssetPerson[]>([]);
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [category, setCategory] = useState<(typeof ASSET_CATEGORIES)[number]>('laptop');
  const [makeModel, setMakeModel] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [assignee, setAssignee] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<string, AssetHistoryRow[]>>({});
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load(nextStatus = status) {
    fetchAssets(nextStatus || undefined)
      .then((rows) => {
        setAssets(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(messageOf(err)));
  }

  useEffect(() => {
    load('');
    fetchAssetPeople()
      .then((rows) => {
        setPeople(rows);
        setAssignee((current) => {
          const next = { ...current };
          for (const person of rows) {
            if (!next.default) next.default = person.id;
          }
          return next;
        });
      })
      .catch((err: unknown) => setError(messageOf(err)));
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await createAsset({ assetTag: tag, category, makeModel, serialNo });
      setTag('');
      setMakeModel('');
      setSerialNo('');
      setMessage('Asset added to stock.');
      load();
    } catch (err: unknown) {
      setError(messageOf(err));
    }
  }

  async function onAssign(asset: AssetRecord) {
    const employeeId = assignee[asset.id] || people[0]?.id;
    if (!employeeId) return;
    try {
      await assignAsset(asset.id, employeeId, note[asset.id]);
      setMessage(`${asset.assetTag} assigned.`);
      setOpenHistory(null);
      load();
    } catch (err: unknown) {
      setError(messageOf(err));
    }
  }

  async function onReturn(asset: AssetRecord, next: 'in_stock' | 'repair' | 'retired') {
    try {
      await returnAsset(asset.id, next, note[asset.id]);
      setMessage(`${asset.assetTag} marked ${next.replace('_', ' ')}.`);
      setOpenHistory(null);
      load();
    } catch (err: unknown) {
      setError(messageOf(err));
    }
  }

  async function toggleHistory(id: string) {
    if (openHistory === id) {
      setOpenHistory(null);
      return;
    }
    const rows = await fetchAssetHistory(id);
    setHistory((current) => ({ ...current, [id]: rows }));
    setOpenHistory(id);
  }

  return (
    <div className="it-assets">
      <header>
        <h1>Asset register</h1>
        <p>IT owns the inventory, who has each item, and the full assignment history. HR does not manage assets.</p>
      </header>
      {error ? <p className="ess-alert">{error}</p> : null}
      {message ? <p className="it-assets-note">{message}</p> : null}

      <form className="it-assets-create" onSubmit={(event) => void onCreate(event)}>
        <label>
          Tag
          <input value={tag} onChange={(event) => setTag(event.target.value)} required />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value as (typeof ASSET_CATEGORIES)[number])}>
            {ASSET_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {categoryLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Make / model
          <input value={makeModel} onChange={(event) => setMakeModel(event.target.value)} />
        </label>
        <label>
          Serial
          <input value={serialNo} onChange={(event) => setSerialNo(event.target.value)} />
        </label>
        <button type="submit" className="ess-btn ess-btn-primary">
          Add to stock
        </button>
      </form>

      <label className="it-assets-filter">
        Status
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            load(event.target.value);
          }}
        >
          <option value="">All</option>
          <option value="in_stock">In stock</option>
          <option value="assigned">Assigned</option>
          <option value="repair">Repair</option>
          <option value="retired">Retired</option>
          <option value="lost">Lost</option>
        </select>
      </label>

      <ul className="it-assets-list">
        {assets.map((asset) => (
          <li key={asset.id}>
            <div className="it-assets-head">
              <div>
                <strong>{asset.assetTag}</strong>
                <span>
                  {categoryLabel(asset.category)}
                  {asset.makeModel ? ` · ${asset.makeModel}` : ''}
                  {asset.serialNo ? ` · ${asset.serialNo}` : ''}
                </span>
              </div>
              <span className="it-assets-status">{asset.status.replace('_', ' ')}</span>
            </div>
            <p>
              {asset.current
                ? `With ${asset.current.name} (${asset.current.employeeCode}) since ${asset.current.assignedOn}`
                : 'Not currently assigned'}
            </p>
            <div className="it-assets-actions">
              {!asset.current ? (
                <>
                  <select
                    aria-label={`Assign ${asset.assetTag}`}
                    value={assignee[asset.id] || people[0]?.id || ''}
                    onChange={(event) => setAssignee((current) => ({ ...current, [asset.id]: event.target.value }))}
                  >
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} · {person.employeeCode}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="ess-btn ess-btn-primary" onClick={() => void onAssign(asset)}>
                    Assign
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="ess-btn" onClick={() => void onReturn(asset, 'in_stock')}>
                    Return to stock
                  </button>
                  <button type="button" className="ess-btn" onClick={() => void onReturn(asset, 'repair')}>
                    Send to repair
                  </button>
                  <button type="button" className="ess-btn" onClick={() => void onReturn(asset, 'retired')}>
                    Retire
                  </button>
                </>
              )}
              <input
                aria-label={`Note for ${asset.assetTag}`}
                placeholder="Condition note"
                value={note[asset.id] ?? ''}
                onChange={(event) => setNote((current) => ({ ...current, [asset.id]: event.target.value }))}
              />
              <button type="button" className="ess-btn" onClick={() => void toggleHistory(asset.id)}>
                {openHistory === asset.id ? 'Hide history' : 'History'}
              </button>
            </div>
            {openHistory === asset.id ? (
              <ul className="it-assets-history">
                {(history[asset.id] ?? []).length === 0 ? <li>No assignments yet.</li> : null}
                {(history[asset.id] ?? []).map((row) => (
                  <li key={row.id}>
                    <strong>
                      {row.employee.name} · {row.employee.employeeCode}
                    </strong>
                    <span>
                      {row.assignedOn}
                      {row.returnedOn ? ` – ${row.returnedOn}` : ' – current'}
                      {row.conditionNotes ? ` · ${row.conditionNotes}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
