import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEssData } from '../mock/EssDataContext';

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
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } =
    useEssData();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
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
              onClick={markAllNotificationsRead}
              disabled={unreadCount === 0}
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
              <li key={item.id}>
                <Link
                  to={item.href}
                  className={`ess-list-item${item.read ? '' : ' is-unread'}`}
                  onClick={() => markNotificationRead(item.id)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                  <span className="ess-list-meta">
                    {formatWhen(item.createdAt)}
                    <span>· {item.type}</span>
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
