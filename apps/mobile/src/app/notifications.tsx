import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Card, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { essData } from '@/mock/essData';

export default function NotificationsScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);

  return (
    <Screen title="Notifications">
      {essData.notifications.map((n) => (
        <Card key={n.id}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, { color: colors.text }]}>{n.title}</Text>
            {!n.read ? (
              <Text style={{ color: brand.primary, fontWeight: '700', fontSize: 12 }}>
                New
              </Text>
            ) : null}
          </View>
          <Text style={{ color: colors.text }}>{n.body}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {new Date(n.createdAt).toLocaleString()} · {n.type}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
