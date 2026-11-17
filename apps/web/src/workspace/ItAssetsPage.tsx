import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EssModal } from '../ess/components/EssModal';
import { StatusChip } from '../ess/components/StatusChip';
import {
  ASSET_LIST_LIMIT,
  ASSET_STATUS_LABELS,
  WARRANTY_WINDOW_DAYS,
  assetMessage,
  changeAssetStatus,
  daysUntil,
  fetchAllAssetCategories,
  fetchAssetLocations,
  fetchAssetPeople,
  fetchAssetSheet,
  fetchAssetSummary,
  fetchAssets,
  fetchDepartmentHeads,
  importAssetSheet,
  openRepair,
  rupees,
  shortDate,
  todayIso,
  transferAsset,
  type AssetCategory,
  type AssetPerson,
  type AssetRecord,
  type AssetRegisterSummary,
  type AssetSheetImport,
  type AssetStatus,
} from './assetsApi';
import { showToast } from '../ui/toast';
import { printAssetLabels } from './assetLabels';
import { downloadSheet, downloadSheetSample, readSheet } from './assetSheet';
import './it-assets.css';

const FILTER_KEYS = ['q', 'view', 'status', 'categoryId', 'locationId', 'departmentId'] as const;
const PAGE_SIZES = [10, 25, 50];
/** Rows sent to the server per import call. */
const IMPORT_BATCH = 100;

type BulkAction = 'transfer' | 'status' | 'repair' | null;

