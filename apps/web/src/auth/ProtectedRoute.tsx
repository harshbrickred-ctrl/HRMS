import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { ReactNode } from 'react';

export function ProtectedRoute({
  children,
  permission,
  roles,
}: {
  children: ReactNode;
  permission?: string;
  /** Allow if user has any of these roles */
  roles?: string[];
}) {
  const { user, loading, can, hasRole } = useAuth();

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

  if (roles?.length && !roles.some((r) => hasRole(r))) {
    return <Navigate to="/ess" replace />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/ess" replace />;
  }

  return children;
}
