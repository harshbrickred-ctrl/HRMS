import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme } from 'react-native';
import { Card, RowLink, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchUnreadNotificationCount } from '@/lib/notificationsApi';
import {
  ADMIN_ROLES,
  FINANCE_ROLES,
  HR_ROLES,
  IT_ROLES,
  LEADERSHIP_ROLES,
  MANAGER_ROLES,
  roleLabel,
  userHasAnyRole,
} from '@/lib/roleCatalog';
import { hrefToRoute } from '@/lib/routes';
import { useEssData } from '@/mock/EssDataContext';

const SELF = [
  { href: '/team', label: 'My Team' },
  { href: '/documents', label: 'Document Center' },
  { href: '/salary', label: 'Salary' },
  { href: '/profile', label: 'Profile' },
  { href: '/permissions', label: 'My permissions' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/settings', label: 'Settings' },
  { href: '/helpdesk', label: 'Helpdesk' },
] as const;

export default function MoreScreen() {
  const { user, logout, can } = useAuth();
  const { unreadCount: mockUnread } = useEssData();
  const [unreadCount, setUnreadCount] = useState(mockUnread);

  useEffect(() => {
    fetchUnreadNotificationCount()
      .then((result) => setUnreadCount(result.count))
      .catch(() => setUnreadCount(mockUnread));
  }, [mockUnread]);
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const roles = user?.roles;

  const isSys = userHasAnyRole(roles, ADMIN_ROLES);
  const isManager = isSys || userHasAnyRole(roles, MANAGER_ROLES);
  const isHr = isSys || userHasAnyRole(roles, HR_ROLES);
  const isAdminNav = isSys || userHasAnyRole(roles, ADMIN_ROLES);
  const canAssignRoles = can('rbac.assign');
  const isIt = isSys || userHasAnyRole(roles, IT_ROLES);
  const isFinance = isSys || userHasAnyRole(roles, FINANCE_ROLES);
  const isLeadership = isSys || userHasAnyRole(roles, LEADERSHIP_ROLES);

  const roleNames = useMemo(
    () => (roles?.length ? roles.map((code) => roleLabel(code)).join(', ') : '—'),
    [roles],
  );

  const sections: Array<{ title: string; items: Array<{ href: string; label: string }> }> = [];
  if (isManager) {
    sections.push({
      title: 'Manager',
      items: [
        { href: '/manager', label: 'Overview' },
        { href: '/manager/inbox', label: 'Inbox' },
        { href: '/manager/team-leave', label: 'Team Leave' },
        { href: '/manager/team-attendance', label: 'Team Attendance' },
        { href: '/manager/directory', label: 'Team Directory' },
      ],
    });
  }
  if (isHr) {
    sections.push({
      title: 'HR',
      items: [
        { href: '/hr', label: 'Overview' },
        { href: '/hr/employees', label: 'Employees' },
        { href: '/hr/organization', label: 'Organization' },
        { href: '/hr/leave', label: 'Leave Admin' },
        { href: '/hr/attendance', label: 'Attendance Admin' },
        { href: '/hr/documents', label: 'Documents' },
        { href: '/hr/workflows', label: 'Workflows' },
        { href: '/hr/reports', label: 'Reports' },
        { href: '/hr/migration', label: 'Migration' },
      ],
    });
  }
  if (isFinance) {
    sections.push({
      title: 'Finance',
      items: [
        { href: '/hr/documents', label: 'Payslips & documents' },
        { href: '/exec/reports', label: 'Cost reports' },
      ],
    });
  }
  if (isAdminNav) {
    sections.push({
      title: 'Admin',
      items: [
        { href: '/admin', label: 'Overview' },
        { href: '/admin/employees', label: 'Employees' },
        { href: '/admin/leave', label: 'Leave approvals' },
        ...(canAssignRoles
          ? [{ href: '/admin/roles', label: 'Users & Roles' }]
          : []),
        { href: '/admin/audit', label: 'Audit log' },
        { href: '/admin/notifications', label: 'Notifications' },
        { href: '/admin/settings', label: 'System settings' },
        { href: '/admin/jobs', label: 'Jobs' },
      ],
    });
  } else if (canAssignRoles) {
    sections.push({
      title: 'Access',
      items: [{ href: '/admin/roles', label: 'Users & Roles' }],
    });
  }
  if (isIt) {
    sections.push({
      title: 'Assets',
      items: [
        { href: '/it/assets', label: 'Asset register' },
        { href: '/it/tickets', label: 'Asset tickets' },
      ],
    });
  }
  if (isLeadership) {
    sections.push({
      title: 'Leadership',
      items: [
        { href: '/exec', label: 'Overview' },
        { href: '/exec/reports', label: 'Reports' },
      ],
    });
  }

  async function onSignOut() {
    await logout();
    router.replace('/login');
  }

  return (
    <Screen title="More">
      <Card>
        <Text style={[styles.title, { color: colors.text }]}>{user?.email}</Text>
        <Text style={{ color: colors.textSecondary }}>Roles: {roleNames}</Text>
        <Text style={{ color: colors.textSecondary }}>Unread: {unreadCount}</Text>
      </Card>

      {sections.map((section) => (
        <Card key={section.title}>
          <Text style={[styles.section, { color: colors.text }]}>{section.title}</Text>
          {section.items.map((item) => (
            <RowLink
              key={item.href}
              label={item.label}
              onPress={() => router.push(hrefToRoute(item.href))}
            />
          ))}
        </Card>
      ))}

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>Self</Text>
        {SELF.map((item) => (
          <RowLink
            key={item.href}
            label={
              item.href === '/notifications' && unreadCount > 0
                ? `${item.label} (${unreadCount})`
                : item.label
            }
            onPress={() => router.push(hrefToRoute(item.href))}
          />
        ))}
      </Card>

      <Pressable onPress={() => void onSignOut()} style={[styles.signOut, { borderColor: brand.danger }]}>
        <Text style={{ color: brand.danger, fontWeight: '700' }}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800' },
  section: { fontWeight: '800', fontSize: 15, marginBottom: 4 },
  signOut: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
