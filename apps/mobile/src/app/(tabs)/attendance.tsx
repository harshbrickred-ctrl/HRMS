import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { Card, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import {
  fetchMyAttendance,
  punchMe,
  uiStatus,
  type AttendanceDayDto,
} from '@/lib/attendanceApi';

export default function AttendanceScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const now = new Date();
  const [days, setDays] = useState<AttendanceDayDto[]>([]);
  const [webPunchEnabled, setWebPunchEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchMyAttendance(now.getFullYear(), now.getMonth() + 1)
      .then((data) => {
        setDays([...data.days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14));
        setWebPunchEnabled(data.webPunchEnabled);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load attendance.'))
      .finally(() => setLoading(false));
  }, [now.getFullYear(), now.getMonth()]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toLocaleDateString('en-CA');
  const todayRow = days.find((day) => day.date === today);
  const punchedIn = Boolean(todayRow?.checkIn);
  const punchedOut = Boolean(todayRow?.checkOut);

  async function onPunch(direction: 'IN' | 'OUT') {
    setBusy(true);
    try {
      await punchMe(direction);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Punch failed.');
    } finally {
      setBusy(false);
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case 'present':
        return brand.success;
      case 'absent':
        return brand.danger;
      case 'leave':
      case 'holiday':
        return brand.primaryInk;
      case 'missing_punch':
      case 'half_day':
        return brand.warning;
      default:
        return colors.textSecondary;
    }
  }

  return (
    <Screen title="Attendance">
      <Card>
        <Text style={[styles.title, { color: colors.text }]}>Today</Text>
        <Text style={{ color: colors.textSecondary }}>
          {todayRow
            ? `${uiStatus(todayRow.status)} · ${todayRow.checkIn ?? '—'} → ${todayRow.checkOut ?? '—'}`
            : 'No punches yet'}
        </Text>
        {webPunchEnabled ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, { opacity: punchedIn || busy ? 0.5 : 1 }]}
              disabled={punchedIn || busy}
              onPress={() => void onPunch('IN')}
            >
              <Text style={styles.btnText}>Punch in</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { opacity: !punchedIn || punchedOut || busy ? 0.5 : 1 }]}
              disabled={!punchedIn || punchedOut || busy}
              onPress={() => void onPunch('OUT')}
            >
              <Text style={styles.btnText}>Punch out</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
            Web punch is turned off. Use the office terminal.
          </Text>
        )}
      </Card>
      {error ? (
        <Card>
          <Text style={{ color: brand.danger }}>{error}</Text>
        </Card>
      ) : null}
      {loading ? <ActivityIndicator color={brand.primaryInk} /> : null}
      {days.map((day) => (
        <Card key={day.date}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, { color: colors.text }]}>{day.date}</Text>
            <Text style={{ color: statusColor(day.status), fontWeight: '700' }}>
              {uiStatus(day.status)}
            </Text>
          </View>
          {day.checkIn || day.checkOut ? (
            <Text style={{ color: colors.textSecondary }}>
              {day.checkIn ?? '—'} → {day.checkOut ?? '—'}
            </Text>
          ) : null}
          {day.note ? <Text style={{ color: colors.text }}>{day.note}</Text> : null}
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
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: {
    backgroundColor: brand.primaryInk,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