export function ItAssetsPage() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ''])) as Record<
    (typeof FILTER_KEYS)[number],
    string
  >;
  const [search, setSearch] = useState(filters.q);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [summary, setSummary] = useState<AssetRegisterSummary | null>(null);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [bulk, setBulk] = useState<BulkAction>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAllAssetCategories(), fetchAssetLocations(), fetchDepartmentHeads()])
      .then(([nextCategories, nextLocations, nextDepartments]) => {
        setCategories(nextCategories);
        setLocations(nextLocations);
        setDepartments(nextDepartments.map((row) => ({ id: row.id, name: row.name })));
      })
      .catch((err: unknown) => setError(assetMessage(err)));
  }, []);

  useEffect(() => {
    fetchAssetSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [reload]);

  // Typing updates the URL a moment later, so the list is not refetched on every key.
  useEffect(() => {
    if (search === filters.q) return;
    const timer = window.setTimeout(() => setFilter('q', search), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = params.toString();
  useEffect(() => {
    let live = true;
    const current = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? '']));
    fetchAssets(current)
      .then((rows) => {
        if (!live) return;
        setAssets(rows);
        setSelected((prev) => new Set([...prev].filter((id) => rows.some((row) => row.id === id))));
        setError(null);
      })
      .catch((err: unknown) => {
        if (live) setError(assetMessage(err));
      })
      .finally(() => {
        if (live) setReady(true);
      });
    setPage(0);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, reload]);

  function setFilter(key: (typeof FILTER_KEYS)[number], value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  function clearFilters() {
    setSearch('');
    setParams(new URLSearchParams(), { replace: true });
  }

  const pageRows = assets.slice(page * pageSize, page * pageSize + pageSize);
  const chosen = useMemo(() => assets.filter((asset) => selected.has(asset.id)), [assets, selected]);
  const allOnPage = pageRows.length > 0 && pageRows.every((row) => selected.has(row.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of pageRows) {
        if (allOnPage) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  }

  function finishBulk(message: string) {
    setBulk(null);
    setSelected(new Set());
    setNotice(message);
    setReload((value) => value + 1);
  }

  async function onExport() {
    setExporting(true);
    setError(null);
    try {
      await returnAsset(asset.id, next, note[asset.id]);
      setMessage(`${asset.assetTag} marked ${next.replace('_', ' ')}.`);
      showToast(`${asset.assetTag} updated.`);
      setOpenHistory(null);
      load();
      const current = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? '']));
      downloadSheet(`asset-register-${todayIso()}.csv`, await fetchAssetSheet(current));
    } catch (err: unknown) {
      setError(assetMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const pills: Array<{ view: string; label: string; count: number | null | undefined }> = [
    { view: '', label: 'All assets', count: summary?.all },
    ...(summary?.region !== null && summary?.region !== undefined
      ? [{ view: 'region', label: summary.regionName ? `My region (${summary.regionName})` : 'My region', count: summary.region }]
      : []),
    { view: 'warranty', label: 'Warranty ending', count: summary?.warranty },
    { view: 'unassigned', label: 'Unassigned', count: summary?.unassigned },
    { view: 'overdue', label: 'Overdue returns', count: summary?.overdue },
    { view: 'unacknowledged', label: 'Not acknowledged', count: summary?.unacknowledged },
  ];
  const filtered = FILTER_KEYS.some((key) => filters[key]);

  return (
    <div className="it-assets">
      <div className="it-head">
        <p className="it-assets-note">
          {ready ? `${assets.length} asset${assets.length === 1 ? '' : 's'} shown` : 'Loading…'}. Open an asset to see its details and history.
        </p>
        <div className="ess-actions">
          <button type="button" className="ess-btn" disabled={categories.length === 0} onClick={() => setImporting(true)}>
            Import from Excel
          </button>
          <button type="button" className="ess-btn" disabled={!assets.length || exporting} onClick={() => void onExport()}>
            {exporting ? 'Exporting…' : 'Export'}
          </button>
          <Link className="ess-btn" to="/it/categories">
            Categories
          </Link>
          <Link className="ess-btn ess-btn-primary" to="/it/assets/new">
            Add asset
          </Link>
        </div>
      </div>
      <p className="it-assets-note">
        Import and export use the columns of the asset register sheet, from S.No to Remarks. Export follows the filters below.{' '}
        <button type="button" className="it-linkbtn" onClick={downloadSheetSample}>
          Download sample file
        </button>
      </p>

      <div className="it-pills" role="group" aria-label="Quick views">
        {pills.map((pill) => (
          <button
            key={pill.view || 'all'}
            type="button"
            className={`it-pill${filters.view === pill.view ? ' is-active' : ''}`}
            aria-pressed={filters.view === pill.view}
            onClick={() => setFilter('view', pill.view)}
          >
            {pill.label}
            {pill.count !== null && pill.count !== undefined ? ` ${pill.count.toLocaleString('en-IN')}` : ''}
          </button>
        ))}
      </div>

      <section className="ess-panel it-filterbar">
        <label className="it-label">
          Search
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tag, serial number, employee name"
          />
        </label>
        <label className="it-label">
          Category
          <select value={filters.categoryId} onChange={(event) => setFilter('categoryId', event.target.value)}>
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="it-label">
          Status
          <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
            <option value="">All</option>
            {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="it-label">
          Location
          <select value={filters.locationId} onChange={(event) => setFilter('locationId', event.target.value)}>
            <option value="">All</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="it-label">
          Department
          <select value={filters.departmentId} onChange={(event) => setFilter('departmentId', event.target.value)}>
            <option value="">All</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="it-linkbtn" disabled={!filtered && !search} onClick={clearFilters}>
          Clear filters
        </button>
      </section>

      {error ? <p className="ess-alert">{error}</p> : null}
      {notice ? <p className="it-assets-ok">{notice}</p> : null}

      {chosen.length ? (
        <div className="it-bulkbar">
          <strong>{chosen.length} selected</strong>
          <button type="button" className="ess-btn" onClick={() => setBulk('transfer')}>
            Transfer
          </button>
          <button
            type="button"
            className="ess-btn"
            onClick={() => {
              if (!printAssetLabels(chosen)) setError('Your browser blocked the label window. Allow pop-ups for this site and try again.');
            }}
          >
            Print labels
          </button>
          <button type="button" className="ess-btn" onClick={() => setBulk('status')}>
            Change status
          </button>
          <button type="button" className="ess-btn" onClick={() => setBulk('repair')}>
            Send to repair
          </button>
          <button type="button" className="it-linkbtn" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
          <span className="it-assets-note">Each action skips assets it does not apply to and tells you which.</span>
        </div>
      ) : null}

      <section className="ess-panel">
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                <th className="it-table-check">
                  <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Select all on this page" />
                </th>
                <th>Asset tag</th>
                <th>Asset</th>
                <th>Category</th>
                <th>Assigned to</th>
                <th>Location</th>
                <th>Status</th>
                <th>Warranty until</th>
                <th>Book value</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((asset) => {
                const warrantyDays = asset.warrantyExpiry ? daysUntil(asset.warrantyExpiry) : null;
                return (
                  <tr key={asset.id} className={selected.has(asset.id) ? 'is-selected' : undefined}>
                    <td className="it-table-check">
                      <input
                        type="checkbox"
                        checked={selected.has(asset.id)}
                        onChange={() => toggle(asset.id)}
                        aria-label={`Select ${asset.assetTag}`}
                      />
                    </td>
                    <td>
                      <Link to={`/it/assets/${asset.id}`}>
                        <strong>{asset.assetTag}</strong>
                      </Link>
                    </td>
                    <td>
                      <strong>{asset.name}</strong>
                      <span className="it-sub">{asset.serialNo ? `Serial ${asset.serialNo}` : [asset.make, asset.model].filter(Boolean).join(' ') || '—'}</span>
                    </td>
                    <td>{asset.category.name}</td>
                    <td>
                      {asset.current ? (
                        <>
                          <Link to={`/it/employee-assets?employee=${asset.current.employeeId}`}>{asset.current.name}</Link>
                          <span className="it-sub">{asset.current.department ?? asset.current.employeeCode}</span>
                        </>
                      ) : (
                        <>
                          Unassigned
                          <span className="it-sub">{asset.location ? `${asset.location.name} store` : 'No location'}</span>
                        </>
                      )}
                    </td>
                    <td>{asset.location?.name ?? '—'}</td>
                    <td>
                      <StatusChip status={asset.status} label={ASSET_STATUS_LABELS[asset.status]} />
                    </td>
                    <td>
                      {!asset.warrantyExpiry ? (
                        'No warranty'
                      ) : warrantyDays !== null && warrantyDays < 0 ? (
                        'Expired'
                      ) : warrantyDays !== null && warrantyDays <= WARRANTY_WINDOW_DAYS ? (
                        <StatusChip status="pending" label={`Ends ${shortDate(asset.warrantyExpiry)}`} />
                      ) : (
                        shortDate(asset.warrantyExpiry)
                      )}
                    </td>
                    <td>
                      <strong>{rupees(asset.bookValue)}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ready && assets.length === 0 ? <p className="ess-empty">No assets match these filters.</p> : null}
        </div>
        {assets.length ? (
          <div className="it-pager">
            <span className="it-assets-note">
              Showing {page * pageSize + 1} to {Math.min(assets.length, (page + 1) * pageSize)} of {assets.length} assets
              {assets.length === ASSET_LIST_LIMIT ? `. Only the first ${ASSET_LIST_LIMIT} load; narrow your search to see the rest.` : ''}
            </span>
            <div className="ess-actions">
              <label className="it-assets-inline">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(0);
                  }}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="ess-btn" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
                Previous
              </button>
              <button
                type="button"
                className="ess-btn"
                disabled={(page + 1) * pageSize >= assets.length}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {bulk === 'transfer' ? (
        <BulkTransferModal assets={chosen} onClose={() => setBulk(null)} onDone={finishBulk} />
      ) : null}
      {bulk === 'status' ? <BulkStatusModal assets={chosen} onClose={() => setBulk(null)} onDone={finishBulk} /> : null}
      {bulk === 'repair' ? <BulkRepairModal assets={chosen} onClose={() => setBulk(null)} onDone={finishBulk} /> : null}
      {importing ? (
        <ImportSheetModal
          categories={categories.filter((category) => category.active)}
          locations={locations}
          onImported={() => setReload((value) => value + 1)}
          onClose={() => setImporting(false)}
        />
      ) : null}
    </div>
  );
}

type ImportResult = AssetSheetImport & { ignored: string[] };

/** Reads the asset sheet CSV in the browser and sends it in batches; each row is saved or rejected on its own. */
function ImportSheetModal({
  categories,
  locations,
  onImported,
  onClose,
}: {
  categories: AssetCategory[];
  locations: Array<{ id: string; name: string }>;
  onImported: () => void;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState(
    () => (categories.find((category) => category.code === 'laptop') ?? categories[0])?.id ?? '',
  );
  const [locationId, setLocationId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      setError('Save the sheet as CSV first: in Excel choose File → Save as → CSV UTF-8, then import that file.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const done: ImportResult = { created: [], failed: [], ignored: [] };
    try {
      const { rows, ignored } = readSheet(await file.text());
      done.ignored = ignored;
      if (!rows.length) throw new Error('The file has headings but no rows to import.');
      for (let start = 0; start < rows.length; start += IMPORT_BATCH) {
        setProgress(`Importing rows ${start + 1} to ${Math.min(rows.length, start + IMPORT_BATCH)} of ${rows.length}…`);
        const batch = await importAssetSheet({
          categoryId,
          locationId: locationId || null,
          rows: rows.slice(start, start + IMPORT_BATCH),
        });
        done.created.push(...batch.created);
        done.failed.push(...batch.failed);
      }
      setResult(done);
      setFile(null);
      setFileKey((value) => value + 1);
    } catch (err: unknown) {
      setError(
        `${done.created.length ? `${done.created.length} imported before this stopped. ` : ''}${assetMessage(err)}`,
      );
      if (done.created.length) setResult(done);
    } finally {
      if (done.created.length) onImported();
      setProgress('');
      setBusy(false);
    }
  }

  return (
    <EssModal
      title="Import from Excel"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="ess-btn" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </button>
          <button type="submit" form="asset-sheet-import" className="ess-btn ess-btn-primary" disabled={busy || !file || !categoryId}>
            {busy ? 'Importing…' : 'Import'}
          </button>
        </>
      }
    >
      <form id="asset-sheet-import" className="it-assets-modal-form" onSubmit={(event) => void onSubmit(event)}>
        {error ? <p className="ess-alert">{error}</p> : null}
        {result ? (
          <div className="it-stack">
            <p className="it-assets-ok">
              {result.created.length} asset{result.created.length === 1 ? '' : 's'} imported
              {result.created.length ? ` (${result.created[0].assetTag}${result.created.length > 1 ? ` to ${result.created[result.created.length - 1].assetTag}` : ''})` : ''}
              .{result.failed.length ? ` ${result.failed.length} row${result.failed.length === 1 ? '' : 's'} not imported:` : ''}
            </p>
            {result.failed.length ? (
              <ul className="it-assets-note">
                {result.failed.map((row) => (
                  <li key={row.line}>
                    Row {row.line}: {row.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {result.ignored.length ? (
              <p className="it-assets-note">Columns not in the asset sheet were ignored: {result.ignored.join(', ')}.</p>
            ) : null}
          </div>
        ) : null}
        <p className="it-assets-note">
          Use the asset register sheet with its usual headings; columns can be in any order.{' '}
          <button type="button" className="it-linkbtn" onClick={downloadSheetSample}>
            Download sample file
          </button>
        </p>
        <ul className="it-assets-note">
          <li>Each row becomes a new asset with its own tag. A serial number already in the register is not imported again.</li>
          <li>
            Rows with an Employee ID, Email ID or employee name are issued to that person, with the accessories marked Yes. Set
            Assigned/Received to Received for a device they have handed back.
          </li>
          <li>Working status can be Working, Not working (sent to repair), Lost or Retired. S.No and Reporting Manager are filled in by the system.</li>
          <li>Dates can be DD-MM-YYYY or YYYY-MM-DD. Employees are not notified about imported devices.</li>
        </ul>
        <div className="ess-field">
          <label htmlFor="sheet-category">Category for these rows</label>
          <select id="sheet-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ess-field">
          <label htmlFor="sheet-location">Location (optional)</label>
          <select id="sheet-location" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
            <option value="">Not set</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ess-field">
          <label htmlFor="sheet-file">CSV file saved from Excel</label>
          <input
            key={fileKey}
            id="sheet-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </div>
        {progress ? <p className="it-assets-note">{progress}</p> : null}
      </form>
    </EssModal>
  );
}

/** Runs one call per asset and reports what worked and what did not. */
async function runEach(assets: AssetRecord[], action: (asset: AssetRecord) => Promise<unknown>, verb: string) {
  const failed: string[] = [];
  let done = 0;
  for (const asset of assets) {
    try {
      await action(asset);
      done += 1;
    } catch (err: unknown) {
      failed.push(`${asset.assetTag}: ${assetMessage(err)}`);
    }
  }
  return { message: `${done} ${verb}.`, failed };
}

function BulkFooter({ onClose, busy, form, label }: { onClose: () => void; busy: boolean; form: string; label: string }) {
  return (
    <>
      <button type="button" className="ess-btn" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" form={form} className="ess-btn ess-btn-primary" disabled={busy}>
        {busy ? 'Working…' : label}
      </button>
    </>
  );
}

function Skipped({ assets, reason }: { assets: AssetRecord[]; reason: string }) {
  if (!assets.length) return null;
  return (
    <p className="it-assets-note">
      Skipped ({reason}): {assets.map((asset) => asset.assetTag).join(', ')}
    </p>
  );
}

function BulkTransferModal({ assets, onClose, onDone }: { assets: AssetRecord[]; onClose: () => void; onDone: (message: string) => void }) {
  const [people, setPeople] = useState<AssetPerson[]>([]);
  const [toEmployeeId, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligible = assets.filter((asset) => asset.status === 'allocated');

  useEffect(() => {
    fetchAssetPeople()
      .then((rows) => setPeople(rows.filter((row) => row.active)))
      .catch((err: unknown) => setError(assetMessage(err)));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await runEach(
      eligible.filter((asset) => asset.current?.employeeId !== toEmployeeId),
      (asset) => transferAsset(asset.id, { toEmployeeId, transferredOn: todayIso(), reason }),
      'transferred',
    );
    if (result.failed.length) {
      setError(result.failed.join(' · '));
      setBusy(false);
      return;
    }
    onDone(`${result.message} Previous holders have been asked to confirm the handover.`);
  }

  return (
    <EssModal title={`Transfer ${eligible.length} asset${eligible.length === 1 ? '' : 's'}`} onClose={onClose} actions={<BulkFooter onClose={onClose} busy={busy || !eligible.length} form="bulk-transfer" label="Transfer" />}>
      <form id="bulk-transfer" className="it-assets-modal-form" onSubmit={(event) => void onSubmit(event)}>
        {error ? <p className="ess-alert">{error}</p> : null}
        <Skipped assets={assets.filter((asset) => asset.status !== 'allocated')} reason="only allocated assets can be transferred" />
        <div className="ess-field">
          <label htmlFor="bulk-to">Transfer to</label>
          <select id="bulk-to" value={toEmployeeId} onChange={(event) => setTo(event.target.value)} required>
            <option value="">Choose an employee</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} · {person.employeeCode}
              </option>
            ))}
          </select>
        </div>
        <div className="ess-field">
          <label htmlFor="bulk-transfer-reason">Reason</label>
          <textarea id="bulk-transfer-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} required />
        </div>
      </form>
    </EssModal>
  );
}

function BulkStatusModal({ assets, onClose, onDone }: { assets: AssetRecord[]; onClose: () => void; onDone: (message: string) => void }) {
  const [status, setStatus] = useState<AssetStatus>('retired');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Allocation and repairs have their own flows; this covers the plain lifecycle moves.
  const targets: AssetStatus[] = ['in_stock', 'lost', 'retired', 'disposed', 'written_off'];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await runEach(
      assets.filter((asset) => asset.status !== status),
      (asset) => changeAssetStatus(asset.id, status, reason),
      `moved to ${ASSET_STATUS_LABELS[status]}`,
    );
    if (result.failed.length) {
      setError(`${result.message} Not changed: ${result.failed.join(' · ')}`);
      setBusy(false);
      return;
    }
    onDone(result.message);
  }

  return (
    <EssModal title={`Change status of ${assets.length} asset${assets.length === 1 ? '' : 's'}`} onClose={onClose} actions={<BulkFooter onClose={onClose} busy={busy} form="bulk-status" label="Change status" />}>
      <form id="bulk-status" className="it-assets-modal-form" onSubmit={(event) => void onSubmit(event)}>
        {error ? <p className="ess-alert">{error}</p> : null}
        <p className="it-assets-note">
          Each asset still follows its lifecycle rules. To issue an asset use Issue and return; to send it for repair use Send to repair.
        </p>
        <div className="ess-field">
          <label htmlFor="bulk-status-to">New status</label>
          <select id="bulk-status-to" value={status} onChange={(event) => setStatus(event.target.value as AssetStatus)}>
            {targets.map((value) => (
              <option key={value} value={value}>
                {ASSET_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="ess-field">
          <label htmlFor="bulk-status-reason">Reason (kept in each asset's history)</label>
          <textarea id="bulk-status-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} required />
        </div>
      </form>
    </EssModal>
  );
}

function BulkRepairModal({ assets, onClose, onDone }: { assets: AssetRecord[]; onClose: () => void; onDone: (message: string) => void }) {
  const [issue, setIssue] = useState('');
  const [vendor, setVendor] = useState('');
  const [expectedOn, setExpectedOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligible = assets.filter((asset) => asset.status === 'in_stock');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await runEach(
      eligible,
      (asset) => openRepair(asset.id, { issue, vendor, vendorContact: '', startedOn: todayIso(), expectedOn: expectedOn || undefined }),
      'sent to repair',
    );
    if (result.failed.length) {
      setError(`${result.message} Not sent: ${result.failed.join(' · ')}`);
      setBusy(false);
      return;
    }
    onDone(result.message);
  }

  return (
    <EssModal title={`Send ${eligible.length} asset${eligible.length === 1 ? '' : 's'} to repair`} onClose={onClose} actions={<BulkFooter onClose={onClose} busy={busy || !eligible.length} form="bulk-repair" label="Send to repair" />}>
      <form id="bulk-repair" className="it-assets-modal-form" onSubmit={(event) => void onSubmit(event)}>
        {error ? <p className="ess-alert">{error}</p> : null}
        <Skipped
          assets={assets.filter((asset) => asset.status !== 'in_stock')}
          reason="only in-stock assets; return allocated ones first so their condition is recorded"
        />
        <div className="ess-field">
          <label htmlFor="bulk-repair-issue">Issue</label>
          <textarea id="bulk-repair-issue" rows={2} value={issue} onChange={(event) => setIssue(event.target.value)} minLength={3} required />
        </div>
        <div className="ess-field">
          <label htmlFor="bulk-repair-vendor">Vendor</label>
          <input id="bulk-repair-vendor" value={vendor} onChange={(event) => setVendor(event.target.value)} />
        </div>
        <div className="ess-field">
          <label htmlFor="bulk-repair-expected">Expected back</label>
          <input id="bulk-repair-expected" type="date" min={todayIso()} value={expectedOn} onChange={(event) => setExpectedOn(event.target.value)} />
        </div>
      </form>
    </EssModal>
  );
}
