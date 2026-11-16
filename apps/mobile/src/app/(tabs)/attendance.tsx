import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native';
import { Card, DateField, Field, PrimaryButton, Screen, Segmented } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { showToast } from '@/lib/toast';
import {
  fetchMyAttendance,
  punchMe,
  requestAttendanceCorrection,
  uiStatus,
  type AttendanceCorrectionDto,
  type AttendanceDayDto,
} from '@/lib/attendanceApi';

type ViewMode = 'days' | 'correct';

export default function AttendanceScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [punchDate, setPunchDate] = useState(new Date().toLocaleDateString('en-CA'));
  const year = Number(punchDate.slice(0, 4)) || new Date().getFullYear();
  const month = Number(punchDate.slice(5, 7)) || new Date().getMonth() + 1;
  const [days, setDays] = useState<AttendanceDayDto[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrectionDto[]>([]);
  const [webPunchEnabled, setWebPunchEnabled] = useState(false);
  const [punchLoaded, setPunchLoaded] = useState(false);
  const [shift, setShift] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<ViewMode>('days');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [requestedStatus, setRequestedStatus] = useState<'present' | 'absent' | 'leave'>('present');
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetchMyAttendance(year, month)
      .then((data) => {
        setDays([...data.days].sort((a, b) => b.date.localeCompare(a.date)));
        setCorrections(data.corrections ?? []);
        setWebPunchEnabled(data.webPunchEnabled);
        setPunchLoaded(true);
        setShift(data.shift ? `${data.shift.name} ${data.shift.startTime}–${data.shift.endTime}` : '');
        setError(null);
      })
      .catch((err: unknown) => {
        setPunchLoaded(false);
        setWebPunchEnabled(false);
        setError(err instanceof Error ? err.message : 'Could not load attendance.');
      })
      .finally(() => setLoading(false));
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const punchRow = days.find((day) => day.date === punchDate);
  const punchedIn = Boolean(punchRow?.checkIn);
  const punchedOut = Boolean(punchRow?.checkOut);

  async function onPunch(direction: 'IN' | 'OUT') {
    setBusy(true);
    try {
      await punchMe(direction, punchDate);
      load();
      showToast(direction === 'IN' ? 'Punched in.' : 'Punched out.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Punch failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onCorrection() {
    setBusy(true);
    setError(null);
    try {
      await requestAttendanceCorrection({ date, requestedStatus, reason });
      setReason('');
      setView('days');
      load();
      showToast('Correction submitted.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not request a correction.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Attendance">
      <Card>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Punch any day</Text>
        <DateField label="Day" value={punchDate} onChange={setPunchDate} />
        <Text style={{ color: colors.textSecondary }}>
          {punchRow
            ? `${uiStatus(punchRow.status)} · ${punchRow.checkIn ?? '—'} → ${punchRow.checkOut ?? '—'}`
            : 'No punches yet'}
        </Text>
        {shift ? <Text style={{ color: colors.textSecondary }}>{shift}</Text> : null}
        {webPunchEnabled ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PrimaryButton label="Punch in" disabled={!punchDate || punchedIn || busy} onPress={() => void onPunch('IN')} />
            <PrimaryButton
              label="Punch out"
              disabled={!punchDate || !punchedIn || punchedOut || busy}
              onPress={() => void onPunch('OUT')}
            />
          </View>
        ) : punchLoaded ? (
          <Text style={{ color: colors.textSecondary }}>Web punch is turned off. Use the office terminal.</Text>
        ) : null}
      </Card>
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      <Segmented
        value={view}
        options={[
          ['days', 'Register'],
          ['correct', 'Correction'],
        ]}
        onChange={setView}
      />
      {view === 'correct' ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '800' }}>Request a correction</Text>
          <DateField label="Date" value={date} onChange={setDate} />
          <Segmented
            value={requestedStatus}
            options={[
              ['present', 'Present'],
              ['absent', 'Absent'],
              ['leave', 'Leave'],
            ]}
            onChange={setRequestedStatus}
          />
          <Field label="Reason" value={reason} onChangeText={setReason} multiline />
          <PrimaryButton label="Submit" disabled={busy || !reason.trim()} onPress={() => void onCorrection()} />
          {corrections.map((item) => (
            <Text key={item.id} style={{ color: colors.textSecondary }}>
              {item.date} · {item.status} · {item.reason}
            </Text>
          ))}
        </Card>
      ) : null}
      {loading ? <ActivityIndicator color={brand.primaryInk} /> : null}
      {view === 'days'
        ? days.map((day) => (
            <Card key={day.date}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{day.date}</Text>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{uiStatus(day.status)}</Text>
              </View>
              {day.checkIn || day.checkOut ? (
                <Text style={{ color: colors.textSecondary }}>
                  {day.checkIn ?? '—'} → {day.checkOut ?? '—'}
                </Text>
              ) : null}
              {day.note ? <Text style={{ color: colors.text }}>{day.note}</Text> : null}
            </Card>
          ))
        : null}
    </Screen>
  );
}
