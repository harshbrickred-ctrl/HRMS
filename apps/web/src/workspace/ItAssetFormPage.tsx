import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  assetMessage,
  createAsset,
  fetchAsset,
  fetchAssetCategories,
  fetchAssetLocations,
  updateAsset,
  uploadAssetPhoto,
  type AssetCategory,
  type AssetDetail,
  type AssetFieldDef,
} from './assetsApi';
import './it-assets.css';

type Draft = {
  categoryId: string;
  name: string;
  make: string;
  model: string;
  serialNo: string;
  purchasedOn: string;
  vendor: string;
  owner: string;
  cost: string;
  warrantyExpiry: string;
  locationId: string;
  description: string;
  customFields: Record<string, string>;
};

const emptyDraft: Draft = {
  categoryId: '',
  name: '',
  make: '',
  model: '',
  serialNo: '',
  purchasedOn: '',
  vendor: '',
  owner: '',
  cost: '',
  warrantyExpiry: '',
  locationId: '',
  description: '',
  customFields: {},
};

function draftFrom(asset: AssetDetail): Draft {
  return {
    categoryId: asset.category.id,
    name: asset.name,
    make: asset.make,
    model: asset.model,
    serialNo: asset.serialNo ?? '',
    purchasedOn: asset.purchasedOn ?? '',
    vendor: asset.vendor,
    owner: asset.owner,
    cost: asset.cost === null ? '' : String(asset.cost),
    warrantyExpiry: asset.warrantyExpiry ?? '',
    locationId: asset.location?.id ?? '',
    description: asset.description,
    customFields: Object.fromEntries(
      Object.entries(asset.customFields).map(([key, value]) => [key, String(value)]),
    ),
  };
}

