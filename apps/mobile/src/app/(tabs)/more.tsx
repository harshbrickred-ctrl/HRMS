import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme } from 'react-native';
import { Card, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { API_BASE } from '@/lib/api';

const links = [
  { href: '/profile', label: 'Profile' },
  { href: '/documents', label: 'Documents' },
  { href: '/notifications', label: 'Notifications' },
] as const;

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);

  async function onSignOut() {
    await logout();
    router.replace('/login');
  }

  return (
    <Screen title="More">
      <Card>
        <Text style={[styles.title, { color: colors.text }]}>{user?.email}</Text>
        <Text style={{ color: colors.textSecondary }}>
          Roles: {user?.roles.join(', ') || '—'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          API: {API_BASE}
        </Text>
      </Card>

      <Card>
        {links.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable style={[styles.row, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                {item.label}
              </Text>
            </Pressable>
          </Link>
        ))}
      </Card>

      <Pressable
        onPress={onSignOut}
        style={[
          styles.signOut,
          { borderColor: brand.danger, backgroundColor: brand.dangerBg },
        ]}
      >
        <Text style={{ color: brand.danger, fontWeight: '700' }}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700' },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  signOut: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
