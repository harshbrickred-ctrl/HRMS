import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { fetchMyAttendance, punchMe } from '../../workspace/attendanceApi';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock,
  Inbox,
  LayoutDashboard,
  Shield,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { EmployeePhoto } from '../components/EmployeePhoto';
import { StatusChip } from '../components/StatusChip';
import { localToday, useEssData } from '../mock/EssDataContext';
import type { AttendanceDay, Payslip } from '../mock/essMock';

function lineTotal(lines: { amount: number }[]) {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

function netPay(slip: Payslip) {
  return lineTotal(slip.earnings) - lineTotal(slip.deductions);
}

function formatToday() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function shortMonth(month: string) {
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

function paidDaysFor(month: string, attendance: AttendanceDay[]) {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const inMonth = attendance.filter((day) => day.date.startsWith(month));
  if (inMonth.length === 0) return daysInMonth;
  return inMonth.filter((day) => day.status !== 'Absent').length;
}

function holidayWhen(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return {
    day: value.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: value.toLocaleDateString('en-IN', { month: 'short' }),
    weekday: value.toLocaleDateString('en-IN', { weekday: 'long' }),
  };
}

function downloadPayslip(slip: Payslip, gross: number, deductions: number) {
  const rows = [
    `Payslip,${slip.label}`,
    ...slip.earnings.map((line) => `Earning,${line.label},${line.amount}`),
    ...slip.deductions.map((line) => `Deduction,${line.label},${line.amount}`),
    `Gross,${gross}`,
    `Deductions,${deductions}`,
    `Net,${gross - deductions}`,
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payslip-${slip.month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

type Shortcut = {
  to: string;
  label: string;
  meta?: string;
  icon: LucideIcon;
  accent?: boolean;
};

export function EssHomePage() {
  const { hasRole } = useAuth();
  const {
    profile,
    leaveBalances,
    leaveRequests,
    notifications,
    holidays,
    attendance,
    corrections,
    payslips,
    salaryHidden,
    toggleSalaryHidden,
    showAmount,
  } = useEssData();

  const pendingLeave = leaveRequests.filter((r) => r.status === 'Pending');
  const pendingCorrections = corrections.filter((c) => c.status === 'Pending');
  const unread = notifications.filter((n) => !n.read).slice(0, 3);
  const today = localToday();
  const hour = new Date().getHours();
  const [punchState, setPunchState] = useState({ enabled: false, checkIn: '', checkOut: '' });
  const [punchError, setPunchError] = useState<string | null>(null);
  useEffect(() => {
    const [year, month] = today.split('-').map(Number);
    let cancel = false;
    fetchMyAttendance(year, month)
      .then((monthData) => {
        if (cancel) return;
        const day = monthData.days.find((item) => item.date === today);
        setPunchState({
          enabled: monthData.webPunchEnabled,
          checkIn: day?.checkIn ?? '',
          checkOut: day?.checkOut ?? '',
        });
      })
      .catch(() => {
        if (!cancel) setPunchState({ enabled: false, checkIn: '', checkOut: '' });
      });
    return () => {
      cancel = true;
    };
  }, [today]);
  const punchedIn = Boolean(punchState.checkIn);
  const punchedOut = Boolean(punchState.checkOut);
  const leaveAvailable = leaveBalances.reduce(
    (sum, balance) => (balance.code === 'LOP' ? sum : sum + balance.available),
    0,
  );
  const latestPayslip = payslips[0];
  const latestGross = latestPayslip ? lineTotal(latestPayslip.earnings) : 0;
  const latestDeductions = latestPayslip ? lineTotal(latestPayslip.deductions) : 0;
  const deductionShare = latestGross === 0 ? 0 : (latestDeductions / latestGross) * 100;
  const paidDays = latestPayslip ? paidDaysFor(latestPayslip.month, attendance) : 0;
  const upcomingHolidays = holidays
    .filter((holiday) => holiday.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const monthKey = today.slice(0, 7);
  const presentDays = attendance.filter(
    (day) =>
      day.date.startsWith(monthKey) &&
      day.date <= today &&
      (day.status === 'Present' || day.status === 'PendingCorrection'),
  ).length;

  const isManager = hasRole('MANAGER');
  const isHr = hasRole('HR_EXEC') || hasRole('HR_HEAD');
  const isAdmin = hasRole('SECURITY_ADMIN') || hasRole('IT_ADMIN');
  const isLeadership = hasRole('LEADERSHIP_READ');

  const teamInboxCount = isManager ? 3 : 0;
  const teamOnLeaveToday = isManager ? 2 : 0;

  const roleShortcuts: Shortcut[] = [
    ...(isManager
      ? [
          {
            to: '/manager/inbox',
            label: 'Inbox',
            meta: `${teamInboxCount} waiting`,
            icon: Inbox,
          },
          {
            to: '/manager/team-leave',
            label: 'Team leave',
            meta: `${teamOnLeaveToday} on leave`,
            icon: CalendarDays,
          },
          {
            to: '/manager/team-attendance',
            label: 'Team attendance',
            icon: Clock,
          },
        ]
      : []),
    ...(isHr
      ? [
          {
            to: '/hr',
            label: 'HR overview',
            icon: LayoutDashboard,
          },
          {
            to: '/hr/employees',
            label: 'Employees',
            icon: Users,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            to: '/admin',
            label: 'Admin overview',
            icon: LayoutDashboard,
          },
          {
            to: '/admin/roles',
            label: 'Users & Roles',
            icon: Shield,
          },
        ]
      : []),
    ...(isLeadership
      ? [
          {
            to: '/exec',
            label: 'Leadership',
            icon: LayoutDashboard,
          },
          {
            to: '/exec/reports',
            label: 'Reports',
            icon: BarChart3,
          },
        ]
      : []),
  ];

  return (
    <div className="ess-home ess-section-stack">
      <header className="ess-home-hero">
        <div className="ess-home-hero-person">
          <EmployeePhoto
            src={profile.photo}
            name={`${profile.firstName} ${profile.lastName}`}
            size="lg"
          />
          <div>
            <h1 className="ess-greeting">
              Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'},{' '}
              {profile.firstName}
            </h1>
            <p className="ess-lead">
              {formatToday()} · {profile.title}
            </p>
            <p className="ess-home-meta">
              {profile.employeeCode} · {profile.department} · {profile.location}
            </p>
          </div>
        </div>
        <div className="ess-actions">
          <button
            type="button"
            className={punchedIn ? 'ess-btn' : 'ess-btn ess-btn-primary'}
            disabled={!punchState.enabled || punchedIn}
            onClick={() => {
              void punchMe('IN')
                .then(() => setPunchState((current) => ({ ...current, checkIn: 'now' })))
                .then(() => {
                  const [year, month] = today.split('-').map(Number);
                  return fetchMyAttendance(year, month);
                })
                .then((monthData) => {
                  const day = monthData.days.find((item) => item.date === today);
                  setPunchState({
                    enabled: monthData.webPunchEnabled,
                    checkIn: day?.checkIn ?? '',
                    checkOut: day?.checkOut ?? '',
                  });
                  setPunchError(null);
                })
                .catch((err: unknown) =>
                  setPunchError(err instanceof Error ? err.message : 'Punch failed.'),
                );
            }}
          >
            Punch in
          </button>
          <button
            type="button"
            className={!punchedIn || punchedOut ? 'ess-btn' : 'ess-btn ess-btn-primary'}
            disabled={!punchState.enabled || !punchedIn || punchedOut}
            onClick={() => {
              void punchMe('OUT')
                .then(() => {
                  const [year, month] = today.split('-').map(Number);
                  return fetchMyAttendance(year, month);
                })
                .then((monthData) => {
                  const day = monthData.days.find((item) => item.date === today);
                  setPunchState({
                    enabled: monthData.webPunchEnabled,
                    checkIn: day?.checkIn ?? '',
                    checkOut: day?.checkOut ?? '',
                  });
                  setPunchError(null);
                })
                .catch((err: unknown) =>
                  setPunchError(err instanceof Error ? err.message : 'Punch failed.'),
                );
            }}
          >
            Punch out
          </button>
          <Link to="/ess/leave" className="ess-btn">
            Apply leave
          </Link>
          {punchError ? <p className="ess-alert">{punchError}</p> : null}
        </div>
      </header>

      <div className="ess-dash">
        <div className="ess-dash-col">
        <section className="ess-panel">
          <div className="ess-panel-head">
            <h2>Notifications</h2>
            <Link to="/ess/notifications" className="ess-btn ess-btn-ghost">
              All
            </Link>
          </div>
          {unread.length === 0 ? (
            <p className="ess-empty">You are all caught up.</p>
          ) : (
            <ul className="ess-list">
              {unread.map((item) => (
                <li key={item.id}>
                  <Link to={item.href} className="ess-list-item is-unread">
                    <strong>{item.title}</strong>
                    <span className="ess-muted">{item.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ess-panel">
          <div className="ess-panel-head">
            <h2>Pending requests</h2>
            <span className="ess-muted">{pendingLeave.length + pendingCorrections.length}</span>
          </div>
          {pendingLeave.length + pendingCorrections.length === 0 ? (
            <p className="ess-empty">No pending requests.</p>
          ) : (
            <ul className="ess-list">
              {pendingLeave.slice(0, 2).map((request) => (
                <li key={request.id}>
                  <Link to="/ess/leave" className="ess-list-item">
                    <strong>
                      {request.type} · {request.days} day{request.days === 1 ? '' : 's'}
                    </strong>
                    <span className="ess-list-meta">
                      {request.startDate}
                      {request.endDate !== request.startDate ? ` → ${request.endDate}` : ''}
                      <StatusChip status={request.status} />
                    </span>
                  </Link>
                </li>
              ))}
              {pendingCorrections.slice(0, 1).map((correction) => (
                <li key={correction.id}>
                  <Link to="/ess/attendance" className="ess-list-item">
                    <strong>Attendance correction</strong>
                    <span className="ess-list-meta">
                      {correction.date}
                      <StatusChip status={correction.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>

        <div className="ess-dash-col">
        <section className="ess-panel ess-pay-card">
          <div className="ess-panel-head">
            <h2>Payslip</h2>
            <Link to="/ess/salary" className="ess-dash-arrow" aria-label="Open salary">
              <ArrowRight size={16} />
            </Link>
          </div>
          {latestPayslip ? (
            <>
              <div className="ess-pay-top">
                <div
                  className={salaryHidden ? 'ess-donut is-masked' : 'ess-donut'}
                  style={{ '--pay-slice': `${deductionShare}%` } as CSSProperties}
                  role="img"
                  aria-label={
                    salaryHidden
                      ? 'Salary hidden'
                      : `Net pay ${showAmount(netPay(latestPayslip))}, deductions ${showAmount(latestDeductions)}`
                  }
                >
                  <span className="ess-donut-hole" />
                </div>
                <div className="ess-pay-month">
                  <p>{shortMonth(latestPayslip.month)}</p>
                  <strong>{paidDays}</strong>
                  <span>Paid days</span>
                </div>
              </div>
              <dl className="ess-pay-lines">
                <div>
                  <dt>
                    <i className="ess-swatch ess-swatch--gross" aria-hidden />
                    Gross
                  </dt>
                  <dd>{showAmount(latestGross)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="ess-swatch ess-swatch--deduction" aria-hidden />
                    Deductions
                  </dt>
                  <dd>{showAmount(latestDeductions)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="ess-swatch ess-swatch--net" aria-hidden />
                    Net
                  </dt>
                  <dd>{showAmount(netPay(latestPayslip))}</dd>
                </div>
              </dl>
              <div className="ess-pay-links">
                <button
                  type="button"
                  className="ess-btn ess-btn-ghost"
                  onClick={() => downloadPayslip(latestPayslip, latestGross, latestDeductions)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="ess-btn ess-btn-ghost"
                  aria-pressed={salaryHidden}
                  onClick={toggleSalaryHidden}
                >
                  {salaryHidden ? 'Show salary' : 'Hide salary'}
                </button>
              </div>
            </>
          ) : (
            <p className="ess-empty">No payslip yet.</p>
          )}
        </section>

        <section className="ess-panel">
          <div className="ess-panel-head">
            <h2>Upcoming holidays</h2>
            <Link to="/ess/leave" className="ess-dash-arrow" aria-label="Open leave calendar">
              <ArrowRight size={16} />
            </Link>
          </div>
          {upcomingHolidays.length === 0 ? (
            <p className="ess-empty">No upcoming holidays.</p>
          ) : (
            <ul className="ess-holiday-list">
              {upcomingHolidays.map((holiday) => {
                const when = holidayWhen(holiday.date);
                return (
                  <li key={holiday.date}>
                    <p className="ess-holiday-when">
                      <strong>
                        {when.day} {when.month}
                      </strong>
                      <span>{when.weekday}</span>
                    </p>
                    <p className="ess-muted">{holiday.name}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        </div>

        <div className="ess-dash-col">
        <section className="ess-panel">
          <h2>This month</h2>
          <div className="ess-track">
            <Link to="/ess/attendance" className="ess-track-item">
              <span>
                <strong>{presentDays}</strong>
                <span>Days present</span>
              </span>
              <Clock size={18} aria-hidden />
            </Link>
            <Link to="/ess/leave" className="ess-track-item">
              <span>
                <strong>{leaveAvailable}</strong>
                <span>Leave left</span>
              </span>
              <CalendarDays size={18} aria-hidden />
            </Link>
          </div>
        </section>

        <section className="ess-panel">
          <div className="ess-panel-head">
            <h2>Leave balances</h2>
            <Link to="/ess/leave" className="ess-btn ess-btn-ghost">
              View
            </Link>
          </div>
          <div className="ess-stat-row">
            {leaveBalances.map((balance) => (
              <div key={balance.code} className="ess-stat-item">
                <span>
                  {balance.type}
                  {balance.pending > 0 ? (
                    <span className="ess-muted"> · {balance.pending} pending</span>
                  ) : null}
                </span>
                <strong>{balance.available}</strong>
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>

      {roleShortcuts.length > 0 ? (
        <section>
          <h2 className="ess-home-kicker">Your work</h2>
          <div className="ess-home-tiles">
            {roleShortcuts.map((item) => (
              <ShortcutTile key={item.to} item={item} />
            ))}
          </div>
          {isManager ? (
            <p className="ess-muted ess-home-note">
              Team counts are illustrative until manager APIs are connected.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ShortcutTile({ item }: { item: Shortcut }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={item.accent ? 'ess-home-tile ess-home-tile--accent' : 'ess-home-tile'}
    >
      <span className="ess-home-tile-icon" aria-hidden>
        <Icon size={18} />
      </span>
      <span className="ess-home-tile-label">{item.label}</span>
      {item.meta ? <span className="ess-home-tile-meta">{item.meta}</span> : null}
    </Link>
  );
}
