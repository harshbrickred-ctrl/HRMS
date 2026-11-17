import { useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, Text, useColorScheme, View } from 'react-native';
import { Redirect } from 'expo-router';
import {
  Card,
  EmptyNote,
  Field,
  GhostButton,
  Insights,
  PrimaryButton,
  Screen,
  StatusChip,
} from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { LeaveApprovalsPanel } from '@/components/LeaveApprovalsPanel';
import { HrEmployees, LiveExec, LiveHr, LiveManager } from '@/screens/liveWorkspace';
import {
  fetchRoles,
  fetchUsers,
  updateUserRoles,
  type RoleItem,
  type UserListItem,
} from '@/lib/api';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_CATALOG,
  canAssignRole,
  permissionsForRoles,
  rolesSeniorToActor,
} from '@/lib/roleCatalog';
import { auditLog, jobs, mailHealth, useWorkspace } from '@/mock/workspace';

function Denied({ title }: { title: string }) {
  return (
    <Screen title={title} back>
      <Card>
        <EmptyNote text="Your role does not include this workspace." />
      </Card>
    </Screen>
  );
}

export function ManagerScreen({ page }: { page: string }) {
  return <LiveManager page={page} />;
}

export function HrScreen({ page }: { page: string }) {
  return <LiveHr page={page} />;
}

export function AdminScreen({ page }: { page: string }) {
  const { user, hasRole, can, refreshPermissions } = useAuth();
  const workspace = useWorkspace();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [query, setQuery] = useState('');

  if (!user) return <Redirect href="/login" />;
  if (
    !hasRole('SYS') &&
    !hasRole('SECURITY_ADMIN') &&
    !hasRole('ITA') &&
    !hasRole('IT_ADMIN') &&
    !hasRole('ADM')
  ) {
    return <Denied title="Admin" />;
  }

  if (page === 'employees') return <HrEmployees />;

  if (page === 'leave') {
    return (
      <Screen title="Leave approvals" back>
        <LeaveApprovalsPanel />
      </Screen>
    );
  }

  if (page === 'roles') {
    if (!can('rbac.assign')) {
      return (
        <Screen title="Users & Roles" back>
          <EmptyNote text="You need the rbac.assign permission to edit roles." />
        </Screen>
      );
    }
    return <RolesEditor meId={user?.id} onRefresh={refreshPermissions} />;
  }

  if (page === 'audit') {
    const rows = auditLog.filter((item) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return `${item.actor} ${item.action}`.toLowerCase().includes(q);
    });
    return (
      <Screen title="Audit log" back>
        <Field label="Filter" value={query} onChangeText={setQuery} placeholder="Actor or action" />
        {rows.map((item) => (
          <Card key={item.id}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.action}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {item.actor} · {item.at}
            </Text>
          </Card>
        ))}
      </Screen>
    );
  }

  if (page === 'notifications') {
    const issues = mailHealth.filter((item) => item.status !== 'Delivered').length;
    return (
      <Screen title="Notifications" back>
        <Insights
          items={[
            ['Messages', mailHealth.length],
            ['Delivered', mailHealth.length - issues],
            ['Need attention', issues],
          ]}
        />
        {mailHealth.map((item) => (
          <Card key={item.id}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.subject}</Text>
            <StatusChip status={item.status} />
            <Text style={{ color: colors.textSecondary }}>{item.to}</Text>
          </Card>
        ))}
      </Screen>
    );
  }

  if (page === 'settings') {
    const rows: Array<{ key: 'smtp' | 'retention' | 'reminders'; label: string; detail: string }> = [
      { key: 'smtp', label: 'SMTP', detail: 'Send mail through the configured provider' },
      { key: 'retention', label: 'Retention labels', detail: 'Keep audit rows for the default window' },
      { key: 'reminders', label: 'Reminder flag', detail: 'Queue the morning reminder job' },
    ];
    return (
      <Screen title="System settings" back>
        {rows.map((row) => (
          <Card key={row.key}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{row.label}</Text>
            <Text style={{ color: colors.textSecondary }}>{row.detail}</Text>
            <GhostButton
              label={workspace.settings[row.key] ? 'On' : 'Off'}
              onPress={() => workspace.toggleSetting(row.key)}
            />
          </Card>
        ))}
      </Screen>
    );
  }

  if (page === 'jobs') {
    return (
      <Screen title="Jobs" back>
        <Insights
          items={[
            ['Jobs', jobs.length],
            ['Healthy', jobs.filter((job) => job.status === 'Ok').length],
            ['Retrying', jobs.filter((job) => job.status === 'Retrying').length],
          ]}
        />
        {jobs.map((job) => (
          <Card key={job.name}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{job.name}</Text>
            <StatusChip status={job.status} />
            <Text style={{ color: colors.textSecondary }}>Last run {job.lastRun}</Text>
          </Card>
        ))}
      </Screen>
    );
  }

  const flags =
    Number(workspace.settings.smtp) +
    Number(workspace.settings.retention) +
    Number(workspace.settings.reminders);
  return (
    <Screen title="Admin" back>
      <Insights
        items={[
          ['Audit events', auditLog.length],
          ['Mail issues', mailHealth.filter((item) => item.status !== 'Delivered').length],
          ['Flags on', flags],
        ]}
      />
      <Card>
        <Text style={{ color: colors.text }}>
          Jobs · {jobs.filter((job) => job.status !== 'Ok').length} need a retry
        </Text>
        <Text style={{ color: colors.textSecondary }}>Role changes stay on Users & Roles</Text>
      </Card>
    </Screen>
  );
}

