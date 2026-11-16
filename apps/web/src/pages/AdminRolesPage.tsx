import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  fetchRoles,
  fetchUsers,
  updateUserRoles,
  type RoleItem,
  type UserListItem,
} from '../lib/api';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_CATALOG,
  canAssignRole,
  permissionsForRoles,
  roleLabel,
  rolesSeniorToActor,
} from '../workspace/roleCatalog';
import { showToast } from '../ui/toast';
import './AdminRolesPage.css';

export function AdminRolesPage() {
  const { user: me, refreshPermissions } = useAuth();
  const actorRoles = me?.roles ?? [];
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roleList, userList] = await Promise.all([
        fetchRoles(),
        fetchUsers(),
      ]);
      setRoles(roleList);
      setUsers(userList);
      if (!selectedId && userList[0]) {
        setSelectedId(userList[0].id);
        setDraftRoles([...userList[0].roles]);
      } else if (selectedId) {
        const current = userList.find((u) => u.id === selectedId);
        if (current) setDraftRoles([...current.roles]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectUser(u: UserListItem) {
    setSelectedId(u.id);
    setDraftRoles([...u.roles]);
    setError(null);
  }

  function toggleRole(code: string) {
    if (!canAssignRole(actorRoles, code)) return;
    setDraftRoles((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function onSave() {
    if (!selectedId) return;
    const blocked = rolesSeniorToActor(actorRoles, draftRoles);
    if (blocked.length > 0) {
      setError(
        `You cannot assign senior roles (${blocked.join(', ')}). Assign only at your level or below.`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateUserRoles(selectedId, draftRoles);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === updated.id ? { ...u, roles: updated.roles } : u,
        ),
      );
      setDraftRoles([...updated.roles]);
      showToast(`Roles saved for ${updated.email}`);
      if (me?.id === selectedId) {
        await refreshPermissions();
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Save failed';
      setError(text);
    } finally {
      setSaving(false);
    }
  }

  const selected = users.find((u) => u.id === selectedId) ?? null;
  const granted = useMemo(() => permissionsForRoles(draftRoles), [draftRoles]);

  return (
    <div className="ess-section-stack">
      <p className="ess-lead">
        Assign roles from the HRMS catalogue (17 roles across Management, HR, Finance, IT, Admin,
        Legal, Audit, Line, and All). Permissions follow the selected roles.
      </p>

      {loading ? <p className="ess-muted">Loading…</p> : null}
      {error ? (
        <div className="ess-alert" role="alert">
          {error}
        </div>
      ) : null}
      {!loading ? (
        <div className="ess-att-split">
          <section className="ess-panel">
            <h2>Users</h2>
            <ul className="admin-roles-users">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className={
                      u.id === selectedId
                        ? 'admin-roles-user is-active'
                        : 'admin-roles-user'
                    }
                    onClick={() => selectUser(u)}
                  >
                    <span className="admin-roles-user-email">{u.email}</span>
                    <span className="admin-roles-user-roles">
                      {u.roles.map((code) => roleLabel(code)).join(', ') || '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="ess-panel">
            <h2>{selected ? selected.email : 'Select a user'}</h2>
            {selected ? (
              <>
                <div className="admin-roles-checks">
                  {[...new Set(ROLE_CATALOG.map((item) => item.dept))].map((dept) => {
                    const inDept = roles.filter((role) => {
                      const meta = ROLE_CATALOG.find((item) => item.code === role.code);
                      if ((meta?.dept ?? 'Other') !== dept) return false;
                      return (
                        canAssignRole(actorRoles, role.code) ||
                        draftRoles.includes(role.code)
                      );
                    });
                    if (inDept.length === 0) return null;
                    return (
                      <div key={dept} className="admin-roles-dept">
                        <p className="admin-roles-dept-label">{dept}</p>
                        {inDept.map((role) => {
                          const on = draftRoles.includes(role.code);
                          const allowed = canAssignRole(actorRoles, role.code);
                          return (
                            <label
                              key={role.code}
                              className={on ? 'admin-roles-check is-on' : 'admin-roles-check'}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleRole(role.code)}
                                disabled={saving || !allowed}
                              />
                              <span>
                                <strong>{role.name}</strong>
                                <em>{role.code}</em>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                <div className="admin-roles-perms">
                  <div className="admin-roles-perms-head">
                    <h3>Permissions</h3>
                    <span>{granted.size} from the selected roles</span>
                  </div>
                  {granted.size === 0 ? (
                    <p className="admin-roles-muted">Select a role, such as Employee, to see its permissions.</p>
                  ) : (
                    PERMISSION_GROUPS.map((group) => {
                      const active = group.codes.filter((code) => granted.has(code));
                      if (active.length === 0) return null;
                      return (
                        <div key={group.title} className="admin-roles-perm-group">
                          <p>{group.title}</p>
                          <div>
                            {active.map((code) => (
                              <span key={code}>{PERMISSION_LABELS[code] ?? code}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  className="ess-btn ess-btn-primary"
                  onClick={() => void onSave()}
                  disabled={saving || draftRoles.length === 0}
                >
                  {saving ? 'Saving…' : 'Save roles'}
                </button>
              </>
            ) : (
              <p className="admin-roles-muted">Choose a user to edit roles.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