export function ItAssetFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [form, setForm] = useState<Draft>(emptyDraft);
  const [photo, setPhoto] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAssetCategories(), fetchAssetLocations(), id ? fetchAsset(id) : Promise.resolve(null)])
      .then(([nextCategories, nextLocations, current]) => {
        setCategories(nextCategories);
        setLocations(nextLocations);
        setAsset(current);
        setForm(current ? draftFrom(current) : { ...emptyDraft, categoryId: nextCategories[0]?.id ?? '' });
        setReady(true);
      })
      .catch((err: unknown) => setError(assetMessage(err)));
  }, [id]);

  const fieldDefs = useMemo<AssetFieldDef[]>(() => {
    if (asset && form.categoryId === asset.category.id) {
      return categories.find((row) => row.id === form.categoryId)?.fields ?? asset.fieldDefs;
    }
    return categories.find((row) => row.id === form.categoryId)?.fields ?? [];
  }, [asset, categories, form.categoryId]);

  // A category that has since been deactivated must stay selectable on its own assets.
  const categoryOptions =
    asset && !categories.some((row) => row.id === asset.category.id)
      ? [...categories, { id: asset.category.id, name: `${asset.category.name} (inactive)` }]
      : categories;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setCustom(key: string, value: string) {
    setForm((current) => ({ ...current, customFields: { ...current.customFields, [key]: value } }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.purchasedOn && form.warrantyExpiry && form.warrantyExpiry < form.purchasedOn) {
      setError('Warranty expiry cannot be before the purchase date.');
      return;
    }
    const input = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      make: form.make,
      model: form.model,
      serialNo: form.serialNo,
      purchasedOn: form.purchasedOn || null,
      vendor: form.vendor,
      owner: form.owner,
      cost: form.cost === '' ? null : Number(form.cost),
      warrantyExpiry: form.warrantyExpiry || null,
      locationId: form.locationId || null,
      description: form.description,
      customFields: Object.fromEntries(fieldDefs.map((def) => [def.key, form.customFields[def.key] ?? ''])),
    };
    setBusy(true);
    setError(null);
    try {
      const saved = id ? await updateAsset(id, input) : await createAsset(input);
      let notice = id ? 'Asset saved.' : `${saved.assetTag} added to stock.`;
      if (photo) {
        try {
          await uploadAssetPhoto(saved.id, photo);
        } catch (err: unknown) {
          notice = `Asset saved, but the photo was not: ${assetMessage(err)}`;
        }
      }
      navigate(`/it/assets/${saved.id}`, { state: { notice } });
    } catch (err: unknown) {
      setError(assetMessage(err));
      setBusy(false);
    }
  }

  const back = id ? `/it/assets/${id}` : '/it/assets';

  return (
    <div className="it-assets">
      <Link className="it-assets-back" to={back}>
        ← Back
      </Link>
      {error ? <p className="ess-alert">{error}</p> : null}
      {!ready ? (
        <p className="ess-empty">{error ? 'This asset could not be loaded.' : 'Loading…'}</p>
      ) : (
        <form className="ess-panel it-assets-form" onSubmit={(event) => void onSubmit(event)}>
          <h2>{asset ? `Edit ${asset.assetTag}` : 'New asset'}</h2>
          {asset ? null : <p className="ess-muted">The asset tag is generated when you save.</p>}

          <div className="it-assets-fields">
            <div className="ess-field">
              <label htmlFor="asset-category">Category</label>
              <select
                id="asset-category"
                value={form.categoryId}
                onChange={(event) => set('categoryId', event.target.value)}
                required
              >
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="ess-field">
              <label htmlFor="asset-name">Asset name</label>
              <input
                id="asset-name"
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                maxLength={160}
                required
              />
            </div>
            <div className="ess-field">
              <label htmlFor="asset-make">Make</label>
              <input id="asset-make" value={form.make} onChange={(event) => set('make', event.target.value)} maxLength={120} />
            </div>
            <div className="ess-field">
              <label htmlFor="asset-model">Model</label>
              <input id="asset-model" value={form.model} onChange={(event) => set('model', event.target.value)} maxLength={160} />
            </div>
            <div className="ess-field">
              <label htmlFor="asset-serial">Serial number</label>
              <input
                id="asset-serial"
                value={form.serialNo}
                onChange={(event) => set('serialNo', event.target.value)}
                maxLength={128}
                placeholder="Leave blank if it has none"
              />
            </div>
            <div className="ess-field">
              <label htmlFor="asset-purchased">Purchase date</label>
              <input
                id="asset-purchased"
                type="date"
                value={form.purchasedOn}
                onChange={(event) => set('purchasedOn', event.target.value)}
              />
            </div>
            <div className="ess-field">
              <label htmlFor="asset-vendor">Vendor</label>
              <input id="asset-vendor" value={form.vendor} onChange={(event) => set('vendor', event.target.value)} maxLength={160} />
            </div>
            <div className="ess-field">
              <label htmlFor="asset-owner">Asset owner</label>
              <input
                id="asset-owner"
                value={form.owner}
                onChange={(event) => set('owner', event.target.value)}
                maxLength={160}
                placeholder="e.g. Company, client, or rental vendor"
              />
            </div>
            <div className="ess-field">
              <label htmlFor="asset-cost">Cost (₹)</label>
              <input
                id="asset-cost"
                type="number"
                min={0}
                step="0.01"
                value={form.cost}
                onChange={(event) => set('cost', event.target.value)}
              />
            </div>
            <div className="ess-field">
              <label htmlFor="asset-warranty">Warranty expiry</label>
              <input
                id="asset-warranty"
                type="date"
                value={form.warrantyExpiry}
                onChange={(event) => set('warrantyExpiry', event.target.value)}
              />
            </div>
            <div className="ess-field">
              <label htmlFor="asset-location">Location</label>
              <select id="asset-location" value={form.locationId} onChange={(event) => set('locationId', event.target.value)}>
                <option value="">Not set</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            {fieldDefs.map((def) => (
              <div className="ess-field" key={def.key}>
                <label htmlFor={`asset-field-${def.key}`}>{def.label}</label>
                <input
                  id={`asset-field-${def.key}`}
                  type={def.type}
                  value={form.customFields[def.key] ?? ''}
                  onChange={(event) => setCustom(def.key, event.target.value)}
                  required={def.required}
                />
              </div>
            ))}
            <div className="ess-field">
              <label htmlFor="asset-photo">{asset?.hasPhoto ? 'Replace photo' : 'Photo'}</label>
              <input
                id="asset-photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="ess-field">
            <label htmlFor="asset-description">Description</label>
            <textarea
              id="asset-description"
              rows={3}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              maxLength={1000}
            />
          </div>

          <div className="ess-actions">
            <button type="submit" className="ess-btn ess-btn-primary" disabled={busy || !form.categoryId}>
              {busy ? 'Saving…' : asset ? 'Save changes' : 'Add to stock'}
            </button>
            <Link className="ess-btn" to={back}>
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
