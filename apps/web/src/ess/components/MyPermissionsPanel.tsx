import { useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSION_GROUPS, PERMISSION_LABELS, roleLabel } from '../../workspace/roleCatalog';

export function MyPermissionsPanel() {
  const { user, permissions } = useAuth();
  const granted = useMemo(() => new Set(permissions), [permissions]);
  const known = useMemo(
    () => new Set(PERMISSION_GROUPS.flatMap((group) => group.codes)),
    [],
  );
  const extra = permissions.filter((code) => !known.has(code));
  const roles = user?.roles ?? [];

  return (
    <div className="ess-my-access">
      <p className="ess-lead">
        Signed in as {user?.email ?? 'this account'}. These are the roles and permissions on your
        login. They come from your roles and cannot be changed here.
      </p>

      <section className="ess-panel">
        <div className="ess-my-access-head">
          <h2>Your roles</h2>
          <span>{roles.length}</span>
        </div>
        {roles.length === 0 ? (
          <p className="ess-muted">No role is assigned to this login.</p>
        ) : (
          <ul className="ess-my-access-roles">
            {roles.map((code) => (
              <li key={code}>
                <strong>{roleLabel(code)}</strong>
                <em>{code}</em>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ess-panel">
        <div className="ess-my-access-head">
          <h2>Your permissions</h2>
          <span>{granted.size}</span>
        </div>
        {granted.size === 0 ? (
          <p className="ess-muted">This login has no permissions yet.</p>
        ) : (
          <div className="ess-my-access-groups">
            {PERMISSION_GROUPS.map((group) => {
              const active = group.codes.filter((code) => granted.has(code));
              if (active.length === 0) return null;
              return (
                <div key={group.title} className="ess-my-access-group">
                  <p>{group.title}</p>
                  <div>
                    {active.map((code) => (
                      <span key={code}>{PERMISSION_LABELS[code] ?? code}</span>
                    ))}
                  </div>
                </div>
              );
            })}
            {extra.length > 0 ? (
              <div className="ess-my-access-group">
                <p>Other</p>
                <div>
                  {extra.map((code) => (
                    <span key={code}>{PERMISSION_LABELS[code] ?? code}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
