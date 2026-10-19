import { useEffect, useState, type FormEvent } from 'react';
import { EmployeePhoto } from '../ess/components/EmployeePhoto';
import { StatusChip } from '../ess/components/StatusChip';
import { fetchHrEmployees, type HrEmployee } from './hrApi';
import {
  createDevice,
  createHoliday,
  downloadRegister,
  enrollDevice,
  fetchAttendanceExceptions,
  fetchAttendancePeriod,
  fetchDevices,
  fetchHolidays,
  fetchShifts,
  fetchUnmatchedPunches,
  lockAttendancePeriod,
  mapUnmatchedPunch,
  overrideDay,
  uiStatus,
  type AttendanceDevice,
  type HolidayDto,
  type ShiftDto,
} from './attendanceApi';
import './hr-att.css';

type ExceptionRow = {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  note: string;
  employeeId: string;
  person: { id: string; name: string; photo: string; employeeCode: string } | null;
};

export function HrAttendanceAdminPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [unmatched, setUnmatched] = useState<
    Array<{ id: string; pin: string; rawTimestamp: string; serial: string; deviceName: string | null }>
  >([]);
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [holidays, setHolidays] = useState<HolidayDto[]>([]);
  const [shifts, setShifts] = useState<ShiftDto[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [period, setPeriod] = useState<'open' | 'locked'>('open');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [serial, setSerial] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [enrollPin, setEnrollPin] = useState('');
  const [enrollEmployee, setEnrollEmployee] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideStatus, setOverrideStatus] = useState<'present' | 'absent' | 'leave'>('present');

  function load() {
    Promise.all([
      fetchAttendanceExceptions(year, month),
      fetchUnmatchedPunches(),
      fetchDevices().catch(() => ({ devices: [], operationLogs: [] })),
      fetchHolidays(),
      fetchShifts(),
      fetchHrEmployees(),
      fetchAttendancePeriod(year, month),
    ])
      .then(([exceptionRows, pins, devicePayload, holidayRows, shiftRows, people, periodRow]) => {
        setExceptions(exceptionRows);
        setUnmatched(pins);
        setDevices(devicePayload.devices);
        setHolidays(holidayRows);
        setShifts(shiftRows);
        setEmployees(people);
        setPeriod(periodRow.status);
        setError(null);
        if (!selectedId && exceptionRows[0]) {
          setSelectedId(`${exceptionRows[0].employeeId}:${exceptionRows[0].date}`);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load attendance.'));
  }

  useEffect(() => {
    load();
  }, [month, year]);

  const selected = exceptions.find((item) => `${item.employeeId}:${item.date}` === selectedId) ?? null;
  const shift = shifts[0];

  async function onHoliday(event: FormEvent) {
    event.preventDefault();
    try {
      await createHoliday({ date: holidayDate, name: holidayName });
      setHolidayName('');
      setHolidayDate('');
      setMessage('Holiday saved.');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the holiday.');
    }
  }

  async function onDevice(event: FormEvent) {
    event.preventDefault();
    try {
      await createDevice({ serial, name: deviceName, directionMode: 'inferred' });
      setSerial('');
      setDeviceName('');
      setMessage('Device registered. Point it at /api/v1/iclock/cdata.');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not register the device.');
    }
  }

  async function onEnroll(event: FormEvent) {
    event.preventDefault();
    const device = devices[0];
    if (!device) {
      setError('Register a device first.');
      return;
    }
    try {
      await enrollDevice(device.id, enrollEmployee, enrollPin);
      setMessage('Enrollment queued. The terminal picks it up on the next poll.');
      setEnrollPin('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not enroll that PIN.');
    }
  }

  async function onMap(punchId: string, employeeId: string) {
    try {
      await mapUnmatchedPunch(punchId, employeeId);
      setMessage('PIN mapped to the employee.');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not map that punch.');
    }
  }

  async function onOverride(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      await overrideDay(selected.employeeId, selected.date, {
        status: overrideStatus,
        reason: overrideReason,
      });
      setOverrideReason('');
      setMessage('Day updated.');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update that day.');
    }
  }

  async function onLock() {
    try {
      await lockAttendancePeriod(year, month);
      setMessage('Month locked.');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not lock the month.');
    }
  }

  return (
    <div className="hr-att">
      <header className="hr-att-head">
        <div>
          <h1>Attendance</h1>
          <p>
            Exceptions, eSSL devices, and the PeopleOS month. This register stays in PeopleOS.
          </p>
        </div>
      </header>
      {error ? <p className="ess-alert">{error}</p> : null}
      {message ? <p className="ess-muted">{message}</p> : null}

      <div className="hr-att-board">
        <section className="hr-att-panel">
          <h2>Needs a look</h2>
          <ul className="hr-att-list">
            {exceptions.map((item) => {
              const id = `${item.employeeId}:${item.date}`;
              return (
                <li key={id}>
                  <button type="button" className={id === selectedId ? 'is-selected' : undefined} onClick={() => setSelectedId(id)}>
                    <EmployeePhoto src={item.person?.photo ?? ''} name={item.person?.name ?? 'Employee'} size="sm" />
                    <span>
                      <strong>{item.person?.name ?? 'Employee'}</strong>
                      <span>
                        {uiStatus(item.status as 'present' | 'absent' | 'leave' | 'holiday' | 'weekend' | 'half_day' | 'missing_punch')} · {item.date}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {exceptions.length === 0 ? <p className="hr-att-empty">No exceptions this month.</p> : null}
        </section>

        <section className="hr-att-detail">
          {selected ? (
            <>
              <header className="hr-att-person">
                <EmployeePhoto src={selected.person?.photo ?? ''} name={selected.person?.name ?? 'Employee'} size="md" />
                <div>
                  <h2>{selected.person?.name}</h2>
                  <p>
                    {selected.person?.employeeCode} · {selected.date}
                  </p>
                </div>
                <StatusChip status={uiStatus(selected.status as 'present' | 'absent' | 'leave' | 'holiday' | 'weekend' | 'half_day' | 'missing_punch')} />
              </header>
              <p className="hr-att-summary">
                {selected.checkIn ?? '—'} → {selected.checkOut ?? '—'}
                {selected.note ? ` · ${selected.note}` : ''}
              </p>
              <form className="ess-form" onSubmit={(event) => void onOverride(event)}>
                <div className="ess-field">
                  <label htmlFor="override-status">HR override</label>
                  <select
                    id="override-status"
                    value={overrideStatus}
                    onChange={(event) => setOverrideStatus(event.target.value as 'present' | 'absent' | 'leave')}
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                  </select>
                </div>
                <div className="ess-field">
                  <label htmlFor="override-reason">Reason</label>
                  <textarea
                    id="override-reason"
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="ess-btn ess-btn-primary">
                  Save override
                </button>
              </form>
            </>
          ) : (
            <p className="hr-att-empty">Select an exception.</p>
          )}
        </section>
      </div>

      <div className="hr-att-board">
        <section className="hr-att-panel">
          <div className="hr-att-panel-head">
            <div>
              <h2>{shift ? `${shift.name} shift` : 'Shift'}</h2>
              <p>
                {period === 'locked' ? 'This month is locked.' : 'This month is open. No lock is active.'}
              </p>
            </div>
            <p className="hr-att-window">
              {shift ? `${shift.startTime}–${shift.endTime}` : '—'}
            </p>
          </div>
          <div className="ess-actions">
            <button type="button" className="ess-btn" disabled={period === 'locked'} onClick={() => void onLock()}>
              Lock month
            </button>
            <button type="button" className="ess-btn ess-btn-ghost" onClick={() => void downloadRegister(year, month)}>
              Download register
            </button>
          </div>
        </section>

        <section className="hr-att-panel">
          <h2>Unmatched PINs</h2>
          {unmatched.length === 0 ? <p className="hr-att-empty">Every punch maps to an employee.</p> : null}
          <ul className="ess-list">
            {unmatched.map((punch) => (
              <li key={punch.id} className="ess-list-item">
                <strong>{punch.pin}</strong>
                <span className="ess-muted">
                  {punch.rawTimestamp} · {punch.deviceName ?? punch.serial}
                </span>
                <select
                  aria-label={`Map ${punch.pin}`}
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) void onMap(punch.id, event.target.value);
                  }}
                >
                  <option value="">Map to employee</option>
                  {employees.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.employeeCode} · {person.firstName} {person.lastName}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>

        <section className="hr-att-panel">
          <h2>Holidays</h2>
          <ul className="ess-list">
            {holidays.map((holiday) => (
              <li key={holiday.id} className="ess-list-item">
                <strong>{holiday.name}</strong>
                <span className="ess-muted">{holiday.date}</span>
              </li>
            ))}
          </ul>
          <form className="ess-form" onSubmit={(event) => void onHoliday(event)}>
            <div className="ess-field">
              <label htmlFor="holiday-date">Date</label>
              <input id="holiday-date" type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} required />
            </div>
            <div className="ess-field">
              <label htmlFor="holiday-name">Name</label>
              <input id="holiday-name" value={holidayName} onChange={(event) => setHolidayName(event.target.value)} required />
            </div>
            <button type="submit" className="ess-btn ess-btn-primary">
              Add holiday
            </button>
          </form>
        </section>

        <section className="hr-att-panel">
          <h2>eSSL devices</h2>
          <p className="hr-att-note">Server path /api/v1/iclock/cdata on port 3000. Templates stay on the terminal.</p>
          <ul className="ess-list">
            {devices.map((device) => (
              <li key={device.id} className="ess-list-item">
                <strong>{device.name}</strong>
                <span className="ess-muted">
                  {device.serial} · {device.directionMode} · last seen {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('en-IN') : 'never'}
                </span>
              </li>
            ))}
          </ul>
          <form className="ess-form" onSubmit={(event) => void onDevice(event)}>
            <div className="ess-field">
              <label htmlFor="device-serial">Serial</label>
              <input id="device-serial" value={serial} onChange={(event) => setSerial(event.target.value)} required />
            </div>
            <div className="ess-field">
              <label htmlFor="device-name">Name</label>
              <input id="device-name" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} required />
            </div>
            <button type="submit" className="ess-btn ess-btn-primary">
              Register device
            </button>
          </form>
          <form className="ess-form" onSubmit={(event) => void onEnroll(event)}>
            <div className="ess-field">
              <label htmlFor="enroll-employee">Employee</label>
              <select id="enroll-employee" value={enrollEmployee} onChange={(event) => setEnrollEmployee(event.target.value)} required>
                <option value="">Select</option>
                {employees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.employeeCode} · {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="ess-field">
              <label htmlFor="enroll-pin">Device PIN</label>
              <input id="enroll-pin" value={enrollPin} onChange={(event) => setEnrollPin(event.target.value)} required />
            </div>
            <button type="submit" className="ess-btn">
              Queue enrollment
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
