import { useMemo, useState, type FormEvent } from 'react';
import { StatusChip } from '../components/StatusChip';
import { useEssData } from '../mock/EssDataContext';
import type { AttendanceStatus } from '../mock/essMock';

type Tab = 'mark' | 'month' | 'corrections';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayClass(status?: AttendanceStatus) {
  if (!status) return 'ess-day';
  return `ess-day ess-day-${status.toLowerCase()}`;
}

export function EssAttendancePage() {
  const {
    attendance,
    corrections,
    markAttendance,
    requestCorrection,
  } = useEssData();

  const [tab, setTab] = useState<Tab>('month');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [corrDate, setCorrDate] = useState('');
  const [corrStatus, setCorrStatus] = useState<'Present' | 'Absent'>('Present');
  const [corrReason, setCorrReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const year = 2026;
  const month = 9;
  const today = '2026-09-22';

  const monthDays = useMemo(() => {
    const map = new Map(attendance.map((d) => [d.date, d]));
    const firstDow = new Date(year, month - 1, 1).getDay();
    const last = new Date(year, month, 0).getDate();
    const cells: Array<{ date?: string; day?: number }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({});
    for (let d = 1; d <= last; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, day: d });
    }
    return { cells, map };
  }, [attendance]);

  const selected = selectedDate
    ? attendance.find((d) => d.date === selectedDate)
    : undefined;

  const todayRecord = attendance.find((d) => d.date === today);

  function onCorrection(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = requestCorrection({
      date: corrDate,
      requestedStatus: corrStatus,
      reason: corrReason,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCorrReason('');
    setTab('corrections');
  }

  return (
    <div>
      <p className="ess-lead">
        Mark today, review September 2026, and request corrections.
      </p>

      <div className="ess-tabs" role="tablist" aria-label="Attendance sections">
        {(
          [
            ['mark', 'Mark'],
            ['month', 'Month view'],
            ['corrections', 'Corrections'],
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

      {tab === 'mark' ? (
        <section className="ess-panel">
          <h2>Mark attendance</h2>
          <p className="ess-muted">Today · {today}</p>
          {todayRecord ? (
            <p>
              Current status:{' '}
              <StatusChip status={todayRecord.status} />
              {todayRecord.checkIn ? (
                <span className="ess-muted"> · In {todayRecord.checkIn}</span>
              ) : null}
              {todayRecord.checkOut ? (
                <span className="ess-muted"> · Out {todayRecord.checkOut}</span>
              ) : null}
            </p>
          ) : (
            <p className="ess-empty">Not marked yet for today.</p>
          )}
          <div className="ess-actions" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="ess-btn ess-btn-primary"
              onClick={() => markAttendance(today)}
              disabled={todayRecord?.status === 'Present'}
            >
              Mark present
            </button>
            <button
              type="button"
              className="ess-btn"
              onClick={() => {
                setCorrDate(today);
                setTab('corrections');
              }}
            >
              Request correction
            </button>
          </div>
        </section>
      ) : null}

      {tab === 'month' ? (
        <div className="ess-grid-2">
          <section className="ess-panel">
            <h2>September 2026</h2>
            <div className="ess-calendar" role="grid" aria-label="Attendance calendar">
              {DOW.map((d) => (
                <div key={d} className="ess-calendar-dow">
                  {d}
                </div>
              ))}
              {monthDays.cells.map((cell, idx) => {
                if (!cell.date) {
                  return <div key={`e-${idx}`} />;
                }
                const rec = monthDays.map.get(cell.date);
                return (
                  <button
                    key={cell.date}
                    type="button"
                    className={`${dayClass(rec?.status)}${
                      selectedDate === cell.date ? ' is-selected' : ''
                    }`}
                    onClick={() => setSelectedDate(cell.date!)}
                    aria-label={`${cell.date}${rec ? `, ${rec.status}` : ''}`}
                  >
                    <span className="ess-day-num">{cell.day}</span>
                    {rec ? <span className="ess-day-dot" /> : null}
                  </button>
                );
              })}
            </div>
            <div className="ess-legend">
              <span>
                <i style={{ background: '#5a8a1f' }} /> Present
              </span>
              <span>
                <i style={{ background: 'var(--danger)' }} /> Absent
              </span>
              <span>
                <i style={{ background: '#3a5fbf' }} /> Holiday
              </span>
              <span>
                <i style={{ background: '#7a3fb0' }} /> Leave
              </span>
              <span>
                <i style={{ background: '#c77700' }} /> Pending correction
              </span>
            </div>
          </section>

          <section className="ess-panel">
            <h2>Day detail</h2>
            {!selectedDate ? (
              <p className="ess-empty">Select a day to see punches and status.</p>
            ) : (
              <>
                <p>
                  <strong>{selectedDate}</strong>
                </p>
                {selected ? (
                  <dl className="ess-dl">
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <StatusChip status={selected.status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Check in</dt>
                      <dd>{selected.checkIn ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Check out</dt>
                      <dd>{selected.checkOut ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Note</dt>
                      <dd>{selected.note ?? '—'}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="ess-empty">No attendance recorded.</p>
                )}
                <div className="ess-actions" style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="ess-btn"
                    onClick={() => {
                      setCorrDate(selectedDate);
                      setTab('corrections');
                    }}
                  >
                    Request correction
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'corrections' ? (
        <div className="ess-section-stack">
          <section className="ess-panel">
            <h2>Request correction</h2>
            <form className="ess-form" onSubmit={onCorrection}>
              {error ? <div className="ess-alert">{error}</div> : null}
              <div className="ess-field">
                <label htmlFor="corr-date">Date *</label>
                <input
                  id="corr-date"
                  type="date"
                  value={corrDate}
                  onChange={(e) => setCorrDate(e.target.value)}
                  required
                />
              </div>
              <div className="ess-field">
                <label htmlFor="corr-status">Requested status *</label>
                <select
                  id="corr-status"
                  value={corrStatus}
                  onChange={(e) =>
                    setCorrStatus(e.target.value as 'Present' | 'Absent')
                  }
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>
              <div className="ess-field">
                <label htmlFor="corr-reason">Reason *</label>
                <textarea
                  id="corr-reason"
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="ess-btn ess-btn-primary">
                Submit correction
              </button>
            </form>
          </section>

          <section className="ess-panel">
            <h2>My corrections</h2>
            {corrections.length === 0 ? (
              <p className="ess-empty">No correction requests.</p>
            ) : (
              <div className="ess-table-wrap">
                <table className="ess-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Requested</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corrections.map((c) => (
                      <tr key={c.id}>
                        <td data-label="Date">{c.date}</td>
                        <td data-label="Requested">{c.requestedStatus}</td>
                        <td data-label="Reason">{c.reason}</td>
                        <td data-label="Status">
                          <StatusChip status={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
