import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { StatusChip } from '../ess/components/StatusChip';
import {
  REQUEST_STATUS_LABELS,
  fetchAssetRequests,
  fetchMyAssetApprovals,
  requestChip,
  timeAgo,
  type AssetRequest,
} from '../workspace/assetsApi';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from '../workspace/notificationsApi';
import '../ess/ess.css';
import './NotificationBell.css';

const POLL_MS = 60_000;
const SHOWN = 20;
/** Asset request notifications name the request, e.g. "Asset request AR-000004 to approve". */
const REQUEST_REFERENCE = /\bAR-\d{6}\b/;

function referenceOf(item: NotificationDto) {
  if (item.kind !== 'asset') return null;
  return (REQUEST_REFERENCE.exec(item.title) ?? REQUEST_REFERENCE.exec(item.body))?.[0] ?? null;
}

/** The approver notification the asset module sends on submit (and on the manager → head step). */
function asksForApproval(item: NotificationDto) {
  return item.kind === 'asset' && / to approve$/.test(item.title);
}

function requestDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Lookup = { byReference: Map<string, AssetRequest>; waitingOnMe: Set<string> };

const EMPTY_LOOKUP: Lookup = { byReference: new Map(), waitingOnMe: new Set() };

/**
 * Request details come only from endpoints the server already scopes to the logged-in user:
 * the requests waiting on them as approver, and (for asset-desk users) the asset desk queue.
 */
async function loadLookup(isAssetDesk: boolean): Promise<Lookup> {
  const none: AssetRequest[] = [];
  const [mine, desk] = await Promise.all([
    fetchMyAssetApprovals().catch(() => none),
    isAssetDesk ? fetchAssetRequests().catch(() => none) : Promise.resolve(none),
  ]);
  const byReference = new Map<string, AssetRequest>();
  for (const row of [...desk, ...mine]) byReference.set(row.reference, row);
  return { byReference, waitingOnMe: new Set(mine.map((row) => row.reference)) };
}

/** Old IT notifications link to the queue; open the exact request when we know it. */
function targetFor(item: NotificationDto, request: AssetRequest | undefined) {
  if (request && item.href === '/it/requests') return `/it/requests?request=${request.id}`;
  return item.href || '/ess/notifications';
}

export function NotificationBell() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const isAssetDesk = can('assets.manage');
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationDto[] | null>(null);
  const [lookup, setLookup] = useState<Lookup>(EMPTY_LOOKUP);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const refreshCount = useCallback(() => {
    fetchUnreadNotificationCount()
      .then((result) => setUnread(result.count))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      const [rows, count] = await Promise.all([fetchNotifications(), fetchUnreadNotificationCount()]);
      const nextLookup = rows.some((row) => referenceOf(row)) ? await loadLookup(isAssetDesk) : EMPTY_LOOKUP;
      setItems(rows);
      setUnread(count.count);
      setLookup(nextLookup);
      setError(null);
    } catch {
      setError('Could not load notifications.');
    }
  }, [isAssetDesk]);

  useEffect(() => {
    if (!user) return;
    refreshCount();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshCount();
    }, POLL_MS);
    window.addEventListener('focus', refreshCount);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshCount);
    };
  }, [user, refreshCount]);

  useEffect(() => {
    if (!open) return;
    void load();

    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, load]);

  function openItem(item: NotificationDto, request: AssetRequest | undefined) {
    setOpen(false);
    if (!item.read) {
      setItems((rows) => rows?.map((row) => (row.id === item.id ? { ...row, read: true } : row)) ?? rows);
      setUnread((count) => Math.max(0, count - 1));
      void markNotificationRead(item.id).catch(refreshCount);
    }
    navigate(targetFor(item, request));
  }

  function markAll() {
    setItems((rows) => rows?.map((row) => ({ ...row, read: true })) ?? rows);
    setUnread(0);
    void markAllNotificationsRead().catch(refreshCount);
  }

  const shown = items?.slice(0, SHOWN) ?? [];

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="app-shell-icon-hit notif-bell-trigger"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} aria-hidden />
        {unread > 0 ? (
          <span className="notif-bell-badge" aria-hidden>
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div id={panelId} className="notif-bell-panel" role="dialog" aria-label="Notifications">
          <div className="notif-bell-head">
            <p className="notif-bell-heading">
              Notifications <span className="notif-bell-count">({unread} unread)</span>
            </p>
            <button type="button" className="notif-bell-text-btn" disabled={unread === 0} onClick={markAll}>
              Mark all read
            </button>
          </div>

          <div className="notif-bell-scroll">
            {error ? <p className="notif-bell-empty">{error}</p> : null}
            {items === null && !error ? <p className="notif-bell-empty">Loading…</p> : null}
            {items !== null && items.length === 0 ? <p className="notif-bell-empty">No notifications yet.</p> : null}
            {shown.length ? (
              <ul className="notif-bell-list">
                {shown.map((item) => {
                  const reference = referenceOf(item);
                  const request = reference ? lookup.byReference.get(reference) : undefined;
                  return (
                    <li key={item.id}>
                      <NotificationRow
                        item={item}
                        request={request}
                        waitingOnMe={!!reference && lookup.waitingOnMe.has(reference)}
                        onOpen={() => openItem(item, request)}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <Link to="/ess/notifications" className="notif-bell-foot" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({
  item,
  request,
  waitingOnMe,
  onOpen,
}: {
  item: NotificationDto;
  request: AssetRequest | undefined;
  waitingOnMe: boolean;
  onOpen: () => void;
}) {
  let status: { chip: string; label: string } | null = null;
  if (request && waitingOnMe) status = { chip: 'pending', label: 'Waiting for your approval' };
  else if (request) status = { chip: requestChip(request.status), label: REQUEST_STATUS_LABELS[request.status] };
  else if (asksForApproval(item)) status = { chip: 'withdrawn', label: 'No longer waiting on you' };

  return (
    <button
      type="button"
      className={item.read ? 'notif-bell-item' : 'notif-bell-item is-unread'}
      onClick={onOpen}
    >
      <span className="notif-bell-dot" aria-hidden />
      <span className="notif-bell-item-main">
        <span className="notif-bell-item-top">
          <span className="notif-bell-item-title">{item.title}</span>
          <span className="notif-bell-item-time">{timeAgo(item.createdAt)}</span>
        </span>
        {request ? (
          <span className="notif-bell-facts">
            <span className="notif-bell-fact-label">Employee</span>
            <span>
              {request.employee.name} · {request.employee.employeeCode}
            </span>
            <span className="notif-bell-fact-label">Asset</span>
            <span>{request.category.name}</span>
            <span className="notif-bell-fact-label">Requested</span>
            <span>{requestDate(request.createdAt)}</span>
          </span>
        ) : null}
        {item.body ? <span className="notif-bell-item-body">{item.body}</span> : null}
        <span className="notif-bell-item-foot">
          {status ? <StatusChip status={status.chip} label={status.label} /> : null}
          <span className="notif-bell-read">{item.read ? 'Read' : 'Unread'}</span>
        </span>
      </span>
    </button>
  );
}
