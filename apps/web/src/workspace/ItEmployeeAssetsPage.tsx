import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StatusChip } from '../ess/components/StatusChip';
import {
  ACK_LABELS,
  ASSET_STATUS_LABELS,
  assetMessage,
  fetchAssetPeople,
  fetchEmployeeAllocations,
  titleCase,
  type AssetPerson,
  type EmployeeAllocation,
  type EmployeeAllocations,
} from './assetsApi';
import { ItAssetIssueTabs } from './ItAssetIssueTabs';
import './it-assets.css';

function Rows({ rows, past }: { rows: EmployeeAllocation[]; past: boolean }) {
  return (
    <div className="ess-table-wrap">
      <table className="ess-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Category</th>
            <th>Issued</th>
            {past ? <th>Returned</th> : null}
            <th>Condition</th>
            <th>Acknowledgement</th>
            <th>Asset status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link to={`/it/assets/${row.asset.id}`}>{row.asset.assetTag}</Link> · {row.asset.name}
              </td>
              <td>{row.asset.category}</td>
              <td>{row.assignedOn}</td>
              {past ? <td>{`${row.returnedOn} · ${titleCase(row.endReason ?? 'returned')}`}</td> : null}
              <td>
                {row.issueCondition ? titleCase(row.issueCondition) : '—'}
                {row.returnCondition ? ` → ${titleCase(row.returnCondition)}` : ''}
              </td>
              <td>{ACK_LABELS[row.ackStatus]}</td>
              <td>
                <StatusChip status={row.asset.status} label={ASSET_STATUS_LABELS[row.asset.status]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ItEmployeeAssetsPage() {
  const [params, setParams] = useSearchParams();
  const employeeId = params.get('employee') ?? '';
  const [people, setPeople] = useState<AssetPerson[]>([]);
  const [data, setData] = useState<EmployeeAllocations | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssetPeople()
      .then(setPeople)
      .catch((err: unknown) => setError(assetMessage(err)));
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    let live = true;
    fetchEmployeeAllocations(employeeId)
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
  }, [employeeId]);

  const shown = data?.employee.id === employeeId ? data : null;

  return (
    <div className="it-assets">
      <ItAssetIssueTabs />
      <div className="it-assets-filters">
        <select
          aria-label="Employee"
          value={employeeId}
          onChange={(event) => setParams(event.target.value ? { employee: event.target.value } : {})}
        >
          <option value="">Choose an employee</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} · {person.employeeCode}
              {person.active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="ess-alert">{error}</p> : null}
      {shown ? (
        <>
          <section className="ess-panel">
            <h2>Currently allocated ({shown.current.length})</h2>
            {shown.current.length ? <Rows rows={shown.current} past={false} /> : <p className="ess-empty">Nothing allocated.</p>}
          </section>
          <section className="ess-panel">
            <h2>Previously allocated ({shown.past.length})</h2>
            {shown.past.length ? <Rows rows={shown.past} past /> : <p className="ess-empty">No past allocations.</p>}
          </section>
        </>
      ) : null}
    </div>
  );
}
