import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from '../../workspace/notificationsApi';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function EssNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchNotifications()
      .then((rows) => {
        setNotifications(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load notifications.'));
  }

  useEffect(() => {
    load();
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;
  const visible =
    filter === 'unread' ? notifications.filter((item) => !item.read) : notifications;

  return (
    <div className="ess-section-stack">
      <div className="ess-insights">
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Unread</p>
          <p className="ess-insight-value">{unreadCount}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">All</p>
          <p className="ess-insight-value">{notifications.length}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Read</p>
          <p className="ess-insight-value">{notifications.length - unreadCount}</p>
        </article>
      </div>
      {error ? <p className="ess-alert">{error}</p> : null}

      <section className="ess-panel">
        <div className="ess-att-toolbar">
          <h2>Inbox</h2>
          <div className="ess-actions">
            <div className="ess-tabs" role="tablist" aria-label="Notification filter">
              <button
                type="button"
                role="tab"
                aria-selected={filter === 'all'}
                className={filter === 'all' ? 'ess-tab is-active' : 'ess-tab'}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === 'unread'}
                className={filter === 'unread' ? 'ess-tab is-active' : 'ess-tab'}
                onClick={() => setFilter('unread')}
              >
                Unread
              </button>
            </div>
            <button
              type="button"
              className="ess-btn"
              disabled={unreadCount === 0}
              onClick={() => {
                void markAllNotificationsRead().then(load);
              }}
            >
              Mark all read
            </button>
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="ess-empty">No notifications.</p>
        ) : (
          <ul className="ess-list">
            {visible.map((item) => (
              <li key={item.id} className="ess-list-item">
                <div className="ess-leave-request-head">
                  <strong>{item.title}</strong>
                  <span className="ess-muted">{formatWhen(item.createdAt)}</span>
                </div>
                <span className="ess-muted">{item.body}</span>
                <div className="ess-actions">
                  {item.href ? (
                    <Link to={item.href} className="ess-btn ess-btn-ghost">
                      Open
                    </Link>
                  ) : null}
                  {!item.read ? (
                    <button
                      type="button"
                      className="ess-btn"
                      onClick={() => {
                        void markNotificationRead(item.id).then(load);
                      }}
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
