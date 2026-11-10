import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { EssModal } from '../ess/components/EssModal';
import { StatusChip } from '../ess/components/StatusChip';
import {
  assetMessage,
  createAssetCategory,
  fetchAllAssetCategories,
  updateAssetCategory,
  type AssetCategory,
  type AssetFieldDef,
} from './assetsApi';
import './it-assets.css';

type Draft = {
  id: string | null;
  name: string;
  tagPrefix: string;
  fields: AssetFieldDef[];
  usefulLifeMonths: number;
};

const FIELD_TYPES: Array<{ value: AssetFieldDef['type']; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
];

/** New fields get a key from their label; saved keys never change, so stored values stay linked. */
function fieldKey(label: string) {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 38);
  return /^[a-z]/.test(key) ? key : `f_${key}`;
}

export function ItAssetCategoriesPage() {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    return fetchAllAssetCategories().then((rows) => {
      setCategories(rows);
      setError(null);
    });
  }

  useEffect(() => {
    load()
      .catch((err: unknown) => setError(assetMessage(err)))
      .finally(() => setReady(true));
  }, []);

  function open(next: Draft) {
    setFormError(null);
    setDraft(next);
  }

  function setField(index: number, patch: Partial<AssetFieldDef>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
          }
        : current,
    );
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const fields = draft.fields.map((field) => ({ ...field, key: field.key || fieldKey(field.label) }));
    setBusy(true);
    setFormError(null);
    try {
      const input = { name: draft.name, tagPrefix: draft.tagPrefix, fields, usefulLifeMonths: draft.usefulLifeMonths };
      if (draft.id) await updateAssetCategory(draft.id, input);
      else await createAssetCategory(input);
      await load();
      setNotice(`${draft.name} saved.`);
      setDraft(null);
    } catch (err: unknown) {
      setFormError(assetMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(category: AssetCategory) {
    setError(null);
    try {
      await updateAssetCategory(category.id, { active: !category.active });
      await load();
      setNotice(`${category.name} ${category.active ? 'deactivated' : 'activated'}.`);
    } catch (err: unknown) {
      setError(assetMessage(err));
    }
  }

  return (
    <div className="it-assets">
      <Link className="it-assets-back" to="/it/assets">
        ← Asset register
      </Link>
      <div className="it-assets-toolbar">
        <p className="it-assets-note">
          Each category sets its asset tag prefix and the extra fields its assets carry. Deactivate a category to stop new assets using it.
        </p>
        <button
          type="button"
          className="ess-btn ess-btn-primary"
          onClick={() => open({ id: null, name: '', tagPrefix: '', fields: [], usefulLifeMonths: 48 })}
        >
          Add category
        </button>
      </div>

      {error ? <p className="ess-alert">{error}</p> : null}
      {notice ? <p className="it-assets-ok">{notice}</p> : null}

      <section className="ess-panel">
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Tag prefix</th>
                <th>Useful life</th>
                <th>Custom fields</th>
                <th>Assets</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <strong>{category.name}</strong>
                  </td>
                  <td>{category.tagPrefix}</td>
                  <td>{category.usefulLifeMonths} months</td>
                  <td>{category.fields.map((field) => field.label).join(', ') || '—'}</td>
                  <td>{category.assetCount ?? 0}</td>
                  <td>
                    <StatusChip
                      status={category.active ? 'approved' : 'withdrawn'}
                      label={category.active ? 'Active' : 'Inactive'}
                    />
                  </td>
                  <td>
                    <div className="ess-actions">
                      <button
                        type="button"
                        className="ess-btn"
                        onClick={() =>
                          open({
                            id: category.id,
                            name: category.name,
                            tagPrefix: category.tagPrefix,
                            fields: category.fields,
                            usefulLifeMonths: category.usefulLifeMonths,
                          })
                        }
                      >
                        Edit
                      </button>
                      <button type="button" className="ess-btn ess-btn-ghost" onClick={() => void toggle(category)}>
                        {category.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ready && categories.length === 0 ? <p className="ess-empty">No categories yet.</p> : null}
        </div>
      </section>

      {draft ? (
        <EssModal
          title={draft.id ? `Edit ${draft.name}` : 'New category'}
          onClose={() => setDraft(null)}
          actions={
            <>
              <button type="button" className="ess-btn" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="submit" form="asset-category-form" className="ess-btn ess-btn-primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save category'}
              </button>
            </>
          }
        >
          <form id="asset-category-form" className="it-assets-modal-form" onSubmit={(event) => void onSave(event)}>
            {formError ? <p className="ess-alert">{formError}</p> : null}
            <div className="ess-field">
              <label htmlFor="category-name">Name</label>
              <input
                id="category-name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                maxLength={80}
                required
              />
            </div>
            <div className="ess-field">
              <label htmlFor="category-prefix">Tag prefix</label>
              <input
                id="category-prefix"
                value={draft.tagPrefix}
                onChange={(event) => setDraft({ ...draft, tagPrefix: event.target.value.toUpperCase() })}
                placeholder="LAP"
                pattern="[A-Z0-9]{2,8}"
                title="2-8 capital letters or digits"
                required
              />
              {draft.id ? <span className="it-assets-note">Changing this affects new assets only.</span> : null}
            </div>
            <div className="ess-field">
              <label htmlFor="category-life">Useful life (months)</label>
              <input
                id="category-life"
                type="number"
                min={1}
                max={600}
                value={draft.usefulLifeMonths}
                onChange={(event) => setDraft({ ...draft, usefulLifeMonths: Number(event.target.value) })}
                required
              />
              <span className="it-assets-note">Book value falls to zero over this period, straight line from the purchase date.</span>
            </div>

            <div className="it-assets-field-list">
              <strong>Custom fields</strong>
              {draft.fields.map((field, index) => (
                <div className="it-assets-field-row" key={field.key || `new-${index}`}>
                  <input
                    aria-label="Field label"
                    placeholder="Label, e.g. RAM"
                    value={field.label}
                    onChange={(event) => setField(index, { label: event.target.value })}
                    maxLength={80}
                    required
                  />
                  <select
                    aria-label={`Type of ${field.label || 'field'}`}
                    value={field.type}
                    onChange={(event) => setField(index, { type: event.target.value as AssetFieldDef['type'] })}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <label className="it-assets-check">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) => setField(index, { required: event.target.checked })}
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    className="ess-btn ess-btn-ghost"
                    onClick={() =>
                      setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index) })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  className="ess-btn"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      fields: [...draft.fields, { key: '', label: '', type: 'text', required: false }],
                    })
                  }
                >
                  Add field
                </button>
              </div>
            </div>
          </form>
        </EssModal>
      ) : null}
    </div>
  );
}
