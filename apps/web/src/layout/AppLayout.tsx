import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppShell } from './AppShell';

/** Authenticated app chrome — single workspace, role-grouped nav. */
export function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--cool-ashes, #929191)',
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
}
