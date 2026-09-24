import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme } from 'react-native';
import { Card, Screen } from '@/components/ui';
import { Spacing, useThemeColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { essData } from '@/mock/essData';

export default function HomeScreen() {
  const { user } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const unread = essData.notifications.filter((n) => !n.read).length;
  const pendingLeave = essData.leaveRequests.filter((r) => r.status === 'Pending').length;
  const name = `${essData.profile.firstName} ${essData.profile.lastName}`;

  return (
    <Screen title="Home">
      <Card>
        <Text style={[styles.hello, { color: colors.textSecondary }]}>Welcome back</Text>
        <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
        <Text style={{ color: colors.textSecondary }}>
          {essData.profile.title} · {essData.profile.department}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Signed in as {user?.email}
        </Text>
      </Card>

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>Quick status</Text>
        <Text style={{ color: colors.text }}>
          Leave available: {essData.leaveBalances.reduce((s, b) => s + b.available, 0)} days
        </Text>
        <Text style={{ color: colors.text }}>Pending leave requests: {pendingLeave}</Text>
        <Text style={{ color: colors.text }}>Unread notifications: {unread}</Text>
      </Card>

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>Shortcuts</Text>
        {[
          { href: '/(tabs)/leave' as const, label: 'Request leave' },
          { href: '/(tabs)/attendance' as const, label: 'View attendance' },
          { href: '/notifications' as const, label: 'Notifications' },
          { href: '/profile' as const, label: 'My profile' },
        ].map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable style={[styles.link, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.label}</Text>
            </Pressable>
          </Link>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  name: { fontSize: 24, fontWeight: '800' },
  section: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.xs },
  link: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
});
