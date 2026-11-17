import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Avatar, Card, PrimaryButton, Screen, StatusChip } from '@/components/ui';
import { Spacing, useThemeColors } from '@/constants/theme';
import { fetchMyAttendance, punchMe, uiStatus } from '@/lib/attendanceApi';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { fetchMyEmployee, personName, type HrEmployee } from '@/lib/hrApi';
import { ensureChristmas, fetchMyLeave, type LeaveRequestDto } from '@/lib/leaveApi';
import { fetchNotifications, type NotificationDto } from '@/lib/notificationsApi';
import { fetchMyPayslips, type PayslipDto } from '@/lib/payslipApi';
import { hrefToRoute } from '@/lib/routes';

export default function HomeScreen() {
  const { user, hasRole, can } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [employee, setEmployee] = useState<HrEmployee | null>(null);
  const [punch, setPunch] = useState({
    loaded: false,
    enabled: false,
    checkIn: '',
    checkOut: '',
    status: '',
  });
  const [punchError, setPunchError] = useState<string | null>(null);
  const [leaveLeft, setLeaveLeft] = useState(0);
  const [pendingLeave, setPendingLeave] = useState<LeaveRequestDto[]>([]);
  const [holidays, setHolidays] = useState<Array<{ date: string; name: string }>>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [payslips, setPayslips] = useState<PayslipDto[]>([]);
  const [presentDays, setPresentDays] = useState(0);

  const today = new Date().toLocaleDateString('en-CA');
  const hour = new Date().getHours();

  function loadPunch() {
    const [year, month] = today.split('-').map(Number);
    return fetchMyAttendance(year, month).then((data) => {
      const day = data.days.find((item) => item.date === today);
      setPunch({
        loaded: true,
        enabled: data.webPunchEnabled,
        checkIn: day?.checkIn ?? '',
        checkOut: day?.checkOut ?? '',
        status: day ? uiStatus(day.status) : '',
      });
      const monthKey = today.slice(0, 7);
      setPresentDays(
        data.days.filter(
          (item) => item.date.startsWith(monthKey) && item.date <= today && item.status === 'present',
        ).length,
      );
    });
  }

  useEffect(() => {
    if (!user) return;
    void fetchMyEmployee()
      .then(setEmployee)
      .catch(() => setEmployee(null));
    void loadPunch().catch((err: unknown) => {
      setPunch({ loaded: false, enabled: false, checkIn: '', checkOut: '', status: '' });
      setPunchError(err instanceof Error ? err.message : 'Could not load attendance.');
    });
    void fetchMyLeave()
      .then((data) => {
        setLeaveLeft(
          data.balances.reduce(
            (sum, balance) =>
              balance.code === 'LOP' ? sum : sum + Math.max(0, balance.entitled - balance.used),
            0,
          ),
        );
        setPendingLeave(data.requests.filter((request) => request.status === 'Pending'));
        setHolidays(ensureChristmas(data.holidays));
      })
      .catch(() => undefined);
    void fetchNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
    void fetchMyPayslips()
      .then(setPayslips)
      .catch(() => setPayslips([]));
  }, [today, user]);

  async function onPunch(direction: 'IN' | 'OUT') {
    setPunchError(null);
    try {
      await punchMe(direction);
      await loadPunch();
      showToast(direction === 'IN' ? 'Punched in.' : 'Punched out.');
    } catch (err: unknown) {
      setPunchError(err instanceof Error ? err.message : 'Punch failed.');
    }
  }

  const firstName = employee?.firstName || user?.email?.split('@')[0] || 'there';
  const title = employee?.designation || 'Employee';
  const unread = notifications.filter((item) => !item.read).slice(0, 3);
  const upcomingSorted = ensureChristmas(holidays)
    .filter((holiday) => holiday.date.slice(0, 10) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingSlice = upcomingSorted.slice(0, 4);
  const christmas = upcomingSorted.find((holiday) => holiday.date.slice(5) === '12-25');
  const upcoming =
    christmas && !upcomingSlice.some((holiday) => holiday.date === christmas.date)
      ? [...upcomingSlice.slice(0, 3), christmas]
      : upcomingSlice;
  const latest = payslips[0];
  const isSys = hasRole('SYS') || hasRole('SECURITY_ADMIN');
  const isManager = isSys || hasRole('MGR') || hasRole('MANAGER');
  const isHr =
    isSys ||
    hasRole('HRA') ||
    hasRole('HRH') ||
    hasRole('HRBP') ||
    hasRole('PAY') ||
    hasRole('HR_EXEC') ||
    hasRole('HR_HEAD');
  const isIt = hasRole('ITA') || hasRole('ADM') || hasRole('IT_ADMIN');
  const canAssignRoles = can('rbac.assign');
  const isLeadership = isSys || hasRole('EXEC') || hasRole('LEADERSHIP_READ') || hasRole('FIN');
  const roleLinks: Array<{ href: string; label: string }> = [
    ...(isManager
      ? [
          { href: '/manager/inbox', label: 'Inbox' },
          { href: '/manager/team-leave', label: 'Team leave' },
          { href: '/manager/team-attendance', label: 'Team attendance' },
        ]
      : []),
    ...(isHr
      ? [
          { href: '/hr', label: 'HR overview' },
          { href: '/hr/employees', label: 'Employees' },
        ]
      : []),
    ...(isSys
      ? [
          { href: '/admin', label: 'Admin overview' },
          { href: '/admin/employees', label: 'Employees' },
        ]
      : []),
    ...(canAssignRoles ? [{ href: '/admin/roles', label: 'Users & Roles' }] : []),
    ...(isIt
      ? [
          { href: '/it/assets', label: 'Asset register' },
          { href: '/it/tickets', label: 'Asset tickets' },
        ]
      : []),
    ...(isLeadership
      ? [
          { href: '/exec', label: 'Leadership' },
          { href: '/exec/reports', label: 'Reports' },
        ]
      : []),
  ];

  return (
    <Screen title="Home">
      <Card>
        <View style={styles.hero}>
          <Avatar name={employee ? personName(employee) : firstName} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.hello, { color: colors.text }]}>
              Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {firstName}
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {title}
            </Text>
            {employee ? (
              <Text style={{ color: colors.textSecondary }}>
                {employee.employeeCode} · {employee.departmentName ?? 'Unassigned'} · {employee.locationName ?? '—'}
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={{ color: colors.textSecondary }}>
          {punch.status || 'No punch yet'}
          {punch.checkIn ? ` · ${punch.checkIn}` : ''}
          {punch.checkOut ? ` → ${punch.checkOut}` : ''}
        </Text>
        <View style={styles.actions}>
          <PrimaryButton
            label="Punch in"
            disabled={!punch.enabled || Boolean(punch.checkIn)}
            onPress={() => void onPunch('IN')}
          />
          <PrimaryButton
            label="Punch out"
            disabled={!punch.enabled || !punch.checkIn || Boolean(punch.checkOut)}
            onPress={() => void onPunch('OUT')}
          />
          <PrimaryButton label="Apply leave" onPress={() => router.push('/(tabs)/leave?section=apply')} />
        </View>
        {punch.loaded && !punch.enabled ? (
          <Text style={{ color: colors.textSecondary }}>Web punch is turned off. Use the office terminal.</Text>
        ) : null}
        {punchError ? <Text style={{ color: '#8f2f2f' }}>{punchError}</Text> : null}
      </Card>

      <View style={styles.stats}>
        <Pressable style={styles.stat} onPress={() => router.push('/(tabs)/leave?section=balances')}>
          <Card style={styles.stat}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Leave left</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{leaveLeft}</Text>
          </Card>
        </Pressable>
        <Card style={styles.stat}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Present</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{presentDays}</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Unread</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {notifications.filter((item) => !item.read).length}
          </Text>
        </Card>
      </View>

      <Card>
        <View style={styles.head}>
          <Text style={[styles.section, { color: colors.text }]}>Notifications</Text>
          <Pressable onPress={() => router.push('/notifications')}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>All</Text>
          </Pressable>
        </View>
        {unread.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>You are all caught up.</Text>
        ) : (
          unread.map((item) => (
            <Pressable key={item.id} onPress={() => router.push(hrefToRoute(item.href))} style={styles.item}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: colors.textSecondary }}>{item.body}</Text>
            </Pressable>
          ))
        )}
      </Card>

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>Pending requests · {pendingLeave.length}</Text>
        {pendingLeave.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>No pending requests.</Text>
        ) : (
          pendingLeave.slice(0, 3).map((request) => (
            <Pressable key={request.id} onPress={() => router.push('/(tabs)/leave?section=pending')} style={styles.item}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {request.type} · {request.days} day{request.days === 1 ? '' : 's'}
              </Text>
              <StatusChip status={request.status} />
            </Pressable>
          ))
        )}
      </Card>

      <Card>
        <View style={styles.head}>
          <Text style={[styles.section, { color: colors.text }]}>Payslip</Text>
          <Pressable onPress={() => router.push('/salary')}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Open</Text>
          </Pressable>
        </View>
        {latest ? (
          <>
            <Text style={{ color: colors.text, fontWeight: '800' }}>{latest.label}</Text>
            <Text style={{ color: colors.textSecondary }}>{latest.month}</Text>
            <Text style={{ color: colors.textSecondary }}>{latest.fileName}</Text>
          </>
        ) : (
          <Text style={{ color: colors.textSecondary }}>No payslips have been uploaded for you yet.</Text>
        )}
      </Card>

      <Card>
        <View style={styles.head}>
          <Text style={[styles.section, { color: colors.text }]}>Upcoming holidays</Text>
          <Pressable onPress={() => router.push('/(tabs)/leave?section=calendar')}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Calendar</Text>
          </Pressable>
        </View>
        {upcoming.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>No upcoming holidays.</Text>
        ) : (
          upcoming.map((holiday) => (
            <Pressable
              key={holiday.date}
              style={styles.item}
              onPress={() => router.push('/(tabs)/leave?section=calendar')}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>{holiday.name}</Text>
              <Text style={{ color: colors.textSecondary }}>{holiday.date}</Text>
            </Pressable>
          ))
        )}
      </Card>

      {roleLinks.length > 0 ? (
        <Card>
          <Text style={[styles.section, { color: colors.text }]}>Your workspace</Text>
          {roleLinks.map((item) => (
            <Pressable key={item.href} onPress={() => router.push(hrefToRoute(item.href))} style={styles.item}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.label}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  hello: { fontSize: 18, fontWeight: '800' },
  actions: { gap: 8 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800' },
  section: { fontSize: 16, fontWeight: '700' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  item: { gap: 4, paddingTop: 8 },
});
