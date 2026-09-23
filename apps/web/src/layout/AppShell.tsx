import { useEffect, useMemo, useState } from 'react';
import { Bell, Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../theme/ThemeToggle';
import {
  navSectionsForUser,
  readSidebarCollapsed,
  titleForPath,
  writeSidebarCollapsed,
} from './appNav';
import { NavIcon } from './navIcons';
import { UserMenu } from './UserMenu';
import './AppShell.css';

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readSidebarCollapsed());

  const sections = useMemo(
    () => navSectionsForUser(user?.roles),
    [user?.roles],
  );
  const pageTitle = titleForPath(location.pathname, sections);

  useEffect(() => {
    writeSidebarCollapsed(collapsed);
  }, [collapsed]);

  function toggleCollapsed() {
    setCollapsed((v) => !v);
  }

  const shellClass = [
    'app-shell',
    navOpen ? 'is-nav-open' : '',
    collapsed ? 'is-side-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass}>
      <header className="app-shell-top" role="banner">
        <div className="app-shell-top-left">
          <button
            type="button"
            className="app-shell-icon-hit app-shell-menu-mobile"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <Menu size={18} aria-hidden />
          </button>
          <Link to="/ess" className="app-shell-brand">
            PeopleOS
          </Link>
        </div>

        <div className="app-shell-top-right">
          <button
            type="button"
            className="app-shell-icon-hit is-disabled"
            disabled
            title="Search coming next"
            aria-label="Search (coming next)"
          >
            <Search size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="app-shell-icon-hit is-disabled"
            disabled
            title="Alerts coming next"
            aria-label="Alerts (coming next)"
          >
            <Bell size={18} aria-hidden />
          </button>
          <ThemeToggle />
          <UserMenu
            email={user?.email ?? ''}
            roles={user?.roles ?? []}
            onSignOut={() => void logout()}
          />
        </div>
      </header>

      <div className="app-shell-body">
        {navOpen ? (
          <button
            type="button"
            className="app-shell-backdrop"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <aside className="app-shell-side" aria-label="Main navigation">
          <div className="app-shell-side-scroll">
            {sections.map((section) => (
              <div key={section.id} className="app-shell-section">
                <p className="app-shell-side-title">{section.label}</p>
                <nav className="app-shell-side-nav">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={item.label}
                      aria-label={item.label}
                      className={({ isActive }) =>
                        isActive
                          ? 'app-shell-nav-link is-active'
                          : 'app-shell-nav-link'
                      }
                      onClick={() => setNavOpen(false)}
                    >
                      <NavIcon id={item.icon} className="app-shell-nav-icon" />
                      <span className="app-shell-nav-label">{item.label}</span>
                    </NavLink>
                  ))}
                </nav>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="app-shell-side-collapse"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden />
            ) : (
              <PanelLeftClose size={18} aria-hidden />
            )}
            <span className="app-shell-nav-label">
              {collapsed ? 'Expand' : 'Collapse'}
            </span>
          </button>
        </aside>

        <main className="app-shell-main" role="main">
          <div className="app-shell-main-inner">
            <header className="app-shell-pagehead">
              <h1>{pageTitle}</h1>
            </header>
            <div className="app-shell-content">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
