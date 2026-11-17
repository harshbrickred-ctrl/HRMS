import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { EmployeePhoto } from '../ess/components/EmployeePhoto';
import { ensureChristmas } from '../ess/mock/essMock';
import { holidays } from './workspaceMock';
import { LEAVE_TYPE_CATALOG, applyLeaveForEmployee } from './leaveApi';
import {
  fetchHrEmployee,
  fetchHrEmployees,
  updateHrLeaveBalances,
  type HrEmployee,
  type HrLeaveBalance,
} from './hrApi';
import { LeaveApprovalsPanel } from './LeaveApprovalsPanel';
import { showToast } from '../ui/toast';
import './hr-leave.css';

const TYPE_ORDER = ['CL', 'SL', 'EL', 'CO', 'WFH', 'OBH', 'LOP'];

const TYPE_NOTES: Record<string, string> = {
  CL: 'Short-notice personal leave.',
  SL: 'Leave taken for illness.',
  EL: 'Planned leave earned through the year.',
  CO: 'Time off earned from extra work.',
  WFH: 'Remote days counted on this balance.',
  OBH: 'Optional - Birthday Holiday.',
  LOP: 'Unpaid. It does not reduce another balance.',
};

type BalanceDraft = Pick<HrLeaveBalance, 'code' | 'type' | 'entitled' | 'used' | 'pending'>;

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function roundHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function formatDays(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function availableOf(item: BalanceDraft) {
  return roundHalf(item.entitled - item.used - item.pending);
}

function sortBalances<T extends { code: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a.code);
    const bi = TYPE_ORDER.indexOf(b.code);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function snapshot(items: BalanceDraft[]) {
  return JSON.stringify(
    sortBalances(items).map((item) => ({
      code: item.code,
      entitled: item.entitled,
      used: item.used,
      pending: item.pending,
    })),
  );
}

function toDraft(items: HrLeaveBalance[]): BalanceDraft[] {
  return sortBalances(items).map((item) => ({
    code: item.code,
    type: item.type,
    entitled: item.entitled,
    used: item.used,
    pending: item.pending,
  }));
}

function meterShare(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export function HrLeaveAdminPage() {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [detail, setDetail] = useState<HrEmployee | null>(null);
  const [draft, setDraft] = useState<BalanceDraft[]>([]);
  const [saved, setSaved] = useState<BalanceDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyCode, setApplyCode] = useState('CL');
  const [applyFrom, setApplyFrom] = useState('');
  const [applyTo, setApplyTo] = useState('');
  const [applyReason, setApplyReason] = useState('');
  const [applyFromHalfStart, setApplyFromHalfStart] = useState(false);
  const [applyFromHalfEnd, setApplyFromHalfEnd] = useState(false);
  const [applyToHalfStart, setApplyToHalfStart] = useState(false);
  const [applyToHalfEnd, setApplyToHalfEnd] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const applySameDay = Boolean(applyFrom) && (!applyTo || applyFrom === applyTo);

  useEffect(() => {
    if (applySameDay && (applyToHalfStart || applyToHalfEnd)) {
      setApplyToHalfStart(false);
      setApplyToHalfEnd(false);
    }
  }, [applySameDay, applyToHalfStart, applyToHalfEnd]);

  useEffect(() => {
    void fetchHrEmployees()
      .then((rows) => {
        const sorted = [...rows].sort((a, b) => fullName(a).localeCompare(fullName(b)));
        setEmployees(sorted);
        setEmployeeId((current) => current || sorted[0]?.id || '');
        setReady(true);
      })
      .catch((err) => {
        setError(messageOf(err));
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    setDetail(null);
    setDraft([]);
    setSaved([]);
    void fetchHrEmployee(employeeId)
      .then((person) => {
        if (cancelled) return;
        const balances = toDraft(person.leaveBalances ?? []);
        setDetail(person);
        setDraft(balances);
        setSaved(balances);
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const dirty = snapshot(draft) !== snapshot(saved);
  const selectedName = detail ? fullName(detail) : 'this person';

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((person) => {
      const haystack = [
        fullName(person),
        person.employeeCode,
        person.designation,
        person.departmentName,
        person.locationName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [employees, query]);

  const totals = useMemo(() => {
    const capped = draft.filter((item) => item.code !== 'LOP');
    return {
      available: capped.reduce((sum, item) => sum + availableOf(item), 0),
      used: draft.reduce((sum, item) => sum + item.used, 0),
      pending: draft.reduce((sum, item) => sum + item.pending, 0),
    };
  }, [draft]);

  const holidayGroups = useMemo(() => groupHolidays(ensureChristmas(holidays)), []);
  const upcomingCount = holidayGroups.upcoming;

  function selectEmployee(id: string) {
    if (id === employeeId) return;
    if (dirty) {
      const leave = window.confirm(
        `Leave balances for ${selectedName} are not saved. Switch people anyway?`,
      );
      if (!leave) return;
    }
    setError(null);
    setMessage(null);
    setEmployeeId(id);
  }

  function setBalance(code: string, field: 'entitled' | 'used' | 'pending', value: number) {
    if (!Number.isFinite(value)) return;
    const next = roundHalf(Math.max(0, value));
    setMessage(null);
    setDraft((current) =>
      current.map((item) => (item.code === code ? { ...item, [field]: next } : item)),
    );
  }

  function discard() {
    setDraft(saved);
    setMessage(null);
    setError(null);
  }

  async function onApplyForEmployee(event: FormEvent) {
    event.preventDefault();
    if (!detail || !applyFrom) return;
    setApplyBusy(true);
    setError(null);
    setMessage(null);
    try {
      await applyLeaveForEmployee({
        employeeId: detail.id,
        code: applyCode,
        fromDate: applyFrom,
        toDate: applyTo || applyFrom,
        halfDayStart: applyFromHalfStart !== applyFromHalfEnd,
        halfDayEnd: !applySameDay && applyToHalfStart !== applyToHalfEnd,
        fromHalfStart: applyFromHalfStart,
        fromHalfEnd: applyFromHalfEnd,
        toHalfStart: applySameDay ? false : applyToHalfStart,
        toHalfEnd: applySameDay ? false : applyToHalfEnd,
        reason: applyReason,
      });
      setApplyFrom('');
      setApplyTo('');
      setApplyReason('');
      setApplyFromHalfStart(false);
      setApplyFromHalfEnd(false);
      setApplyToHalfStart(false);
      setApplyToHalfEnd(false);
      setMessage(`Leave applied for ${fullName(detail)}, including back dates. It is pending approval.`);
      showToast(`Leave applied for ${fullName(detail)}.`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setApplyBusy(false);
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!detail || !dirty) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateHrLeaveBalances(
        detail.id,
        draft.map((item) => ({
          code: item.code,
          entitled: item.entitled,
          used: item.used,
          pending: item.pending,
        })),
      );
      const balances = toDraft(updated.leaveBalances ?? []);
      setDetail(updated);
      setDraft(balances);
      setSaved(balances);
      setMessage('Leave balances saved.');
      showToast('Leave balances saved.');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <p className="hr-leave-empty">Loading leave…</p>;
  }

  return (
    <div className="hr-leave">
      <p className="hr-leave-lead">
        Adjust entitled, used, and pending days for one person at a time. The holiday list is the
        company calendar employees already see.
      </p>
      {error && !detail ? (
        <p className="hr-leave-alert" role="alert">
          {error}
        </p>
      ) : null}
      <LeaveApprovalsPanel />
      {detail ? (
        <form className="ess-panel" onSubmit={(event) => void onApplyForEmployee(event)}>
          <h2>Apply leave for {fullName(detail)}</h2>
          <p className="ess-muted">
            HR and admin can apply leave for this person on a past date. Employees still cannot apply back-dated leave themselves.
          </p>
          <div className="ess-leave-dates">
            <label className="ess-field">
              <span>Type</span>
              <select value={applyCode} onChange={(event) => setApplyCode(event.target.value)}>
                {LEAVE_TYPE_CATALOG.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.type}
                  </option>
                ))}
              </select>
            </label>
            <label className="ess-field">
              <span>From</span>
              <input type="date" value={applyFrom} onChange={(event) => setApplyFrom(event.target.value)} required />
            </label>
            <label className="ess-field">
              <span>To</span>
              <input type="date" value={applyTo} min={applyFrom || undefined} onChange={(event) => setApplyTo(event.target.value)} required />
            </label>
          </div>
          <div className="ess-leave-dates">
            <div>
              <span className="ess-leave-half-label">From half day</span>
              <div className="ess-leave-halfdays">
                <button
                  type="button"
                  className={`ess-leave-toggle${applyFromHalfStart ? ' is-on' : ''}`}
                  onClick={() => {
                    setApplyFromHalfStart((value) => !value);
                    setApplyFromHalfEnd(false);
                  }}
                >
                  Half Day Start
                </button>
                <button
                  type="button"
                  className={`ess-leave-toggle${applyFromHalfEnd ? ' is-on' : ''}`}
                  onClick={() => {
                    setApplyFromHalfEnd((value) => !value);
                    setApplyFromHalfStart(false);
                  }}
                >
                  Half Day End
                </button>
              </div>
            </div>
            <div>
              <span className="ess-leave-half-label">To half day</span>
              <div className="ess-leave-halfdays">
                <button
                  type="button"
                  className={`ess-leave-toggle${applyToHalfStart ? ' is-on' : ''}`}
                  disabled={applySameDay}
                  onClick={() => {
                    setApplyToHalfStart((value) => !value);
                    setApplyToHalfEnd(false);
                  }}
                >
                  Half Day Start
                </button>
                <button
                  type="button"
                  className={`ess-leave-toggle${applyToHalfEnd ? ' is-on' : ''}`}
                  disabled={applySameDay}
                  onClick={() => {
                    setApplyToHalfEnd((value) => !value);
                    setApplyToHalfStart(false);
                  }}
                >
                  Half Day End
                </button>
              </div>
            </div>
          </div>
          <label className="ess-field">
            <span>Reason (optional)</span>
            <textarea value={applyReason} onChange={(event) => setApplyReason(event.target.value)} rows={2} />
          </label>
          <button type="submit" className="ess-btn ess-btn-primary" disabled={applyBusy || !applyFrom}>
            {applyBusy ? 'Applying…' : 'Apply leave'}
          </button>
        </form>
      ) : null}
      <div className="hr-leave-workspace">
        <aside className="hr-leave-rail" aria-label="Employees">
          <div className="hr-leave-rail-head">
            <h2>People</h2>
            <span>{employees.length}</span>
          </div>
          <label className="hr-leave-search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              aria-label="Search people"
              value={query}
              placeholder="Search name, code, or team"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <ul className="hr-leave-people">
            {filtered.map((person) => {
              const name = fullName(person);
              const selected = person.id === employeeId;
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    className={selected ? 'is-selected' : undefined}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => selectEmployee(person.id)}
                  >
                    <EmployeePhoto src={person.photo} name={name} size="sm" />
                    <span>
                      <strong>{name}</strong>
                      <span>
                        {person.employeeCode}
                        {person.departmentName ? ` · ${person.departmentName}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 ? (
            <p className="hr-leave-empty">No people match that search.</p>
          ) : null}
        </aside>

        <form className="hr-leave-detail" onSubmit={(event) => void onSave(event)}>
          {!detail || detail.id !== employeeId ? (
            <p className="hr-leave-empty">Loading balances…</p>
          ) : (
            <>
              <header className={dirty ? 'hr-leave-person is-dirty' : 'hr-leave-person'}>
                <div className="hr-leave-person-main">
                  <EmployeePhoto src={detail.photo} name={fullName(detail)} size="md" />
                  <div>
                    <h2>{fullName(detail)}</h2>
                    <p>
                      {detail.employeeCode}
                      {detail.designation ? ` · ${detail.designation}` : ''}
                    </p>
                    <p>
                      {[detail.departmentName, detail.locationName, detail.teamName]
                        .filter(Boolean)
                        .join(' · ') || 'No department assigned'}
                    </p>
                    <p role={error ? 'alert' : 'status'} className={error ? 'is-error' : undefined}>
                      {error ??
                        (dirty ? 'Unsaved changes' : (message ?? 'Balances match what is saved.'))}
                    </p>
                  </div>
                </div>
                <div className="hr-leave-person-side">
                  <dl className="hr-leave-person-stats">
                    <div>
                      <dt>Available</dt>
                      <dd>{formatDays(totals.available)}</dd>
                    </div>
                    <div>
                      <dt>Used</dt>
                      <dd>{formatDays(totals.used)}</dd>
                    </div>
                    <div>
                      <dt>Pending</dt>
                      <dd>{formatDays(totals.pending)}</dd>
                    </div>
                  </dl>
                  <div className="hr-leave-actions">
                    <button
                      type="button"
                      className="ess-btn ess-btn-ghost"
                      disabled={!dirty || busy}
                      onClick={discard}
                    >
                      Discard
                    </button>
                    <button type="submit" className="ess-btn ess-btn-primary" disabled={!dirty || busy}>
                      {busy ? 'Saving…' : 'Save balances'}
                    </button>
                  </div>
                </div>
              </header>

              {draft.length === 0 ? (
                <p className="hr-leave-empty">No leave types are assigned to this person.</p>
              ) : (
                <div className="hr-leave-cards">
                  {draft.map((item) => (
                    <BalanceCard
                      key={item.code}
                      item={item}
                      onChange={(field, value) => setBalance(item.code, field, value)}
                    />
                  ))}
                </div>
              )}

            </>
          )}
        </form>
      </div>

      <section className="hr-leave-calendar" aria-labelledby="leave-holidays-heading">
        <div className="hr-leave-calendar-head">
          <div>
            <h2 id="leave-holidays-heading">Holidays</h2>
            <p>{upcomingCount === 0 ? 'None left on this calendar.' : `${upcomingCount} still ahead.`}</p>
          </div>
        </div>
        <div className="hr-leave-months">
          {holidayGroups.months.map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              <ul>
                {group.items.map((holiday) => (
                  <li
                    key={holiday.date}
                    className={
                      holiday.date === holidayGroups.nextDate
                        ? 'is-next'
                        : holiday.past
                          ? 'is-past'
                          : undefined
                    }
                  >
                    <time dateTime={holiday.date}>{holiday.dayLabel}</time>
                    <strong>{holiday.name}</strong>
                    {holiday.date === holidayGroups.nextDate ? <span>Next</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function BalanceCard({
  item,
  onChange,
}: {
  item: BalanceDraft;
  onChange: (field: 'entitled' | 'used' | 'pending', value: number) => void;
}) {
  const uncapped = item.code === 'LOP';
  const available = availableOf(item);
  const over = !uncapped && available < 0;
  const used = meterShare(item.used, item.entitled);
  const pending = meterShare(item.pending, item.entitled);

  return (
    <article className={over ? 'hr-leave-card is-over' : 'hr-leave-card'}>
      <header>
        <h3>{item.type}</h3>
        <span>{item.code}</span>
      </header>
      <p className="hr-leave-available">
        {uncapped ? 'No cap' : formatDays(available)}
        {uncapped ? null : <span>{over ? 'over' : 'available'}</span>}
      </p>
      <p className="hr-leave-note">{TYPE_NOTES[item.code] ?? 'Company leave type.'}</p>
      {uncapped || item.entitled <= 0 ? null : (
        <div
          className="hr-leave-meter"
          role="img"
          aria-label={`${formatDays(item.used)} used, ${formatDays(item.pending)} pending, ${formatDays(available)} available of ${formatDays(item.entitled)}`}
        >
          <span className="hr-leave-meter-used" style={{ width: `${used}%` }} />
          <span className="hr-leave-meter-pending" style={{ width: `${pending}%` }} />
        </div>
      )}
      <div className="hr-leave-fields">
        <DayField
          label="Entitled"
          value={item.entitled}
          onChange={(value) => onChange('entitled', value)}
        />
        <DayField label="Used" value={item.used} onChange={(value) => onChange('used', value)} />
        <DayField
          label="Pending"
          value={item.pending}
          onChange={(value) => onChange('pending', value)}
        />
      </div>
    </article>
  );
}

function canonicalDayText(raw: string) {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '.') return trimmed;
  if (trimmed.endsWith('.')) {
    const head = Number(trimmed.slice(0, -1));
    return Number.isFinite(head) ? `${head}.` : trimmed;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? String(value) : trimmed;
}

function DayField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);

  function commit(next: number) {
    setText(null);
    onChange(next);
  }

  return (
    <label>
      <span>{label}</span>
      <span className="hr-leave-stepper">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => commit(value - 0.5)}
          disabled={value <= 0}
        >
          −
        </button>
        <input
          inputMode="decimal"
          aria-label={label}
          value={text ?? String(value)}
          onFocus={() => setText(String(value))}
          onBlur={(event) => {
            const raw = event.currentTarget.value.trim();
            onChange(raw === '' || raw === '.' ? 0 : Number(canonicalDayText(raw)));
            setText(null);
          }}
          onChange={(event) => {
            const shown = canonicalDayText(event.target.value);
            setText(shown);
            if (shown === '' || shown === '.' || shown.endsWith('.')) return;
            onChange(Number(shown));
          }}
        />
        <button type="button" aria-label={`Increase ${label}`} onClick={() => commit(value + 0.5)}>
          +
        </button>
      </span>
    </label>
  );
}

function groupHolidays(items: Array<{ date: string; name: string }>) {
  const today = startOfToday();
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const next = sorted.find((holiday) => parseDate(holiday.date) >= today);
  const months = new Map<string, Array<{ date: string; name: string; dayLabel: string; past: boolean }>>();

  for (const holiday of sorted) {
    const date = parseDate(holiday.date);
    const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const bucket = months.get(label) ?? [];
    bucket.push({
      date: holiday.date,
      name: holiday.name,
      dayLabel: date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      past: date < today,
    });
    months.set(label, bucket);
  }

  return {
    nextDate: next?.date ?? null,
    upcoming: sorted.filter((holiday) => parseDate(holiday.date) >= today).length,
    months: [...months.entries()].map(([label, group]) => ({ label, items: group })),
  };
}
