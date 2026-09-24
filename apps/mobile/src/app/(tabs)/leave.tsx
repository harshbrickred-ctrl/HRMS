import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Card, Meta, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { essData, type LeaveStatus } from '@/mock/essData';

export default function LeaveScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);

  function statusColor(status: LeaveStatus) {
    switch (status) {
      case 'Approved':
        return brand.success;
      case 'Rejected':
        return brand.danger;
      case 'Pending':
        return brand.warning;
      default:
        return colors.textSecondary;
    }
  }

  return (
    <Screen title="Leave">
      <Text style={[styles.heading, { color: colors.text }]}>Balances</Text>
      {essData.leaveBalances.map((b) => (
        <Card key={b.code}>
          <Text style={[styles.title, { color: colors.text }]}>
            {b.type} ({b.code})
          </Text>
          <View style={styles.row}>
            <Meta label="Available" value={`${b.available}`} />
            <Meta label="Used" value={`${b.used}`} />
            <Meta label="Pending" value={`${b.pending}`} />
          </View>
        </Card>
      ))}

      <Text style={[styles.heading, { color: colors.text }]}>Requests</Text>
      {essData.leaveRequests.map((r) => (
        <Card key={r.id}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, { color: colors.text }]}>{r.type}</Text>
            <Text style={{ color: statusColor(r.status), fontWeight: '700' }}>
              {r.status}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary }}>
            {r.startDate}
            {r.endDate !== r.startDate ? ` → ${r.endDate}` : ''} · {r.days} day(s)
          </Text>
          <Text style={{ color: colors.text }}>{r.reason}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  title: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 24 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
