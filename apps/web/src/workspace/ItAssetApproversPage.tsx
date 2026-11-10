import { useEffect, useState } from 'react';
import {
  assetMessage,
  fetchAssetPeople,
  fetchDepartmentHeads,
  setDepartmentHead,
  type AssetPerson,
  type DepartmentHead,
} from './assetsApi';
import './it-assets.css';

/** Department heads are the second approval on asset requests. */
export function ItAssetApproversPage() {
  const [rows, setRows] = useState<DepartmentHead[]>([]);
  const [people, setPeople] = useState<AssetPerson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchDepartmentHeads(), fetchAssetPeople()])
      .then(([departments, staff]) => {
        setRows(departments);
        setPeople(staff.filter((person) => person.active));
      })
      .catch((err: unknown) => setError(assetMessage(err)));
  }, []);

  async function onChange(row: DepartmentHead, headId: string) {
    setError(null);
    try {
      setRows(await setDepartmentHead(row.id, headId || null));
      setNotice(`${row.name} updated.`);
    } catch (err: unknown) {
      setError(assetMessage(err));
    }
  }

  return (
    <div className="it-assets">
      <p className="it-assets-note">
        Requests go to the employee's manager, then to their department head. A step with nobody set is skipped.
      </p>
      {error ? <p className="ess-alert">{error}</p> : null}
      {notice ? <p className="it-assets-ok">{notice}</p> : null}
      <section className="ess-panel">
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>People</th>
                <th>Department head</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.employees}</td>
                  <td>
                    <select
                      aria-label={`Head of ${row.name}`}
                      value={row.head?.id ?? ''}
                      onChange={(event) => void onChange(row, event.target.value)}
                    >
                      <option value="">No head set</option>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name} · {person.employeeCode}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
