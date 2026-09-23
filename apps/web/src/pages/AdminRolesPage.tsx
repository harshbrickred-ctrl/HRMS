import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  fetchRoles,
  fetchUsers,
  updateUserRoles,
  type RoleItem,
  type UserListItem,
} from '../lib/api';
import './AdminRolesPage.css';

export function AdminRolesPage() {
  const { user: me, refreshPermissions } = useAuth();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    setMessage(null);
    setError(null);
  }

  function toggleRole(code: string) {
    setDraftRoles((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function onSave() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateUserRoles(selectedId, draftRoles);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === updated.id ? { ...u, roles: updated.roles } : u,
        ),
      );
      setDraftRoles([...updated.roles]);
      setMessage(`Updated roles for ${updated.email}`);
      if (me?.id === selectedId) {
        await refreshPermissions();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const selected = users.find((u) => u.id === selectedId) ?? null;

  return (
    <div className="admin-roles">
      <p className="admin-roles-sub">
        Assign catalog roles. Changes apply on the next permission check.
      </p>

      {loading ? <p className="admin-roles-muted">Loading…</p> : null}
      {error ? (
        <div className="admin-roles-alert" role="alert">
          {error}
        </div>
      ) : null}
      {message ? <p className="admin-roles-ok">{message}</p> : null}

      {!loading ? (
        <div className="admin-roles-grid">
          <section className="admin-roles-panel">
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
                      {u.roles.join(', ') || '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-roles-panel">
            <h2>{selected ? selected.email : 'Select a user'}</h2>
            {selected ? (
              <>
                <div className="admin-roles-checks">
                  {roles.map((role) => (
                    <label key={role.code} className="admin-roles-check">
                      <input
                        type="checkbox"
                        checked={draftRoles.includes(role.code)}
                        onChange={() => toggleRole(role.code)}
                        disabled={saving}
                      />
                      <span>
                        <strong>{role.code}</strong>
                        <em>{role.name}</em>
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="admin-roles-save"
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
