import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { EmployeePhoto } from '../ess/components/EmployeePhoto';
import { holidays } from './workspaceMock';
import {
  fetchHrEmployee,
  fetchHrEmployees,
  updateHrLeaveBalances,
  type HrEmployee,
  type HrLeaveBalance,
} from './hrApi';
import './hr-leave.css';

const TYPE_ORDER = ['CL', 'SL', 'EL', 'CO', 'WFH', 'OBH', 'LOP'];

const TYPE_NOTES: Record<string, string> = {
  CL: 'Short-notice personal leave.',
  SL: 'Leave taken for illness.',
  EL: 'Planned leave earned through the year.',
  CO: 'Time off earned from extra work.',
  WFH: 'Remote days counted on this balance.',
  OBH: 'Optional birthday holiday.',
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

  const holidayGroups = useMemo(() => groupHolidays(holidays), []);
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

  return (
    <label>
      <span>{label}</span>
      <span className="hr-leave-stepper">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(value - 0.5)}
          disabled={value <= 0}
        >
          −
        </button>
        <input
          type="number"
          min={0}
          step={0.5}
          inputMode="decimal"
          aria-label={label}
          value={text ?? value}
          onFocus={() => setText(String(value))}
          onBlur={(event) => {
            if (event.currentTarget.value.trim() === '') onChange(0);
            setText(null);
          }}
          onChange={(event) => {
            const raw = event.target.value;
            setText(raw);
            if (raw.trim() === '') return;
            onChange(Number(raw));
          }}
        />
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + 0.5)}>
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
