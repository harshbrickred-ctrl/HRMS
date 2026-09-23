import { Link } from 'react-router-dom';
import { useEssData } from '../mock/EssDataContext';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function EssNotificationsPage() {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useEssData();

  return (
    <div>
      <p className="ess-lead">
        In-app notification history for approvals and status changes.
      </p>

      <section className="ess-panel">
        <div className="ess-panel-head">
          <h2>
            Notifications
            {unreadCount > 0 ? (
              <span className="ess-muted"> · {unreadCount} unread</span>
            ) : null}
          </h2>
          <button
            type="button"
            className="ess-btn"
            onClick={markAllNotificationsRead}
            disabled={unreadCount === 0}
          >
            Mark all read
          </button>
        </div>

        {notifications.length === 0 ? (
          <p className="ess-empty">No notifications.</p>
        ) : (
          <ul className="ess-list">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  to={n.href}
                  className={`ess-list-item${n.read ? '' : ' is-unread'}`}
                  onClick={() => markNotificationRead(n.id)}
                >
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                  <span className="ess-list-meta">
                    {formatWhen(n.createdAt)}
                    <span>· {n.type}</span>
                    {!n.read ? <span>· unread</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
