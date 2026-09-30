import { useMemo, useState, type FormEvent } from 'react';
import { StatusChip } from '../components/StatusChip';
import { useWorkspace } from '../../workspace/workspaceMock';
import { useEssData } from '../mock/EssDataContext';
import { workingDaysBetween, type LeaveBalance, type LeaveRequest } from '../mock/essMock';

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
  const { leaveBalances, leaveRequests, holidays, applyLeave, withdrawLeave } = useEssData();
  const { inbox } = useWorkspace();
  const requests = leaveRequests.map((request) => overlayDecision(request, inbox));
  const [section, setSection] = useState<Section>('apply');
  const [typeCode, setTypeCode] = useState(leaveBalances[0]?.code ?? 'CL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfDayStart, setHalfDayStart] = useState(false);
  const [halfDayEnd, setHalfDayEnd] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const previewDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return workingDaysBetween(startDate, endDate, holidays, halfDayStart, halfDayEnd);
  }, [startDate, endDate, holidays, halfDayStart, halfDayEnd]);

  const selectedBalance = leaveBalances.find((balance) => balance.code === typeCode);
  const casual = leaveBalances.find((balance) => balance.code === 'CL');
  const earned = leaveBalances.find((balance) => balance.code === 'EL');
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

  function onSubmit(event: FormEvent) {
    event.preventDefault();
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
    setStartDate('');
    setEndDate('');
    setReason('');
    setHalfDayStart(false);
    setHalfDayEnd(false);
    setSection('requests');
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

      <section className="ess-panel">
        <div className="ess-att-toolbar">
          <h2>{SECTIONS.find(([id]) => id === section)?.[1]}</h2>
          <div className="ess-tabs" role="tablist" aria-label="Leave sections">
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={section === id}
                className={section === id ? 'ess-tab is-active' : 'ess-tab'}
                onClick={() => setSection(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {section === 'apply' ? (
          <form className="ess-form" onSubmit={onSubmit}>
            {error ? <div className="ess-alert">{error}</div> : null}
            <div className="ess-field">
              <label htmlFor="leave-type">Leave type</label>
              <select id="leave-type" value={typeCode} onChange={(e) => setTypeCode(e.target.value)}>
                {leaveBalances.map((balance) => (
                  <option key={balance.code} value={balance.code}>
                    {balance.code === 'LOP'
                      ? `${balance.type} (No cap)`
                      : `${balance.type} (${balance.available} available)`}
                  </option>
                ))}
              </select>
            </div>
            <div className="ess-leave-dates">
              <div className="ess-field">
                <label htmlFor="leave-start">Start date</label>
                <input
                  id="leave-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  required
                />
              </div>
              <div className="ess-field">
                <label htmlFor="leave-end">End date</label>
                <input
                  id="leave-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
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
                  disabled={!startDate || startDate === endDate}
                />
                Half day (end)
              </label>
            </div>
            <div className="ess-field">
              <label htmlFor="leave-reason">Reason</label>
              <textarea
                id="leave-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
            <p className="ess-muted">
              {previewDays || '—'} working day{previewDays === 1 ? '' : 's'}
              {uncapped ? ' · no cap' : balanceAfter == null ? '' : ` · ${balanceAfter} left after`}
            </p>
            <button type="submit" className="ess-btn ess-btn-primary">
              Submit request
            </button>
          </form>
        ) : null}

        {section === 'requests' ? (
          requests.length === 0 ? (
            <p className="ess-empty">No leave requests yet.</p>
          ) : (
            <ul className="ess-list">
              {requests.map((request) => (
                <li key={request.id} className="ess-list-item ess-leave-request">
                  <div className="ess-leave-request-head">
                    <strong>{request.type}</strong>
                    <StatusChip status={request.status} />
                  </div>
                  <span className="ess-list-meta">
                    {formatDate(request.startDate)}
                    {request.endDate !== request.startDate ? ` → ${formatDate(request.endDate)}` : ''}
                    <span>
                      {request.days} day{request.days === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="ess-muted">{request.reason}</span>
                  {request.status === 'Pending' && request.approverName ? (
                    <span className="ess-muted">With {request.approverName}</span>
                  ) : null}
                  {request.status === 'Pending' ? (
                    <div className="ess-actions">
                      <button
                        type="button"
                        className="ess-btn ess-btn-danger"
                        onClick={() => withdrawLeave(request.id)}
                      >
                        Withdraw
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}

        {section === 'balances' ? (
          <div className="ess-leave-balances">
            {leaveBalances.map((balance) => (
              <BalanceCard key={balance.code} balance={balance} />
            ))}
          </div>
        ) : null}

        {section === 'calendar' ? (
          <div className="ess-leave-months">
            {months.map(([month, items]) => (
              <section key={month}>
                <h3 className="ess-leave-month">{month}</h3>
                <ul className="ess-list">
                  {items.map((holiday) => (
                    <li key={holiday.date} className="ess-list-item ess-leave-holiday">
                      <strong>{holiday.name}</strong>
                      <span className="ess-muted">{formatDate(holiday.date)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function overlayDecision(
  request: LeaveRequest,
  inbox: Array<{ id: string; status: LeaveRequest['status']; approverName: string }>,
) {
  const stored = inbox.find((item) => item.id === request.id);
  if (!stored) return request;
  return { ...request, status: stored.status, approverName: stored.approverName };
}

function BalanceCard({ balance }: { balance: LeaveBalance }) {
  const uncapped = balance.code === 'LOP';
  const used = meterShare(balance.used, balance.entitled);
  const pending = meterShare(balance.pending, balance.entitled);

  return (
    <article className="ess-panel ess-leave-balance">
      <p className="ess-muted">{balance.type}</p>
      <p className="ess-leave-available">
        {uncapped ? 'No cap' : balance.available}
        {uncapped ? null : <span>available</span>}
      </p>
      {uncapped ? (
        <p className="ess-muted">Unpaid leave. It does not reduce another balance.</p>
      ) : (
        <>
          <div
            className="ess-leave-meter"
            role="img"
            aria-label={`${balance.used} used, ${balance.pending} pending, ${balance.available} available of ${balance.entitled}`}
          >
            <span className="ess-leave-meter-used" style={{ width: `${used}%` }} />
            <span className="ess-leave-meter-pending" style={{ width: `${pending}%` }} />
          </div>
          <dl className="ess-leave-balance-meta">
            <div>
              <dt>Entitled</dt>
              <dd>{balance.entitled}</dd>
            </div>
            <div>
              <dt>Used</dt>
              <dd>{balance.used}</dd>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>{balance.pending}</dd>
            </div>
          </dl>
        </>
      )}
    </article>
  );
}