function RolesEditor({
  meId,
  onRefresh,
}: {
  meId?: string;
  onRefresh: () => Promise<void>;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const { user } = useAuth();
  const actorRoles = user?.roles ?? [];
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [query, setQuery] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [roleList, userList] = await Promise.all([fetchRoles(), fetchUsers()]);
        if (cancelled) return;
        setRoles(roleList);
        setUsers(userList);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = users.find((item) => item.id === selectedId) ?? null;
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return [];
    return users.filter((item) => item.email.toLowerCase().includes(needle)).slice(0, 8);
  }, [needle, users]);
  const granted = useMemo(() => permissionsForRoles(draftRoles), [draftRoles]);
  const dirty =
    selected != null &&
    [...draftRoles].sort().join('|') !== [...selected.roles].sort().join('|');

  function chooseUser(item: UserListItem) {
    setSelectedId(item.id);
    setDraftRoles([...item.roles]);
    setQuery(item.email);
    setSuggestOpen(false);
    setMessage(null);
    setError(null);
  }

  function toggleRole(code: string) {
    if (!canAssignRole(actorRoles, code)) return;
    setDraftRoles((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
    setMessage(null);
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
    setMessage(null);
    try {
      const updated = await updateUserRoles(selectedId, draftRoles);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? { ...item, roles: updated.roles } : item)));
      setDraftRoles([...updated.roles]);
      setMessage(`Saved for ${updated.email}`);
      showToast(`Roles saved for ${updated.email}`);
      if (meId === selectedId) await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title="Users & Roles" back>
      <Card>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Find a person</Text>
        <Text style={{ color: colors.textSecondary }}>
          Search by email. The full directory stays hidden until you look someone up.
        </Text>
        <Field
          label="Email"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setSuggestOpen(true);
          }}
          onFocus={() => setSuggestOpen(true)}
          placeholder="Start typing an email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {loading ? <EmptyNote text="Loading directory…" /> : null}
        {suggestOpen && needle.length > 0 ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.cardElevated,
              overflow: 'hidden',
            }}
          >
            {matches.length === 0 ? (
              <Text style={{ color: colors.textSecondary, padding: 14 }}>No matching email</Text>
            ) : (
              matches.map((item, index) => {
                const email = item.email;
                const start = email.toLowerCase().indexOf(needle);
                const before = start >= 0 ? email.slice(0, start) : email;
                const hit = start >= 0 ? email.slice(start, start + needle.length) : '';
                const after = start >= 0 ? email.slice(start + needle.length) : '';
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => chooseUser(item)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      gap: 2,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>
                      {before}
                      <Text style={{ fontWeight: '800' }}>{hit}</Text>
                      {after}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {item.roles.join(' · ') || 'No roles'} · Tap to select
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}
      </Card>

      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      {message ? <Text style={{ color: brand.success, fontWeight: '700' }}>{message}</Text> : null}

      {!selected ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>No user selected</Text>
          <Text style={{ color: colors.textSecondary }}>
            Choose one email from search. Roles and permissions open underneath.
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>SELECTED</Text>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>{selected.email}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <StatusChip status={selected.status} />
              <Text style={{ color: colors.textSecondary }}>
                {draftRoles.length} role{draftRoles.length === 1 ? '' : 's'}
              </Text>
            </View>
            <GhostButton
              label="Clear selection"
              onPress={() => {
                setSelectedId(null);
                setDraftRoles([]);
                setMessage(null);
              }}
            />
          </Card>

          <Card>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Roles</Text>
            <Text style={{ color: colors.textSecondary }}>Turn on the access this person should have.</Text>
            {[...new Set(ROLE_CATALOG.map((item) => item.dept))].map((dept) => {
              const inDept = roles.filter((role) => {
                const meta = ROLE_CATALOG.find((item) => item.code === role.code);
                if ((meta?.dept ?? 'Other') !== dept) return false;
                return canAssignRole(actorRoles, role.code) || draftRoles.includes(role.code);
              });
              if (inDept.length === 0) return null;
              return (
                <View key={dept} style={{ gap: 8 }}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontWeight: '700',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {dept}
                  </Text>
                  {inDept.map((role) => {
                    const on = draftRoles.includes(role.code);
                    const allowed = canAssignRole(actorRoles, role.code);
                    return (
                      <Pressable
                        key={role.code}
                        onPress={() => toggleRole(role.code)}
                        disabled={!allowed}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: on ? brand.primaryInk : colors.border,
                          backgroundColor: on ? brand.primary : colors.cardElevated,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          opacity: allowed ? 1 : 0.55,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ color: on ? brand.primaryInk : colors.text, fontWeight: '800' }}>
                            {role.name}
                          </Text>
                          <Text style={{ color: on ? brand.primaryInk : colors.textSecondary }}>
                            {role.code}
                          </Text>
                        </View>
                        <Switch
                          pointerEvents="none"
                          value={on}
                          disabled={!allowed}
                          trackColor={{ true: brand.primaryInk, false: colors.border }}
                          thumbColor={on ? brand.primary : colors.card}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </Card>

          <Card>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Permissions</Text>
            <Text style={{ color: colors.textSecondary }}>
              These switch on from the roles above. {granted.size} selected.
            </Text>
            {PERMISSION_GROUPS.map((group) => {
              const active = group.codes.filter((code) => granted.has(code));
              if (active.length === 0) return null;
              return (
                <View key={group.title} style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{group.title}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {active.map((code) => (
                      <View
                        key={code}
                        style={{
                          borderRadius: 999,
                          backgroundColor: brand.primary,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                        }}
                      >
                        <Text style={{ color: brand.primaryInk, fontWeight: '700', fontSize: 13 }}>
                          {PERMISSION_LABELS[code] ?? code}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
            {granted.size === 0 ? <EmptyNote text="Select at least one role to grant permissions." /> : null}
          </Card>

          <PrimaryButton
            label={saving ? 'Saving…' : dirty ? 'Save roles' : 'Roles are saved'}
            disabled={saving || !dirty || draftRoles.length === 0}
            onPress={() => void onSave()}
          />
        </>
      )}
    </Screen>
  );
}

export function ExecScreen({ page }: { page: string }) {
  return <LiveExec page={page} />;
}
