import { useMemo, useState, type FormEvent } from 'react';
import { StatusChip } from '../components/StatusChip';
import { useEssData } from '../mock/EssDataContext';
import { workingDaysBetween } from '../mock/essMock';

type Tab = 'apply' | 'requests' | 'balances' | 'calendar';

export function EssLeavePage() {
  const {
    leaveBalances,
    leaveRequests,
    holidays,
    applyLeave,
    withdrawLeave,
  } = useEssData();

  const [tab, setTab] = useState<Tab>('apply');
  const [typeCode, setTypeCode] = useState(leaveBalances[0]?.code ?? 'CL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfDayStart, setHalfDayStart] = useState(false);
  const [halfDayEnd, setHalfDayEnd] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const previewDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return workingDaysBetween(
      startDate,
      endDate,
      holidays,
      halfDayStart,
      halfDayEnd,
    );
  }, [startDate, endDate, holidays, halfDayStart, halfDayEnd]);

  const selectedBalance = leaveBalances.find((b) => b.code === typeCode);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = applyLeave({
      typeCode,
      startDate,
      endDate: endDate || startDate,
      halfDayStart,
      halfDayEnd,
      reason,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReason('');
    setHalfDayStart(false);
    setHalfDayEnd(false);
    setTab('requests');
  }

  const upcomingHolidays = holidays.filter((h) => h.date >= '2026-09-01');

  return (
    <div>
      <p className="ess-lead">
        Apply for leave, track requests, check balances, and view holidays.
      </p>

      <div className="ess-tabs" role="tablist" aria-label="Leave sections">
        {(
          [
            ['apply', 'Apply'],
            ['requests', 'My requests'],
            ['balances', 'Balances'],
            ['calendar', 'Calendar'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'ess-tab is-active' : 'ess-tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'apply' ? (
        <section className="ess-panel">
          <h2>Apply leave</h2>
          <form className="ess-form" onSubmit={onSubmit}>
            {error ? <div className="ess-alert">{error}</div> : null}

            <div className="ess-field">
              <label htmlFor="leave-type">Leave type *</label>
              <select
                id="leave-type"
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value)}
              >
                {leaveBalances.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.type} ({b.available} available)
                  </option>
                ))}
              </select>
            </div>

            <div className="ess-field">
              <label htmlFor="leave-start">Start date *</label>
              <input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
                required
              />
            </div>

            <div className="ess-field">
              <label htmlFor="leave-end">End date *</label>
              <input
                id="leave-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <div className="ess-check-row">
              <label>
                <input
                  type="checkbox"
                  checked={halfDayStart}
                  onChange={(e) => setHalfDayStart(e.target.checked)}
                />
                Half day (start)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={halfDayEnd}
                  onChange={(e) => setHalfDayEnd(e.target.checked)}
                  disabled={startDate === endDate}
                />
                Half day (end)
              </label>
            </div>

            <p className="ess-muted">
              Working days: <strong>{previewDays || '—'}</strong>
              {selectedBalance ? (
                <>
                  {' '}
                  · Balance after:{' '}
                  <strong>
                    {Math.max(0, selectedBalance.available - previewDays)}
                  </strong>
                </>
              ) : null}
            </p>

            <div className="ess-field">
              <label htmlFor="leave-reason">Reason *</label>
              <textarea
                id="leave-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div className="ess-actions">
              <button type="submit" className="ess-btn ess-btn-primary">
                Submit request
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === 'requests' ? (
        <section className="ess-panel">
          <h2>My requests</h2>
          {leaveRequests.length === 0 ? (
            <p className="ess-empty">No leave requests yet.</p>
          ) : (
            <div className="ess-table-wrap">
              <table className="ess-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Type">
                        <strong>{r.type}</strong>
                        <div className="ess-muted">{r.reason}</div>
                      </td>
                      <td data-label="Dates">
                        {r.startDate}
                        {r.endDate !== r.startDate ? ` → ${r.endDate}` : ''}
                      </td>
                      <td data-label="Days">{r.days}</td>
                      <td data-label="Status">
                        <StatusChip status={r.status} />
                        {r.decisionNote ? (
                          <div className="ess-muted">{r.decisionNote}</div>
                        ) : null}
                      </td>
                      <td data-label="Actions">
                        {r.status === 'Pending' ? (
                          <button
                            type="button"
                            className="ess-btn ess-btn-danger"
                            onClick={() => withdrawLeave(r.id)}
                          >
                            Withdraw
                          </button>
                        ) : (
                          <span className="ess-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'balances' ? (
        <section className="ess-panel">
          <h2>Balances</h2>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Entitled</th>
                  <th>Used</th>
                  <th>Pending</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {leaveBalances.map((b) => (
                  <tr key={b.code}>
                    <td data-label="Type">{b.type}</td>
                    <td data-label="Entitled">{b.entitled}</td>
                    <td data-label="Used">{b.used}</td>
                    <td data-label="Pending">{b.pending}</td>
                    <td data-label="Available">
                      <strong>{b.available}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'calendar' ? (
        <section className="ess-panel">
          <h2>Holiday calendar</h2>
          <div className="ess-table-wrap">
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Holiday</th>
                </tr>
              </thead>
              <tbody>
                {upcomingHolidays.map((h) => (
                  <tr key={h.date}>
                    <td data-label="Date">{h.date}</td>
                    <td data-label="Holiday">{h.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
