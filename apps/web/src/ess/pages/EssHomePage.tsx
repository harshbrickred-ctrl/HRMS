import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { StatusChip } from '../components/StatusChip';
import { useEssData } from '../mock/EssDataContext';

function formatToday() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function EssHomePage() {
  const { hasRole } = useAuth();
  const {
    profile,
    leaveBalances,
    leaveRequests,
    notifications,
    unreadCount,
    pendingLeaveCount,
    markAttendance,
  } = useEssData();

  const pending = leaveRequests.filter((r) => r.status === 'Pending').slice(0, 3);
  const unread = notifications.filter((n) => !n.read).slice(0, 3);
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const primaryIsLeave = hour >= 12;

  const isManager = hasRole('MANAGER');
  const isHr = hasRole('HR_EXEC') || hasRole('HR_HEAD');
  const isAdmin = hasRole('SECURITY_ADMIN') || hasRole('IT_ADMIN');
  const isLeadership = hasRole('LEADERSHIP_READ');
  const hasResponsibilities = isHr || isAdmin || isLeadership;

  // Placeholder until manager APIs exist
  const teamInboxCount = isManager ? 3 : 0;
  const teamOnLeaveToday = isManager ? 2 : 0;

  return (
    <div className="ess-section-stack">
      <div>
        <p className="ess-greeting">
          Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'},{' '}
          {profile.firstName}
        </p>
        <p className="ess-lead">{formatToday()} · {profile.title}</p>
        <div className="ess-actions">
          {primaryIsLeave ? (
            <>
              <Link to="/ess/leave" className="ess-btn ess-btn-primary">
                Apply leave
              </Link>
              <button
                type="button"
                className="ess-btn"
                onClick={() => markAttendance(today)}
              >
                Mark attendance
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ess-btn ess-btn-primary"
                onClick={() => markAttendance(today)}
              >
                Mark attendance
              </button>
              <Link to="/ess/leave" className="ess-btn">
                Apply leave
              </Link>
            </>
          )}
          <Link to="/ess/documents" className="ess-btn">
            Upload document
          </Link>
          <Link to="/ess/notifications" className="ess-btn">
            Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Link>
          {isManager ? (
            <Link to="/manager/inbox" className="ess-btn">
              Approvals{teamInboxCount > 0 ? ` (${teamInboxCount})` : ''}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="ess-grid-3">
        <section className="ess-panel">
          <div className="ess-panel-head">
            <h2>Leave balances</h2>
            <Link to="/ess/leave" className="ess-btn ess-btn-ghost">
              View
            </Link>
          </div>
          <div className="ess-stat-row">
            {leaveBalances.map((b) => (
              <div key={b.code} className="ess-stat-item">
                <span>
                  {b.type}
                  {b.pending > 0 ? (
                    <span className="ess-muted"> · {b.pending} pending</span>
                  ) : null}
                </span>
                <strong>{b.available}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="ess-panel">
          <div className="ess-panel-head">
            <h2>Pending requests</h2>
            <span className="ess-muted">{pendingLeaveCount}</span>
          </div>
          {pending.length === 0 ? (
            <p className="ess-empty">No pending leave requests.</p>
          ) : (
            <ul className="ess-list">
              {pending.map((r) => (
                <li key={r.id}>
                  <Link to="/ess/leave" className="ess-list-item">
                    <strong>
                      {r.type} · {r.days} day{r.days === 1 ? '' : 's'}
                    </strong>
                    <span className="ess-list-meta">
                      {r.startDate}
                      {r.endDate !== r.startDate ? ` → ${r.endDate}` : ''}
                      <StatusChip status={r.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

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
              {unread.map((n) => (
                <li key={n.id}>
                  <Link to={n.href} className="ess-list-item is-unread">
                    <strong>{n.title}</strong>
                    <span className="ess-muted">{n.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isManager ? (
        <section className="ess-panel">
          <div className="ess-panel-head">
            <h2>Your team</h2>
            <Link to="/manager" className="ess-btn ess-btn-ghost">
              Overview
            </Link>
          </div>
          <div className="ess-grid-2">
            <div className="ess-stat-row">
              <div className="ess-stat-item">
                <span>Approvals waiting</span>
                <strong>{teamInboxCount}</strong>
              </div>
              <div className="ess-stat-item">
                <span>On leave today</span>
                <strong>{teamOnLeaveToday}</strong>
              </div>
            </div>
            <div className="ess-actions">
              <Link to="/manager/inbox" className="ess-btn ess-btn-primary">
                Open inbox
              </Link>
              <Link to="/manager/team-leave" className="ess-btn">
                Team leave
              </Link>
              <Link to="/manager/team-attendance" className="ess-btn">
                Team attendance
              </Link>
            </div>
          </div>
          <p className="ess-muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            Team counts are illustrative until manager APIs are connected.
          </p>
        </section>
      ) : null}

      {hasResponsibilities ? (
        <section className="ess-panel">
          <h2>Your responsibilities</h2>
          <div className="ess-actions">
            {isHr ? (
              <Link to="/hr" className="ess-btn">
                HR overview
              </Link>
            ) : null}
            {isHr ? (
              <Link to="/hr/employees" className="ess-btn">
                Employees
              </Link>
            ) : null}
            {isAdmin ? (
              <Link to="/admin" className="ess-btn">
                Admin overview
              </Link>
            ) : null}
            {isAdmin ? (
              <Link to="/admin/roles" className="ess-btn">
                Users &amp; Roles
              </Link>
            ) : null}
            {isLeadership ? (
              <Link to="/exec" className="ess-btn">
                Leadership overview
              </Link>
            ) : null}
            {isLeadership ? (
              <Link to="/exec/reports" className="ess-btn">
                Reports
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
