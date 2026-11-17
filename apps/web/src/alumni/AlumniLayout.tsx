import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { ThemeToggle } from '../theme/ThemeToggle';
import '../ess/ess.css';
import './alumni.css';
import { AlumniSignedOut, alumniLogout, fetchAlumniMe, hasAlumniSession, type AlumniMe } from './alumniApi';

const NAV = [
  { to: '/alumni', label: 'Home', end: true },
  { to: '/alumni/profile', label: 'Profile' },
  { to: '/alumni/directory', label: 'Directory' },
  { to: '/alumni/documents', label: 'Documents' },
  { to: '/alumni/events', label: 'News and events' },
  { to: '/alumni/jobs', label: 'Jobs' },
  { to: '/alumni/referrals', label: 'Referrals' },
  { to: '/alumni/privacy', label: 'Privacy' },
];

export type AlumniContext = {
  me: AlumniMe;
  setMe: (me: AlumniMe) => void;
  /** Turns an error into a message; a lost session goes back to sign-in instead. */
  fail: (error: unknown) => string;
  signOut: (notice?: string) => void;
};

export function useAlumni() {
  return useOutletContext<AlumniContext>();
}

export function AlumniLayout() {
  const navigate = useNavigate();
  const [me, setMe] = useState<AlumniMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = hasAlumniSession();

  const signOut = useCallback(
    (notice?: string) => {
      void alumniLogout();
      navigate('/alumni/login', { replace: true, state: notice ? { notice } : undefined });
    },
    [navigate],
  );

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof AlumniSignedOut) {
        signOut(err.message && err.message !== 'Unauthorized' ? err.message : 'Your session ended. Please sign in again.');
        return '';
      }
      return err instanceof Error ? err.message : 'Something went wrong.';
    },
    [signOut],
  );

  useEffect(() => {
    if (!signedIn) return;
    fetchAlumniMe()
      .then(setMe)
      .catch((err) => setError(fail(err)));
  }, [signedIn, fail]);

  if (!signedIn) return <Navigate to="/alumni/login" replace />;

  return (
    <div className="al-shell">
      <header className="al-top">
        <div className="al-brand">
          PeopleOS <span>Alumni</span>
        </div>
        <nav className="al-nav" aria-label="Alumni portal">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="al-user">
          <ThemeToggle />
          {me ? <span className="al-user-name">{me.fullName}</span> : null}
          <button type="button" className="ess-btn ess-btn-ghost" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="al-main">
        {error ? <p className="ess-alert">{error}</p> : null}
        {me ? <Outlet context={{ me, setMe, fail, signOut } satisfies AlumniContext} /> : !error ? <p className="ess-empty">Loading…</p> : null}
      </main>
    </div>
  );
}
