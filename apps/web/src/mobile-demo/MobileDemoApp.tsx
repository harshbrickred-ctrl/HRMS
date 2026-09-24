import { useMemo, useState, type ReactNode } from 'react';
import { createInitialEssState } from '../ess/mock/essMock';
import './mobile-demo.css';

type TabId = 'home' | 'leave' | 'attendance' | 'people' | 'more';
type StackId = 'profile' | 'documents' | 'notifications' | null;
type DemoRoute = { area: 'login' } | { area: 'app'; tab: TabId; stack: StackId };

const TABS: { id: TabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'leave', label: 'Leave' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'people', label: 'People' },
  { id: 'more', label: 'More' },
];

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes('approv') || s === 'present') return 'md-chip md-chip--ok';
  if (s.includes('reject') || s === 'absent') return 'md-chip md-chip--danger';
  if (s.includes('pending')) return 'md-chip md-chip--pending';
  if (s === 'leave') return 'md-chip md-chip--leave';
  if (s === 'holiday') return 'md-chip md-chip--holiday';
  return 'md-chip';
}

function Screen({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="md-screen">
      <header className="md-header">
        {onBack ? (
          <button type="button" className="md-back" onClick={onBack}>
            Back
          </button>
        ) : (
          <span className="md-back-spacer" />
        )}
        <h2 className="md-title">{title}</h2>
        <span className="md-back-spacer" />
      </header>
      <div className="md-body">{children}</div>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="md-panel">
      {title ? (
        <div className="md-panel-head">
          <h3>{title}</h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function MobileDemoApp({ resetKey = 0 }: { resetKey?: number }) {
  const data = useMemo(() => createInitialEssState(), [resetKey]);
  const [route, setRoute] = useState<DemoRoute>({ area: 'login' });
  const [peopleQuery, setPeopleQuery] = useState('');

  function goTab(tab: TabId) {
    setRoute({ area: 'app', tab, stack: null });
  }

  function goStack(stack: Exclude<StackId, null>) {
    if (route.area !== 'app') return;
    setRoute({ ...route, stack });
  }

  function signInDemo() {
    setRoute({ area: 'app', tab: 'home', stack: null });
  }

  function signOutDemo() {
    setRoute({ area: 'login' });
    setPeopleQuery('');
  }

  if (route.area === 'login') {
    return (
      <div className="md-app">
        <div className="md-login">
          <p className="md-brand">PeopleOS</p>
          <h1 className="md-login-headline">
            Workday rhythm,
            <span> one calm place.</span>
          </h1>
          <p className="md-login-lede">
            Preview the employee app — leave, attendance, people, and more.
          </p>
          <div className="md-login-panel">
            <header>
              <h2>Sign in</h2>
              <p>Demo mode — no password required.</p>
            </header>
            <label className="md-field">
              <span>Email</span>
              <input value="employee@peopleos.local" readOnly />
            </label>
            <label className="md-field">
              <span>Password</span>
              <input type="password" value="••••••••••" readOnly />
            </label>
            <button type="button" className="md-btn md-btn-primary" onClick={signInDemo}>
              Continue preview
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { tab, stack } = route;
  const unread = data.notifications.filter((n) => !n.read).length;
  const people = data.people.filter((p) => {
    const q = peopleQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q) ||
      p.employeeCode.toLowerCase().includes(q)
    );
  });

  let stackView: ReactNode = null;
  if (stack === 'profile') {
    const p = data.profile;
    stackView = (
      <Screen title="Profile" onBack={() => setRoute({ ...route, stack: null })}>
        <Panel>
          <p className="md-greeting">
            {p.firstName} {p.lastName}
          </p>
          <p className="md-muted">
            {p.title} · {p.department}
          </p>
        </Panel>
        <Panel title="Details">
          <dl className="md-meta-list">
            <div>
              <dt>Employee code</dt>
              <dd>{p.employeeCode}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{p.location}</dd>
            </div>
            <div>
              <dt>Join date</dt>
              <dd>{p.joinDate}</dd>
            </div>
            <div>
              <dt>Manager</dt>
              <dd>{p.managerName}</dd>
            </div>
            <div>
              <dt>Work email</dt>
              <dd>{p.workEmail}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>{p.contacts.mobile}</dd>
            </div>
          </dl>
        </Panel>
      </Screen>
    );
  } else if (stack === 'documents') {
    stackView = (
      <Screen title="Documents" onBack={() => setRoute({ ...route, stack: null })}>
        {data.documents.map((doc) => (
          <Panel key={doc.id}>
            <div className="md-row-between">
              <strong>{doc.name}</strong>
              <span className="md-muted">{doc.owner === 'mine' ? 'Mine' : 'Company'}</span>
            </div>
            <p className="md-muted">
              {doc.category} · {doc.sizeLabel} · {doc.uploadedAt}
            </p>
          </Panel>
        ))}
      </Screen>
    );
  } else if (stack === 'notifications') {
    stackView = (
      <Screen
        title="Notifications"
        onBack={() => setRoute({ ...route, stack: null })}
      >
        {data.notifications.map((n) => (
          <Panel key={n.id}>
            <div className="md-row-between">
              <strong>{n.title}</strong>
              {!n.read ? <span className="md-chip md-chip--ok">New</span> : null}
            </div>
            <p>{n.body}</p>
            <p className="md-muted">
              {new Date(n.createdAt).toLocaleString()} · {n.type}
            </p>
          </Panel>
        ))}
      </Screen>
    );
  }

  let tabView: ReactNode = null;
  if (tab === 'home') {
    tabView = (
      <Screen title="Home">
        <Panel>
          <p className="md-eyebrow">Welcome back</p>
          <p className="md-greeting">
            {data.profile.firstName} {data.profile.lastName}
          </p>
          <p className="md-muted">
            {data.profile.title} · {data.profile.department}
          </p>
        </Panel>
        <Panel title="Quick status">
          <ul className="md-stat-list">
            <li>
              Leave available:{' '}
              <strong>
                {data.leaveBalances.reduce((s, b) => s + b.available, 0)} days
              </strong>
            </li>
            <li>
              Pending leave:{' '}
              <strong>
                {data.leaveRequests.filter((r) => r.status === 'Pending').length}
              </strong>
            </li>
            <li>
              Unread notifications: <strong>{unread}</strong>
            </li>
          </ul>
        </Panel>
        <Panel title="Shortcuts">
          <div className="md-actions">
            <button type="button" className="md-btn md-btn-primary" onClick={() => goTab('leave')}>
              Apply leave
            </button>
            <button type="button" className="md-btn" onClick={() => goTab('attendance')}>
              Attendance
            </button>
            <button type="button" className="md-btn" onClick={() => goStack('notifications')}>
              Notifications{unread ? ` (${unread})` : ''}
            </button>
            <button type="button" className="md-btn" onClick={() => goStack('profile')}>
              Profile
            </button>
          </div>
        </Panel>
      </Screen>
    );
  } else if (tab === 'leave') {
    tabView = (
      <Screen title="Leave">
        <Panel title="Balances">
          <div className="md-balance-grid">
            {data.leaveBalances.map((b) => (
              <div key={b.code} className="md-balance-card">
                <strong>
                  {b.code}
                </strong>
                <span className="md-muted">{b.type}</span>
                <p className="md-balance-avail">{b.available}</p>
                <span className="md-muted">available</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Requests">
          {data.leaveRequests.map((r) => (
            <div key={r.id} className="md-list-item">
              <div className="md-row-between">
                <strong>{r.type}</strong>
                <span className={statusClass(r.status)}>{r.status}</span>
              </div>
              <p className="md-muted">
                {r.startDate}
                {r.endDate !== r.startDate ? ` → ${r.endDate}` : ''} · {r.days}{' '}
                day(s)
              </p>
              <p>{r.reason}</p>
            </div>
          ))}
        </Panel>
      </Screen>
    );
  } else if (tab === 'attendance') {
    const recent = data.attendance.slice(-8).reverse();
    tabView = (
      <Screen title="Attendance">
        <Panel title="Recent days">
          {recent.map((day) => (
            <div key={day.date} className="md-list-item">
              <div className="md-row-between">
                <strong>{day.date}</strong>
                <span className={statusClass(day.status)}>{day.status}</span>
              </div>
              {day.checkIn || day.checkOut ? (
                <p className="md-muted">
                  {day.checkIn ?? '—'} → {day.checkOut ?? '—'}
                </p>
              ) : null}
              {day.note ? <p>{day.note}</p> : null}
            </div>
          ))}
        </Panel>
      </Screen>
    );
  } else if (tab === 'people') {
    tabView = (
      <Screen title="People">
        <input
          className="md-search"
          placeholder="Search name, dept, code…"
          value={peopleQuery}
          onChange={(e) => setPeopleQuery(e.target.value)}
        />
        {people.map((p) => (
          <Panel key={p.id}>
            <div className="md-row-between">
              <strong>{p.name}</strong>
              {p.isSelf ? <span className="md-muted">You</span> : null}
            </div>
            <p className="md-muted">
              {p.title} · {p.department}
            </p>
            <p className="md-muted">
              {p.employeeCode} · {p.location}
            </p>
            <p>{p.workEmail}</p>
          </Panel>
        ))}
      </Screen>
    );
  } else {
    tabView = (
      <Screen title="More">
        <Panel>
          <p className="md-greeting">{data.profile.workEmail}</p>
          <p className="md-muted">
            {data.profile.title} · {data.profile.department}
          </p>
        </Panel>
        <Panel>
          <button type="button" className="md-link-row" onClick={() => goStack('profile')}>
            Profile
          </button>
          <button type="button" className="md-link-row" onClick={() => goStack('documents')}>
            Documents
          </button>
          <button
            type="button"
            className="md-link-row"
            onClick={() => goStack('notifications')}
          >
            Notifications{unread ? ` (${unread})` : ''}
          </button>
        </Panel>
        <button type="button" className="md-btn md-btn-danger" onClick={signOutDemo}>
          Sign out of preview
        </button>
      </Screen>
    );
  }

  return (
    <div className="md-app">
      <div className="md-main">{stackView ?? tabView}</div>
      {!stack ? (
        <nav className="md-tabs" aria-label="Mobile demo tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'is-active' : undefined}
              onClick={() => goTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
