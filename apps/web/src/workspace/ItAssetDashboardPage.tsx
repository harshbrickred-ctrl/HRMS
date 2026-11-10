import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  assetMessage,
  fetchAllAssetCategories,
  fetchAssetDashboard,
  fetchAssetLocations,
  timeAgo,
  type AssetCategory,
  type AssetDashboard,
} from './assetsApi';
import './it-assets.css';

function percent(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

export function ItAssetDashboardPage() {
  const [data, setData] = useState<AssetDashboard | null>(null);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAllAssetCategories(), fetchAssetLocations()])
      .then(([nextCategories, nextLocations]) => {
        setCategories(nextCategories);
        setLocations(nextLocations);
      })
      .catch((err: unknown) => setError(assetMessage(err)));
  }, []);

  useEffect(() => {
    let live = true;
    fetchAssetDashboard({ locationId, categoryId })
      .then((next) => {
        if (!live) return;
        setData(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (live) setError(assetMessage(err));
      });
    return () => {
      live = false;
    };
  }, [locationId, categoryId]);

  // Links into the register carry the dashboard's filters with them.
  function registerLink(params: Record<string, string>) {
    const query = new URLSearchParams({ ...params, ...(locationId ? { locationId } : {}), ...(categoryId ? { categoryId } : {}) });
    return `/it/assets${query.size ? `?${query}` : ''}`;
  }

  const filters = (
    <div className="it-head">
      <p className="it-assets-note">
        {data ? `${data.total} assets${data.locations ? ` across ${data.locations} location${data.locations === 1 ? '' : 's'}` : ''}` : 'Loading…'}
      </p>
      <div className="it-head-filters">
        <label className="it-label">
          Location
          <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="it-label">
          Category
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <Link className="ess-btn" to="/it/assets/new">
          Add asset
        </Link>
        <Link className="ess-btn ess-btn-primary" to="/it/allocate">
          Issue asset
        </Link>
      </div>
    </div>
  );

  if (!data) {
    return (
      <div className="it-assets">
        {filters}
        {error ? <p className="ess-alert">{error}</p> : <p className="ess-empty">Loading…</p>}
      </div>
    );
  }

  const tiles: Array<{ label: string; value: number; sub: string; to: string }> = [
    {
      label: 'Total assets',
      value: data.total,
      sub: data.locations ? `Across ${data.locations} location${data.locations === 1 ? '' : 's'}` : 'In the register',
      to: registerLink({}),
    },
    {
      label: 'Allocated',
      value: data.allocated,
      sub: `${percent(data.allocated, data.total)}% of all assets`,
      to: registerLink({ status: 'allocated' }),
    },
    { label: 'In stock', value: data.available, sub: 'Ready to issue', to: registerLink({ view: 'unassigned' }) },
    {
      label: 'Under maintenance',
      value: data.underMaintenance,
      sub: 'With vendors or IT',
      to: '/it/maintenance',
    },
    { label: 'Warranty ends in 30 days', value: data.warrantyEnding, sub: 'Renew or replace', to: registerLink({ view: 'warranty' }) },
    {
      label: 'Pending approvals',
      value: data.pendingApprovals,
      sub: data.pendingOlderThan3Days ? `${data.pendingOlderThan3Days} older than 3 days` : 'None older than 3 days',
      to: '/it/requests',
    },
  ];

  const attention: Array<{ count: number; label: string; tone: string; to: string }> = [
    { count: data.attention.warranty, label: 'Warranty expiring in 30 days', tone: 'is-warn', to: registerLink({ view: 'warranty' }) },
    { count: data.attention.overdue, label: 'Overdue returns', tone: 'is-danger', to: registerLink({ view: 'overdue' }) },
    {
      count: data.attention.unacknowledged,
      label: data.attention.ackLate
        ? `Issued but not acknowledged (${data.attention.ackLate} past due)`
        : 'Issued but not acknowledged',
      tone: 'is-warn',
      to: registerLink({ view: 'unacknowledged' }),
    },
    { count: data.attention.openFaults, label: 'Open fault reports', tone: 'is-danger', to: '/it/maintenance' },
    { count: data.attention.lost, label: 'Lost, waiting for write-off', tone: 'is-info', to: '/it/requests?tab=writeoffs' },
  ];

  const largest = Math.max(1, ...data.byCategory.map((row) => row.total));

  return (
    <div className="it-assets">
      {filters}
      {error ? <p className="ess-alert">{error}</p> : null}

      <div className="it-kpis">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.to} className="ess-panel ess-insight it-kpi">
            <p className="ess-muted">{tile.label}</p>
            <p className="ess-insight-value">{tile.value.toLocaleString('en-IN')}</p>
            <p className="it-kpi-sub">{tile.sub}</p>
          </Link>
        ))}
      </div>

      <div className="it-grid-2">
        <section className="ess-panel">
          <h2>Assets by category</h2>
          {data.byCategory.length === 0 ? <p className="ess-empty">No assets match these filters.</p> : null}
          <ul className="it-bars">
            {[...data.byCategory]
              .sort((a, b) => b.total - a.total)
              .map((row) => (
                <li key={row.category}>
                  <span>{row.category}</span>
                  <span className="it-meter" aria-hidden>
                    <span style={{ width: `${(row.total / largest) * 100}%` }} />
                  </span>
                  <strong>{row.total.toLocaleString('en-IN')}</strong>
                </li>
              ))}
          </ul>
        </section>

        <section className="ess-panel">
          <h2>Needs attention</h2>
          <ul className="it-attention">
            {attention.map((item) => (
              <li key={item.label}>
                <span className={`it-count ${item.count ? item.tone : ''}`}>{item.count}</span>
                <span>{item.label}</span>
                {item.count ? <Link to={item.to}>Review</Link> : <span className="it-assets-note">Clear</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="it-grid-2">
        <section className="ess-panel">
          <h2>Utilisation by location</h2>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Total</th>
                  <th>Allocated</th>
                  <th>In stock</th>
                  <th>Allocated share</th>
                </tr>
              </thead>
              <tbody>
                {data.byLocation.map((row) => {
                  const share = percent(row.allocated, row.total);
                  return (
                    <tr key={row.location}>
                      <td>
                        {row.locationId ? (
                          <Link to={`/it/assets?locationId=${row.locationId}`}>
                            <strong>{row.location}</strong>
                          </Link>
                        ) : (
                          <strong>{row.location}</strong>
                        )}
                      </td>
                      <td>{row.total.toLocaleString('en-IN')}</td>
                      <td>{row.allocated.toLocaleString('en-IN')}</td>
                      <td>{row.inStock.toLocaleString('en-IN')}</td>
                      <td>
                        <span className="it-meter-inline">
                          <span className="it-meter" aria-hidden>
                            <span style={{ width: `${share}%` }} />
                          </span>
                          {share}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.byLocation.length === 0 ? <p className="ess-empty">No assets match these filters.</p> : null}
          </div>
        </section>

        <section className="ess-panel">
          <h2>Recent activity</h2>
          {data.activity.length === 0 ? <p className="ess-empty">Nothing has happened yet.</p> : null}
          <ul className="it-activity">
            {data.activity.map((row) => (
              <li key={row.id}>
                <Link to={`/it/assets/${row.assetId}`}>{row.title}</Link>
                <span className="it-sub">
                  {row.place ? `${row.place} · ` : ''}
                  {timeAgo(row.at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
