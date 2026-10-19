import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  applyLeaveRequest,
  fetchMyLeave,
  withdrawLeaveRequest,
  type LeaveBalanceDto,
  type LeaveRequestDto,
} from '../../workspace/leaveApi';
import { StatusChip } from '../components/StatusChip';
import { workingDaysBetween } from '../mock/essMock';

type Section = 'apply' | 'requests' | 'balances' | 'calendar';

const SECTIONS: Array<[Section, string]> = [
  ['apply', 'Apply'],
  ['requests', 'Requests'],
  ['balances', 'Balances'],
  ['calendar', 'Holiday calendar'],
];

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function meterShare(part: number, entitled: number) {
  if (entitled <= 0) return 0;
  return Math.min(100, Math.max(0, (part / entitled) * 100));
}

export function EssLeavePage() {
  const [balances, setBalances] = useState<LeaveBalanceDto[]>([]);
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [holidays, setHolidays] = useState<Array<{ date: string; name: string }>>([]);
  const [section, setSection] = useState<Section>('apply');
  const [typeCode, setTypeCode] = useState('CL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfDayStart, setHalfDayStart] = useState(false);
  const [halfDayEnd, setHalfDayEnd] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchMyLeave()
      .then((data) => {
        setBalances(data.balances);
        setRequests(data.requests);
        setHolidays(data.holidays);
        if (!typeCode && data.balances[0]) setTypeCode(data.balances[0].code);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load leave.'));
  }

  useEffect(() => {
    load();
  }, []);

  const previewDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return workingDaysBetween(startDate, endDate, holidays, halfDayStart, halfDayEnd);
  }, [startDate, endDate, holidays, halfDayStart, halfDayEnd]);

  const selectedBalance = balances.find((balance) => balance.code === typeCode);
  const casual = balances.find((balance) => balance.code === 'CL');
  const earned = balances.find((balance) => balance.code === 'EL');
  const pending = requests.filter((request) => request.status === 'Pending');
  const uncapped = selectedBalance?.code === 'LOP';
  const balanceAfter =
    !selectedBalance || uncapped ? null : Math.max(0, selectedBalance.available - previewDays);
  const today = new Date().toISOString().slice(0, 10);
  const nextHoliday = [...holidays]
    .filter((holiday) => holiday.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const months = useMemo(() => {
    const groups = new Map<string, { date: string; name: string }[]>();
    for (const holiday of [...holidays].sort((a, b) => a.date.localeCompare(b.date))) {
      const label = new Date(`${holiday.date}T12:00:00`).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
      const list = groups.get(label) ?? [];
      list.push(holiday);
      groups.set(label, list);
    }
    return [...groups.entries()];
  }, [holidays]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await applyLeaveRequest({
        code: typeCode,
        fromDate: startDate,
        toDate: endDate || startDate,
        halfDayStart,
        halfDayEnd,
        reason,
      });
      setStartDate('');
      setEndDate('');
      setReason('');
      setHalfDayStart(false);
      setHalfDayEnd(false);
      setSection('requests');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit leave.');
    }
  }

  async function onWithdraw(id: string) {
    try {
      const data = await withdrawLeaveRequest(id);
      setBalances(data.balances);
      setRequests(data.requests);
      setHolidays(data.holidays);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not withdraw leave.');
    }
  }

  return (
    <div className="ess-section-stack">
      <div className="ess-insights">
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Casual leave</p>
          <p className="ess-insight-value">{casual?.available ?? 0}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Earned leave</p>
          <p className="ess-insight-value">{earned?.available ?? 0}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Pending requests</p>
          <p className="ess-insight-value">{pending.length}</p>
        </article>
      </div>
      <p className="ess-att-facts">
        {nextHoliday ? (
          <span>
            Next holiday <strong>{nextHoliday.name}</strong> · {formatDate(nextHoliday.date)}
          </span>
        ) : (
          <span>No upcoming holidays</span>
        )}
      </p>
      {error ? <p className="ess-alert">{error}</p> : null}

      <div className="ess-segment" role="tablist" aria-label="Leave sections">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            className={section === id ? 'is-active' : undefined}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'apply' ? (
        <section className="ess-panel">
          <h2>Apply leave</h2>
          <form className="ess-form" onSubmit={(event) => void onSubmit(event)}>
            <div className="ess-field">
              <label htmlFor="leave-type">Type</label>
              <select id="leave-type" value={typeCode} onChange={(event) => setTypeCode(event.target.value)}>
                {balances.map((balance) => (
                  <option key={balance.code} value={balance.code}>
                    {balance.type} ({balance.available} left)
                  </option>
                ))}
              </select>
            </div>
            <div className="ess-field-row">
              <div className="ess-field">
                <label htmlFor="leave-start">From</label>
                <input id="leave-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
              </div>
              <div className="ess-field">
                <label htmlFor="leave-end">To</label>
                <input id="leave-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
              </div>
            </div>
            <div className="ess-actions">
              <label>
                <input type="checkbox" checked={halfDayStart} onChange={(event) => setHalfDayStart(event.target.checked)} /> Half day start
              </label>
              <label>
                <input type="checkbox" checked={halfDayEnd} onChange={(event) => setHalfDayEnd(event.target.checked)} /> Half day end
              </label>
            </div>
            <div className="ess-field">
              <label htmlFor="leave-reason">Reason</label>
              <textarea id="leave-reason" value={reason} onChange={(event) => setReason(event.target.value)} required />
            </div>
            <p className="ess-muted">
              {previewDays} working day(s)
              {balanceAfter != null ? ` · ${balanceAfter} remaining after apply` : ''}
            </p>
            <button type="submit" className="ess-btn ess-btn-primary">
              Submit request
            </button>
          </form>
        </section>
      ) : null}

      {section === 'requests' ? (
        <section className="ess-panel">
          <h2>My requests</h2>
          {requests.length === 0 ? <p className="ess-empty">No leave requests yet.</p> : null}
          <ul className="ess-list">
            {requests.map((request) => (
              <li key={request.id} className="ess-list-item">
                <div className="ess-leave-request-head">
                  <strong>{request.type}</strong>
                  <StatusChip status={request.status} />
                </div>
                <span className="ess-muted">
                  {formatDate(request.startDate)}
                  {request.endDate !== request.startDate ? ` – ${formatDate(request.endDate)}` : ''}
                  · {request.days} day(s) · {request.reason}
                </span>
                {request.status === 'Pending' ? (
                  <button type="button" className="ess-btn" onClick={() => void onWithdraw(request.id)}>
                    Withdraw
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {section === 'balances' ? (
        <section className="ess-panel">
          <h2>Balances</h2>
          <ul className="ess-list">
            {balances.map((balance) => (
              <li key={balance.code} className="ess-list-item">
                <strong>
                  {balance.type} · {balance.available} available
                </strong>
                <div className="ess-meter" aria-hidden>
                  <span style={{ width: `${meterShare(balance.used, balance.entitled)}%` }} />
                  <span style={{ width: `${meterShare(balance.pending, balance.entitled)}%` }} />
                </div>
                <span className="ess-muted">
                  Entitled {balance.entitled} · Used {balance.used} · Pending {balance.pending}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {section === 'calendar' ? (
        <section className="ess-panel">
          <h2>Holiday calendar</h2>
          {months.length === 0 ? <p className="ess-empty">No holidays are configured.</p> : null}
          {months.map(([label, list]) => (
            <div key={label}>
              <h3>{label}</h3>
              <ul className="ess-list">
                {list.map((holiday) => (
                  <li key={holiday.date} className="ess-list-item">
                    <strong>{holiday.name}</strong>
                    <span className="ess-muted">{formatDate(holiday.date)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
