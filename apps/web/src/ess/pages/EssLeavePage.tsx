import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Leaf,
  PenLine,
  Scale,
  Sparkles,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
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

const SECTIONS: Array<{ id: Section; label: string; hint: string; icon: LucideIcon }> = [
  { id: 'apply', label: 'Apply', hint: 'New request', icon: PenLine },
  { id: 'requests', label: 'Requests', hint: 'Track status', icon: Clock3 },
  { id: 'balances', label: 'Balances', hint: 'Quota left', icon: Scale },
  { id: 'calendar', label: 'Holidays', hint: 'Company days', icon: CalendarDays },
];

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatShort(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function formatDays(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function meterShare(part: number, entitled: number) {
  if (entitled <= 0) return 0;
  return Math.min(100, Math.max(0, (part / entitled) * 100));
}

function rangeLabel(start: string, end: string) {
  if (start === end) return formatDate(start);
  return `${formatShort(start)} – ${formatDate(end)}`;
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
  const [submitting, setSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  function load() {
    fetchMyLeave()
      .then((data) => {
        setBalances(data.balances);
        setRequests(data.requests);
        setHolidays(data.holidays);
        setTypeCode((current) => {
          if (current && data.balances.some((item) => item.code === current)) return current;
          return data.balances[0]?.code ?? 'CL';
        });
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load leave.'))
      .finally(() => setLoaded(true));
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
  const totalAvailable = balances
    .filter((item) => item.code !== 'LOP')
    .reduce((sum, item) => sum + item.available, 0);

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
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  }

  async function onWithdraw(id: string) {
    setWithdrawingId(id);
    try {
      const data = await withdrawLeaveRequest(id);
      setBalances(data.balances);
      setRequests(data.requests);
      setHolidays(data.holidays);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not withdraw leave.');
    } finally {
      setWithdrawingId(null);
    }
  }

  return (
    <div className="ess-section-stack ess-leave">
      <header className="ess-leave-hero">
        <div className="ess-leave-hero-copy">
          <p className="ess-leave-kicker">
            <Leaf size={14} aria-hidden /> Time off
          </p>
          <h1>Leave</h1>
          <p className="ess-lead">
            Check balances, apply for time off, and track approvals in one place.
          </p>
        </div>
        <div className="ess-leave-hero-stats" aria-label="Leave summary">
          <article className="ess-leave-stat">
            <span className="ess-leave-stat-label">Available</span>
            <strong>{formatDays(totalAvailable)}</strong>
            <span className="ess-muted">Across paid types</span>
          </article>
          <article className="ess-leave-stat">
            <span className="ess-leave-stat-label">Casual</span>
            <strong>{formatDays(casual?.available ?? 0)}</strong>
            <span className="ess-muted">of {formatDays(casual?.entitled ?? 0)} entitled</span>
          </article>
          <article className="ess-leave-stat">
            <span className="ess-leave-stat-label">Earned</span>
            <strong>{formatDays(earned?.available ?? 0)}</strong>
            <span className="ess-muted">of {formatDays(earned?.entitled ?? 0)} entitled</span>
          </article>
          <article className="ess-leave-stat">
            <span className="ess-leave-stat-label">Pending</span>
            <strong>{pending.length}</strong>
            <span className="ess-muted">
              {pending.length === 1 ? 'awaiting manager' : 'awaiting manager'}
            </span>
          </article>
        </div>
      </header>

      <div className="ess-leave-banner">
        <CalendarDays size={16} aria-hidden />
        {nextHoliday ? (
          <p>
            Next holiday <strong>{nextHoliday.name}</strong>
            <span> · {formatDate(nextHoliday.date)}</span>
          </p>
        ) : (
          <p>No upcoming holidays on the company calendar.</p>
        )}
        {pending.length > 0 ? (
          <button type="button" className="ess-btn ess-btn-ghost" onClick={() => setSection('requests')}>
            Review pending
          </button>
        ) : null}
      </div>

      {error ? <p className="ess-alert">{error}</p> : null}

      <nav className="ess-leave-tabs" role="tablist" aria-label="Leave sections">
        {SECTIONS.map(({ id, label, hint, icon: Icon }) => {
          const active = section === id;
          const count = id === 'requests' ? pending.length : 0;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`ess-leave-tab${active ? ' is-active' : ''}`}
              onClick={() => setSection(id)}
            >
              <span className="ess-leave-tab-icon" aria-hidden>
                <Icon size={16} strokeWidth={2.1} />
              </span>
              <span className="ess-leave-tab-copy">
                <span className="ess-leave-tab-label">
                  {label}
                  {count > 0 ? <span className="ess-leave-tab-count">{count}</span> : null}
                </span>
                <span className="ess-leave-tab-hint">{hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {!loaded ? <p className="ess-muted">Loading leave…</p> : null}

      {section === 'apply' && loaded ? (
        <section className="ess-leave-apply">
          <form className="ess-panel ess-leave-form" onSubmit={(event) => void onSubmit(event)}>
            <div className="ess-panel-head">
              <h2>Apply for leave</h2>
              <span className="ess-muted">Manager approval required</span>
            </div>

            <fieldset className="ess-leave-types">
              <legend>Leave type</legend>
              <div className="ess-leave-type-grid" role="radiogroup" aria-label="Leave type">
                {balances.map((balance) => {
                  const selected = balance.code === typeCode;
                  return (
                    <button
                      key={balance.code}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`ess-leave-type${selected ? ' is-selected' : ''}`}
                      onClick={() => setTypeCode(balance.code)}
                    >
                      <span className="ess-leave-type-code">{balance.code}</span>
                      <strong>{balance.type}</strong>
                      <span className="ess-muted">
                        {balance.code === 'LOP'
                          ? 'Unpaid'
                          : `${formatDays(balance.available)} available`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="ess-leave-dates">
              <div className="ess-field">
                <label htmlFor="leave-start">From</label>
                <input
                  id="leave-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    setStartDate(value);
                    if (!endDate || endDate < value) setEndDate(value);
                  }}
                  required
                />
              </div>
              <div className="ess-field">
                <label htmlFor="leave-end">To</label>
                <input
                  id="leave-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="ess-leave-halfdays">
              <button
                type="button"
                className={`ess-leave-toggle${halfDayStart ? ' is-on' : ''}`}
                aria-pressed={halfDayStart}
                onClick={() => setHalfDayStart((value) => !value)}
              >
                Half day start
              </button>
              <button
                type="button"
                className={`ess-leave-toggle${halfDayEnd ? ' is-on' : ''}`}
                aria-pressed={halfDayEnd}
                onClick={() => setHalfDayEnd((value) => !value)}
              >
                Half day end
              </button>
            </div>

            <div className="ess-field">
              <label htmlFor="leave-reason">Reason</label>
              <textarea
                id="leave-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Briefly explain why you need this leave"
                rows={3}
                required
              />
            </div>

            <div className="ess-leave-form-actions">
              <button type="submit" className="ess-btn ess-btn-primary" disabled={submitting || !startDate}>
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
              <button
                type="button"
                className="ess-btn"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setReason('');
                  setHalfDayStart(false);
                  setHalfDayEnd(false);
                }}
              >
                Clear
              </button>
            </div>
          </form>

          <aside className="ess-panel ess-leave-summary">
            <div className="ess-panel-head">
              <h2>Request preview</h2>
              <Sparkles size={16} aria-hidden />
            </div>
            <div className="ess-leave-summary-stat">
              <span>Type</span>
              <strong>{selectedBalance?.type ?? '—'}</strong>
            </div>
            <div className="ess-leave-summary-stat">
              <span>Dates</span>
              <strong>{startDate && endDate ? rangeLabel(startDate, endDate) : 'Pick dates'}</strong>
            </div>
            <div className="ess-leave-summary-stat">
              <span>Working days</span>
              <strong>{formatDays(previewDays)}</strong>
            </div>
            <div className="ess-leave-summary-stat">
              <span>Balance after</span>
              <strong>
                {balanceAfter == null
                  ? uncapped
                    ? 'N/A (LOP)'
                    : '—'
                  : `${formatDays(balanceAfter)} left`}
              </strong>
            </div>
            {(halfDayStart || halfDayEnd) && (
              <p className="ess-leave-summary-note ess-muted">
                {halfDayStart && halfDayEnd
                  ? 'Half day on start and end dates.'
                  : halfDayStart
                    ? 'Half day on the first day.'
                    : 'Half day on the last day.'}
              </p>
            )}
            <p className="ess-leave-summary-note ess-muted">
              Weekends and holidays are excluded from the day count.
            </p>
          </aside>
        </section>
      ) : null}

      {section === 'requests' && loaded ? (
        <section className="ess-panel ess-leave-requests">
          <div className="ess-panel-head">
            <h2>My requests</h2>
            <span className="ess-muted">{requests.length} total</span>
          </div>
          {requests.length === 0 ? (
            <div className="ess-leave-empty">
              <Clock3 size={20} aria-hidden />
              <p>No leave requests yet. Apply when you need time off.</p>
              <button type="button" className="ess-btn ess-btn-primary" onClick={() => setSection('apply')}>
                Apply leave
              </button>
            </div>
          ) : (
            <ul className="ess-leave-request-list">
              {requests.map((request) => (
                <li key={request.id} className={`ess-leave-request is-${request.status.toLowerCase()}`}>
                  <div className="ess-leave-request-head">
                    <div>
                      <strong>{request.type}</strong>
                      <span className="ess-leave-request-code">{request.code || request.typeCode}</span>
                    </div>
                    <StatusChip status={request.status} />
                  </div>
                  <p className="ess-leave-request-range">{rangeLabel(request.startDate, request.endDate)}</p>
                  <p className="ess-muted">
                    {formatDays(request.days)} day(s)
                    {request.halfDayStart || request.halfDayEnd ? ' · half day' : ''}
                    {' · '}
                    {request.reason}
                  </p>
                  {request.decisionNote ? (
                    <p className="ess-leave-decision">
                      <CheckCircle2 size={14} aria-hidden />
                      {request.decisionNote}
                    </p>
                  ) : null}
                  {request.status === 'Pending' ? (
                    <div className="ess-leave-request-actions">
                      <button
                        type="button"
                        className="ess-btn"
                        disabled={withdrawingId === request.id}
                        onClick={() => void onWithdraw(request.id)}
                      >
                        <Undo2 size={14} aria-hidden />
                        {withdrawingId === request.id ? 'Withdrawing…' : 'Withdraw'}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {section === 'balances' && loaded ? (
        <section className="ess-leave-balances">
          {balances.map((balance) => (
            <article key={balance.code} className="ess-panel ess-leave-balance-card">
              <header>
                <span className="ess-leave-type-code">{balance.code}</span>
                <h2>{balance.type}</h2>
              </header>
              <p className="ess-leave-available">
                {formatDays(balance.available)}
                <span>available</span>
              </p>
              <div className="ess-leave-meter" aria-hidden>
                <span
                  className="ess-leave-meter-used"
                  style={{ width: `${meterShare(balance.used, balance.entitled)}%` }}
                />
                <span
                  className="ess-leave-meter-pending"
                  style={{ width: `${meterShare(balance.pending, balance.entitled)}%` }}
                />
              </div>
              <dl className="ess-leave-balance-meta">
                <div>
                  <dt>Entitled</dt>
                  <dd>{formatDays(balance.entitled)}</dd>
                </div>
                <div>
                  <dt>Used</dt>
                  <dd>{formatDays(balance.used)}</dd>
                </div>
                <div>
                  <dt>Pending</dt>
                  <dd>{formatDays(balance.pending)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      ) : null}

      {section === 'calendar' && loaded ? (
        <section className="ess-panel ess-leave-calendar">
          <div className="ess-panel-head">
            <h2>Holiday calendar</h2>
            <span className="ess-muted">{holidays.length} days</span>
          </div>
          {months.length === 0 ? (
            <p className="ess-empty">No holidays are configured yet.</p>
          ) : (
            <div className="ess-leave-months">
              {months.map(([label, list]) => (
                <div key={label} className="ess-leave-month-block">
                  <h3 className="ess-leave-month">{label}</h3>
                  <ul className="ess-leave-holiday-list">
                    {list.map((holiday) => (
                      <li key={holiday.date} className="ess-leave-holiday">
                        <span className="ess-leave-holiday-day">{formatShort(holiday.date)}</span>
                        <strong>{holiday.name}</strong>
                        <span className="ess-muted">
                          {new Date(`${holiday.date}T12:00:00`).toLocaleDateString('en-IN', {
                            weekday: 'long',
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
