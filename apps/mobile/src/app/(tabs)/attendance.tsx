import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Card, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { essData, type AttendanceStatus } from '@/mock/essData';

export default function AttendanceScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);

  function statusColor(status: AttendanceStatus) {
    switch (status) {
      case 'Present':
        return brand.success;
      case 'Absent':
        return brand.danger;
      case 'Leave':
        return brand.primaryInk;
      case 'PendingCorrection':
        return brand.warning;
      default:
        return colors.textSecondary;
    }
  }

  return (
    <Screen title="Attendance">
      <Card>
        <Text style={[styles.title, { color: colors.text }]}>Recent days</Text>
        <Text style={{ color: colors.textSecondary }}>
          Mock ESS data — punches and corrections mirror the web portal.
        </Text>
      </Card>
      {essData.attendance.map((day) => (
        <Card key={day.date}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, { color: colors.text }]}>{day.date}</Text>
            <Text style={{ color: statusColor(day.status), fontWeight: '700' }}>
              {day.status}
            </Text>
          </View>
          {day.checkIn || day.checkOut ? (
            <Text style={{ color: colors.textSecondary }}>
              {day.checkIn ?? '—'} → {day.checkOut ?? '—'}
            </Text>
          ) : null}
          {day.note ? (
            <Text style={{ color: colors.text }}>{day.note}</Text>
          ) : null}
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
