import { useMemo, useState, type FormEvent } from 'react';
import {
  CalendarOff,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Flag,
  Moon,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useWorkspace } from '../../workspace/workspaceMock';
import { StatusChip } from '../components/StatusChip';
import { useEssData } from '../mock/EssDataContext';
import {
  buildLightAttendanceMonth,
  type AttendanceDay,
  type AttendanceStatus,
  type Holiday,
} from '../mock/essMock';

type View = 'month' | 'register';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEMO_TODAY = '2026-09-29';
const SHIFT_LABEL = 'General · 09:00–18:00';
const SHIFT_START = 9 * 60;
const SHIFT_END = 18 * 60;
const BREAK_MINS = 60;

const SESSIONS = [
  { name: 'Morning', window: '09:00–13:00', slot: 'in' as const },
  { name: 'Afternoon', window: '14:00–18:00', slot: 'out' as const },
];

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toMinutes(hhmm: string) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDuration(mins: number | null) {
  if (mins == null) return '—';
  if (mins === 0) return '0m';
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sum(values: Array<number | null>) {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return present.reduce((total, value) => total + value, 0);
}

function monthTitle(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDay(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

function formatShort(isoDate: string) {
  const value = new Date(`${isoDate}T12:00:00`);
  return {
    weekday: value.toLocaleDateString('en-IN', { weekday: 'short' }),
    label: value.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
  };
}

function chipStatus(status: string) {
  if (status === 'PendingCorrection') return 'Pending correction';
  return status;
}

const STATUS_MARK: Record<AttendanceStatus, { label: string; icon: LucideIcon }> = {
  Present: { label: 'P', icon: Check },
  Absent: { label: 'A', icon: X },
  Leave: { label: 'L', icon: CalendarOff },
  Holiday: { label: 'H', icon: Flag },
  Weekend: { label: 'Off', icon: Moon },
  PendingCorrection: { label: '!', icon: CircleAlert },
};

function dayClass(status?: AttendanceStatus, selected = false, today = false) {
  const statusClass = status ? ` ess-day-${status.toLowerCase()}` : '';
  return `ess-day${statusClass}${selected ? ' is-selected' : ''}${today ? ' is-today' : ''}`;
}

type DayMath = {
  late: number | null;
  early: number | null;
  work: number | null;
  breakMins: number | null;
  desk: number | null;
  missingPunch: boolean;
};

function dayMath(day?: AttendanceDay): DayMath {
  const empty: DayMath = {
    late: null,
    early: null,
    work: null,
    breakMins: null,
    desk: null,
    missingPunch: false,
  };
  if (!day || (day.status !== 'Present' && day.status !== 'PendingCorrection')) return empty;

  const late = day.checkIn ? Math.max(0, toMinutes(day.checkIn) - SHIFT_START) : null;
  const early = day.checkOut ? Math.max(0, SHIFT_END - toMinutes(day.checkOut)) : null;
  const missingPunch = !day.checkIn || !day.checkOut;
  if (!day.checkIn || !day.checkOut) {
    return { ...empty, late, early, missingPunch };
  }

  const span = toMinutes(day.checkOut) - toMinutes(day.checkIn);
  if (span <= 0) return { ...empty, late, early, missingPunch };
  return {
    late,
    early,
    work: span,
    breakMins: BREAK_MINS,
    desk: Math.max(0, span - BREAK_MINS),
    missingPunch,
  };
}

function isException(day: AttendanceDay) {
  if (day.status === 'Weekend' || day.status === 'Holiday' || day.status === 'Leave') return false;
  if (day.status === 'Absent' || day.status === 'PendingCorrection') return true;
  return day.status === 'Present' && (!day.checkIn || !day.checkOut);
}

function isOnTime(day: AttendanceDay) {
  if (!day.checkIn) return false;
  if (day.status !== 'Present' && day.status !== 'PendingCorrection') return false;
  return toMinutes(day.checkIn) <= SHIFT_START;
}

function monthCells(year: number, month: number, attendance: AttendanceDay[], holidays: Holiday[]) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const stored = new Map(
    attendance.filter((day) => day.date.startsWith(prefix)).map((day) => [day.date, day]),
  );
  const light = new Map(
    buildLightAttendanceMonth(year, month, holidays).map((day) => [day.date, day]),
  );
  const last = new Date(year, month, 0).getDate();
  const cells: Array<{ date: string; day: number; record?: AttendanceDay }> = [];
  for (let day = 1; day <= last; day++) {
    const date = iso(year, month, day);
    cells.push({ date, day, record: stored.get(date) ?? light.get(date) });
  }
  return cells;
}

export function EssAttendancePage() {
  const { attendance, corrections, holidays, markAttendance, requestCorrection } = useEssData();
  const { inbox } = useWorkspace();
  const correctionRows = corrections.map((item) => {
    const stored = inbox.find((entry) => entry.id === item.id);
    return stored
      ? { ...item, status: stored.status, approverName: stored.approverName }
      : item;
  });
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState({ year: 2026, month: 9 });
  const [selectedDate, setSelectedDate] = useState(DEMO_TODAY);
  const [regularizing, setRegularizing] = useState(false);
  const [corrDate, setCorrDate] = useState(DEMO_TODAY);
  const [corrStatus, setCorrStatus] = useState<'Present' | 'Absent'>('Present');
  const [corrReason, setCorrReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cells = useMemo(
    () => monthCells(cursor.year, cursor.month, attendance, holidays),
    [attendance, cursor.month, cursor.year, holidays],
  );
  const recorded = cells.flatMap((cell) => (cell.record ? [cell.record] : []));
  const mathByDate = useMemo(() => {
    const map = new Map<string, DayMath>();
    for (const cell of cells) map.set(cell.date, dayMath(cell.record));
    return map;
  }, [cells]);

  const exceptions = recorded.filter(isException).sort((a, b) => a.date.localeCompare(b.date));
  const onTime = recorded.filter(isOnTime).length;
  const missingPunches = recorded.filter((day) => dayMath(day).missingPunch).length;
  const penaltyDays = recorded.filter((day) => day.status === 'Absent').length;
  const worked = recorded.map((day) => dayMath(day).work).filter((value): value is number => value != null);
  const desk = recorded.map((day) => dayMath(day).desk).filter((value): value is number => value != null);

  const selected = cells.find((cell) => cell.date === selectedDate);
  const selectedMath = selected ? mathByDate.get(selected.date) : undefined;
  const leadingBlanks = new Date(cursor.year, cursor.month - 1, 1).getDay();

  function shiftMonth(delta: number) {
    const next = new Date(cursor.year, cursor.month - 1 + delta, 1);
    const year = next.getFullYear();
    const month = next.getMonth() + 1;
    setCursor({ year, month });
    setSelectedDate(iso(year, month, 1));
    setRegularizing(false);
    setError(null);
  }

  function openRegularize(date: string) {
    const [year, month] = date.split('-').map(Number);
    setCursor({ year, month });
    setSelectedDate(date);
    setView('month');
    setCorrDate(date);
    setCorrStatus('Present');
    setCorrReason('');
    setError(null);
    setRegularizing(true);
  }

  function onCorrection(event: FormEvent) {
    event.preventDefault();
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
    setRegularizing(false);
  }

  return (
    <div className="ess-att ess-section-stack">
      {exceptions.length > 0 ? (
        <div className="ess-att-alert">
          <p>
            <strong>{exceptions.length}</strong>{' '}
            {exceptions.length === 1 ? 'day needs a look' : 'days need a look'}
          </p>
          <div className="ess-actions">
            <button
              type="button"
              className="ess-btn ess-btn-primary"
              onClick={() => openRegularize(exceptions[0].date)}
            >
              Regularize
            </button>
            <a className="ess-btn ess-btn-ghost" href="#ess-att-requests">
              Your requests
            </a>
          </div>
        </div>
      ) : null}

      <div className="ess-att-insight-block">
      <div className="ess-att-insights">
        <article className="ess-panel ess-att-stat">
          <p className="ess-muted">Time in office</p>
          <p className="ess-att-stat-value">{formatDuration(average(worked))}</p>
        </article>
        <article className="ess-panel ess-att-stat">
          <p className="ess-muted">After the break</p>
          <p className="ess-att-stat-value">{formatDuration(average(desk))}</p>
        </article>
        <article className="ess-panel ess-att-stat">
          <p className="ess-muted">Needs attention</p>
          <p className="ess-att-stat-value">{exceptions.length}</p>
        </article>
      </div>
      <p className="ess-att-facts">
        <span>
          <strong>{onTime}</strong> on time
        </span>
        <span>
          <strong>{missingPunches}</strong> missing punches
        </span>
        <span>
          <strong>{penaltyDays}</strong> penalty {penaltyDays === 1 ? 'day' : 'days'}
        </span>
      </p>
      </div>

      <div className={view === 'month' ? 'ess-att-split' : undefined}>
        <section className="ess-panel">
          <div className="ess-att-toolbar">
            <div className="ess-att-monthnav">
              <button
                type="button"
                className="ess-btn ess-btn-ghost ess-att-nav"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <h2>{monthTitle(cursor.year, cursor.month)}</h2>
              <button
                type="button"
                className="ess-btn ess-btn-ghost ess-att-nav"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
            <div className="ess-tabs" role="tablist" aria-label="Attendance view">
              {(
                [
                  ['month', 'Month'],
                  ['register', 'Register'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  className={view === id ? 'ess-tab is-active' : 'ess-tab'}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {view === 'month' ? (
            <>
              <div className="ess-calendar" role="grid" aria-label="Attendance month">
                {DOW.map((day) => (
                  <div key={day} className="ess-calendar-dow">
                    {day}
                  </div>
                ))}
                {Array.from({ length: leadingBlanks }, (_, index) => (
                  <div key={`blank-${index}`} />
                ))}
                {cells.map((cell) => (
                  <button
                    key={cell.date}
                    type="button"
                    role="gridcell"
                    className={dayClass(
                      cell.record?.status,
                      selectedDate === cell.date,
                      cell.date === DEMO_TODAY,
                    )}
                    onClick={() => {
                      setSelectedDate(cell.date);
                      setRegularizing(false);
                      setError(null);
                    }}
                    aria-pressed={selectedDate === cell.date}
                    aria-label={`${formatDay(cell.date)}${
                      cell.record ? `, ${chipStatus(cell.record.status)}` : ', not marked'
                    }`}
                  >
                    <span className="ess-day-num">{cell.day}</span>
                    {cell.record ? <DayMark status={cell.record.status} /> : null}
                  </button>
                ))}
              </div>
              <div className="ess-legend">
                {(
                  [
                    ['Present', 'Present'],
                    ['Absent', 'Absent'],
                    ['Leave', 'Leave'],
                    ['Holiday', 'Holiday'],
                    ['Weekend', 'Week off'],
                    ['PendingCorrection', 'Pending'],
                  ] as const
                ).map(([status, label]) => (
                  <span key={status}>
                    <DayMark status={status} />
                    {label}
                  </span>
                ))}
                <span>
                  <i className="ess-legend-today" /> Today
                </span>
              </div>
            </>
          ) : (
            <div className="ess-table-wrap">
              <table className="ess-table ess-att-register">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Late</th>
                    <th>Left early</th>
                    <th>Work</th>
                    <th>Break</th>
                    <th>On desk</th>
                  </tr>
                </thead>
                <tbody>
                  {cells.map((cell) => {
                    const math = mathByDate.get(cell.date);
                    const quiet =
                      cell.record?.status === 'Weekend' || cell.record?.status === 'Holiday';
                    const short = formatShort(cell.date);
                    return (
                      <tr
                        key={cell.date}
                        className={quiet ? 'is-quiet' : undefined}
                        onClick={() => setSelectedDate(cell.date)}
                      >
                        <td>
                          <span className="ess-att-date">
                            {short.weekday}
                            <strong>{short.label}</strong>
                          </span>
                        </td>
                        <td>
                          {cell.record ? (
                            <StatusChip status={chipStatus(cell.record.status)} />
                          ) : (
                            <span className="ess-muted">Not marked</span>
                          )}
                        </td>
                        <td>{cell.record?.checkIn ?? '—'}</td>
                        <td>{cell.record?.checkOut ?? '—'}</td>
                        <td>{formatDuration(math?.late ?? null)}</td>
                        <td>{formatDuration(math?.early ?? null)}</td>
                        <td>{formatDuration(math?.work ?? null)}</td>
                        <td>{formatDuration(math?.breakMins ?? null)}</td>
                        <td>{formatDuration(math?.desk ?? null)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Month total</td>
                    <td>{formatDuration(sum(cells.map((cell) => mathByDate.get(cell.date)?.late ?? null)))}</td>
                    <td>{formatDuration(sum(cells.map((cell) => mathByDate.get(cell.date)?.early ?? null)))}</td>
                    <td>{formatDuration(sum(cells.map((cell) => mathByDate.get(cell.date)?.work ?? null)))}</td>
                    <td>{formatDuration(sum(cells.map((cell) => mathByDate.get(cell.date)?.breakMins ?? null)))}</td>
                    <td>{formatDuration(sum(cells.map((cell) => mathByDate.get(cell.date)?.desk ?? null)))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {view === 'month' ? (
          <DayDossier
            date={selectedDate}
            day={selected?.record}
            math={selectedMath}
            regularizing={regularizing}
            corrDate={corrDate}
            corrStatus={corrStatus}
            corrReason={corrReason}
            error={error}
            onCorrDate={setCorrDate}
            onCorrStatus={setCorrStatus}
            onCorrReason={setCorrReason}
            onSubmit={onCorrection}
            onRegularize={() => openRegularize(selectedDate)}
            onCancel={() => {
              setRegularizing(false);
              setError(null);
            }}
            onMark={() => markAttendance(DEMO_TODAY)}
            canMark={selectedDate === DEMO_TODAY && selected?.record?.status !== 'Present'}
          />
        ) : null}
      </div>

      <section id="ess-att-requests" className="ess-panel">
        <h2>Your requests</h2>
        {correctionRows.length === 0 ? (
          <p className="ess-empty">No regularization requests.</p>
        ) : (
          <ul className="ess-list">
            {correctionRows.map((item) => (
              <li key={item.id} className="ess-list-item">
                <div className="ess-leave-request-head">
                  <strong>{formatDay(item.date)}</strong>
                  <StatusChip status={item.status} />
                </div>
                <span className="ess-list-meta">Requested {item.requestedStatus}</span>
                <span className="ess-muted">{item.reason}</span>
                {item.status === 'Pending' && item.approverName ? (
                  <span className="ess-muted">With {item.approverName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DayDossier({
  date,
  day,
  math,
  regularizing,
  corrDate,
  corrStatus,
  corrReason,
  error,
  onCorrDate,
  onCorrStatus,
  onCorrReason,
  onSubmit,
  onRegularize,
  onCancel,
  onMark,
  canMark,
}: {
  date: string;
  day?: AttendanceDay;
  math?: DayMath;
  regularizing: boolean;
  corrDate: string;
  corrStatus: 'Present' | 'Absent';
  corrReason: string;
  error: string | null;
  onCorrDate: (value: string) => void;
  onCorrStatus: (value: 'Present' | 'Absent') => void;
  onCorrReason: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onRegularize: () => void;
  onCancel: () => void;
  onMark: () => void;
  canMark: boolean;
}) {
  const short = formatShort(date);

  return (
    <section className="ess-panel ess-att-dossier">
      <div className={`ess-att-dossier-head${day ? ` is-${day.status.toLowerCase()}` : ''}`}>
        <div>
          <p className="ess-att-dow">{short.weekday}</p>
          <h2>{short.label}</h2>
        </div>
        {day ? <StatusChip status={chipStatus(day.status)} /> : <span className="ess-muted">Not marked</span>}
      </div>
      <p className="ess-muted ess-att-shift">{SHIFT_LABEL}</p>

      {regularizing ? (
        <form className="ess-form" onSubmit={onSubmit}>
          {error ? <div className="ess-alert">{error}</div> : null}
          <div className="ess-field">
            <label htmlFor="corr-date">Date</label>
            <input
              id="corr-date"
              type="date"
              value={corrDate}
              onChange={(event) => onCorrDate(event.target.value)}
              required
            />
          </div>
          <div className="ess-field">
            <label htmlFor="corr-status">Requested status</label>
            <select
              id="corr-status"
              value={corrStatus}
              onChange={(event) => onCorrStatus(event.target.value as 'Present' | 'Absent')}
            >
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
          <div className="ess-field">
            <label htmlFor="corr-reason">Reason</label>
            <textarea
              id="corr-reason"
              value={corrReason}
              onChange={(event) => onCorrReason(event.target.value)}
              required
            />
          </div>
          <div className="ess-actions">
            <button type="submit" className="ess-btn ess-btn-primary">
              Submit regularization
            </button>
            <button type="button" className="ess-btn ess-btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="ess-att-metrics">
            <Metric label="First in" value={day?.checkIn ?? '—'} />
            <Metric label="Last out" value={day?.checkOut ?? '—'} />
            <Metric label="Late in" value={formatDuration(math?.late ?? null)} />
            <Metric label="Left early" value={formatDuration(math?.early ?? null)} />
            <Metric label="Work" value={formatDuration(math?.work ?? null)} />
            <Metric label="Break" value={formatDuration(math?.breakMins ?? null)} />
            <Metric label="On desk" value={formatDuration(math?.desk ?? null)} />
          </div>

          <div className="ess-att-status">
            <h3>Status</h3>
            <p>{day?.note ?? 'No remarks for this day.'}</p>
          </div>

          <div className="ess-att-sessions">
            <h3>Sessions</h3>
            <table className="ess-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Timing</th>
                  <th>First in</th>
                  <th>Last out</th>
                </tr>
              </thead>
              <tbody>
                {SESSIONS.map((session) => (
                  <tr key={session.name}>
                    <td>{session.name}</td>
                    <td>{session.window}</td>
                    <td>{session.slot === 'in' ? (day?.checkIn ?? '—') : '—'}</td>
                    <td>{session.slot === 'out' ? (day?.checkOut ?? '—') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ess-actions">
            {canMark ? (
              <button type="button" className="ess-btn ess-btn-primary" onClick={onMark}>
                Mark present
              </button>
            ) : null}
            <button type="button" className="ess-btn" onClick={onRegularize}>
              Regularize
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function DayMark({ status }: { status: AttendanceStatus }) {
  const mark = STATUS_MARK[status];
  const Icon = mark.icon;
  return (
    <span className={`ess-day-mark ess-day-mark-${status.toLowerCase()}`}>
      <Icon size={12} aria-hidden />
      {mark.label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ess-att-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
