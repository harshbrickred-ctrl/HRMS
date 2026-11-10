import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACK_LABELS,
  assetMessage,
  fetchMyAssetHistory,
  titleCase,
  type MyAssetHistoryRow,
} from '../../workspace/assetsApi';

function Rows({ rows, past }: { rows: MyAssetHistoryRow[]; past: boolean }) {
  return (
    <div className="ess-table-wrap">
      <table className="ess-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Allocated</th>
            {past ? <th>Returned</th> : null}
            <th>Issue condition</th>
            {past ? <th>Return condition</th> : null}
            <th>Acknowledgement</th>
            <th>Transfer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.allocationId}>
              <td>
                {row.assetTag} · {row.name}
              </td>
              <td>{row.assignedOn}</td>
              {past ? <td>{row.returnedOn}</td> : null}
              <td>{row.issueCondition ? titleCase(row.issueCondition) : '—'}</td>
              {past ? <td>{row.returnCondition ? titleCase(row.returnCondition) : row.endReason ? titleCase(row.endReason) : '—'}</td> : null}
              <td>{ACK_LABELS[row.ackStatus]}</td>
              <td>
                {row.transferredFrom ? `From ${row.transferredFrom}` : ''}
                {row.transferredFrom && row.transferredTo ? ' · ' : ''}
                {row.transferredTo ? `To ${row.transferredTo}` : ''}
                {!row.transferredFrom && !row.transferredTo ? '—' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EssAssetHistoryPage() {
  const [current, setCurrent] = useState<MyAssetHistoryRow[]>([]);
  const [past, setPast] = useState<MyAssetHistoryRow[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyAssetHistory()
      .then((data) => {
        setCurrent(data.current);
        setPast(data.past);
      })
      .catch((err: unknown) => setError(assetMessage(err)))
      .finally(() => setReady(true));
  }, []);

  return (
    <div className="ess-section-stack ess-assets">
      <Link className="ess-btn ess-btn-ghost it-assets-back" to="/ess/assets">
        ← My assets
      </Link>
      {error ? <p className="ess-alert">{error}</p> : null}
      <section className="ess-panel">
        <h2>Currently assigned ({current.length})</h2>
        {ready && current.length === 0 ? <p className="ess-empty">Nothing is allocated to you right now.</p> : null}
        {current.length ? <Rows rows={current} past={false} /> : null}
      </section>
      <section className="ess-panel">
        <h2>Previously assigned ({past.length})</h2>
        {ready && past.length === 0 ? <p className="ess-empty">No past assets.</p> : null}
        {past.length ? <Rows rows={past} past /> : null}
      </section>
    </div>
  );
}
