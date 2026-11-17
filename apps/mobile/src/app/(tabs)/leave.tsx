import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, useColorScheme } from 'react-native';
import {
  Card,
  CheckRow,
  DateField,
  EmptyNote,
  Field,
  Insights,
  PrimaryButton,
  Screen,
  Segmented,
  SelectField,
  StatusChip,
} from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { LEAVE_OFFICER_CODES } from '@/lib/roleCatalog';
import {
  applyLeaveRequest,
  leaveHalfLabel,
  ensureChristmas,
  fetchMyLeave,
  LEAVE_TYPE_CATALOG,
  withdrawLeaveRequest,
  workingDaysBetween,
  type LeaveBalanceDto,
  type LeaveRequestDto,
} from '@/lib/leaveApi';

const LEAVE_OFFICERS = [...LEAVE_OFFICER_CODES];

type Section = 'apply' | 'requests' | 'balances' | 'calendar';
type RequestTab = 'Pending' | 'Approved' | 'Withdrawn' | 'Rejected';

const SECTIONS: Array<[Section, string]> = [
  ['apply', 'Apply'],
  ['requests', 'Requests'],
  ['balances', 'Balances'],
  ['calendar', 'Holidays'],
];

const REQUEST_TABS: Array<[RequestTab, string]> = [
  ['Pending', 'Pending'],
  ['Approved', 'Approved'],
  ['Withdrawn', 'Withdraw'],
  ['Rejected', 'Rejected'],
];

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function balanceLeft(balance: LeaveBalanceDto) {
  return Math.max(0, balance.entitled - balance.used);
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function chargeCopy(days: number) {
  if (days <= 0) return 'Choose dates to see how much leave this uses.';
  if (days === 0.5) return '0.5 day leave';
  if (days === 1) return '1 day leave';
  return `${days} days leave`;
}

function leaveOutcome(status: string) {
  if (status === 'Approved') return 'Leave accepted';
  if (status === 'Rejected') return 'Leave not accepted';
  if (status === 'Withdrawn') return 'Withdrawn';
  return 'Waiting for approval';
}

function leaveOutcomeDetail(request: LeaveRequestDto) {
  const days = request.days === 1 ? '1 day' : `${request.days} days`;
  if (request.status === 'Approved') {
    if (request.code === 'LOP') return 'Loss of pay is not taken from a leave balance.';
    return `${days} deducted from ${request.type}.`;
  }
  if (request.status === 'Rejected' || request.status === 'Withdrawn') {
    return `${request.type} balance was not deducted.`;
  }
    return `${request.type} is deducted only after your manager accepts.`;
}

export default function LeaveScreen() {
  const { hasRole } = useAuth();
  const canBackdateEarned = LEAVE_OFFICERS.some((role) => hasRole(role));
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const params = useLocalSearchParams<{ section?: string }>();
  const [balances, setBalances] = useState<LeaveBalanceDto[]>([]);
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [holidays, setHolidays] = useState<Array<{ date: string; name: string }>>([]);
  const [section, setSection] = useState<Section>('apply');
  const [requestTab, setRequestTab] = useState<RequestTab>('Pending');
  const [typeCode, setTypeCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fromHalfStart, setFromHalfStart] = useState(false);
  const [fromHalfEnd, setFromHalfEnd] = useState(false);
  const [toHalfStart, setToHalfStart] = useState(false);
  const [toHalfEnd, setToHalfEnd] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchMyLeave()
      .then((data) => {
        setBalances(data.balances);
        setRequests(data.requests);
        setHolidays(ensureChristmas(data.holidays));
        setTypeCode((current) => current || data.balances[0]?.code || 'CL');
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load leave.'));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (section === 'requests' || section === 'balances' || section === 'calendar') load();
  }, [section]);

  useEffect(() => {
    const value = params.section;
    if (value === 'apply' || value === 'requests' || value === 'balances' || value === 'calendar') {
      setSection(value);
    }
    if (value === 'pending') {
      setSection('requests');
      setRequestTab('Pending');
    }
  }, [params.section]);

  const sameDay = Boolean(startDate) && (!endDate || startDate === endDate);
  const previewDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return workingDaysBetween(
      startDate,
      endDate,
      holidays.map((holiday) => holiday.date),
      fromHalfStart !== fromHalfEnd,
      !sameDay && toHalfStart !== toHalfEnd,
      typeCode === 'EL',
    );
  }, [startDate, endDate, holidays, fromHalfStart, fromHalfEnd, toHalfStart, toHalfEnd, sameDay, typeCode]);

  useEffect(() => {
    if (sameDay && (toHalfStart || toHalfEnd)) {
      setToHalfStart(false);
      setToHalfEnd(false);
    }
  }, [sameDay, toHalfStart, toHalfEnd]);
  const today = todayIso();
  const plannedBlocked = !canBackdateEarned && startDate !== '' && startDate < today;
  const sickBlocked =
    (startDate !== '' && startDate > today) || (endDate !== '' && endDate > today);
  const typeOptions = (balances.length > 0 ? balances : LEAVE_TYPE_CATALOG).filter(
    (balance) => balance.code !== 'EL' || !plannedBlocked,
  );
  const casual = balances.find((balance) => balance.code === 'CL');
  const earned = balances.find((balance) => balance.code === 'EL');
  const pending = requests.filter((request) => request.status === 'Pending');
  const visibleRequests = requests.filter((request) => request.status === requestTab);
  const upcomingHolidays = holidays
    .filter((holiday) => holiday.date.slice(0, 10) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextHoliday = upcomingHolidays[0];

  const months = useMemo(() => {
    const groups = new Map<string, { date: string; name: string }[]>();
    for (const holiday of upcomingHolidays) {
      const label = new Date(`${holiday.date}T12:00:00`).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
      const list = groups.get(label) ?? [];
      list.push(holiday);
      groups.set(label, list);
    }
    return [...groups.entries()];
  }, [upcomingHolidays]);

  useEffect(() => {
    if (plannedBlocked && typeCode === 'EL') setTypeCode('');
  }, [plannedBlocked, typeCode]);

  async function onSubmit() {
    setError(null);
    if (!typeCode) {
      setError('Select a leave type.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Choose a from and to date.');
      return;
    }
    if (typeCode !== 'SL' && startDate < today) {
      setError('Leave cannot be applied for a past date.');
      return;
    }
    if (typeCode === 'SL' && (startDate > today || (endDate || startDate) > today)) {
      setError('Sick leave cannot be applied for a future date.');
      return;
    }
    try {
      await applyLeaveRequest({
        code: typeCode,
        fromDate: startDate,
        toDate: endDate || startDate,
        halfDayStart: fromHalfStart !== fromHalfEnd,
        halfDayEnd: !sameDay && toHalfStart !== toHalfEnd,
        fromHalfStart,
        fromHalfEnd,
        toHalfStart: sameDay ? false : toHalfStart,
        toHalfEnd: sameDay ? false : toHalfEnd,
        reason,
      });
      setStartDate('');
      setEndDate('');
      setReason('');
      setFromHalfStart(false);
      setFromHalfEnd(false);
      setToHalfStart(false);
      setToHalfEnd(false);
      setRequestTab('Pending');
      setSection('requests');
      load();
      showToast('Leave request submitted.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit leave.');
    }
  }

  async function onWithdraw(id: string) {
    try {
      const data = await withdrawLeaveRequest(id);
      setBalances(data.balances);
      setRequests(data.requests);
      setHolidays(ensureChristmas(data.holidays));
      showToast('Leave request withdrawn.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not withdraw leave.');
    }
  }

  return (
    <Screen title="Leave">
      <Insights
        items={[
          ['Casual leave left', casual ? balanceLeft(casual) : 0],
          ['Earned leave left', earned ? balanceLeft(earned) : 0],
          ['Pending', pending.length],
        ]}
      />
      <Text style={{ color: colors.textSecondary }}>
        {nextHoliday
          ? `Next holiday ${nextHoliday.name} · ${formatDate(nextHoliday.date)}`
          : 'No upcoming holidays'}
      </Text>
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      <Segmented value={section} options={SECTIONS} onChange={setSection} />

      {section === 'apply' ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Apply leave</Text>
          <SelectField
            label="Type"
            value={typeCode}
            onChange={setTypeCode}
            options={[
              { value: '', label: 'Select leave' },
              ...typeOptions.map((balance) => ({
                value: balance.code,
                label: `${balance.type}${balances.length > 0 ? ` · ${balanceLeft(balance)} left` : ''}`,
              })),
            ]}
          />
          {plannedBlocked ? (
            <Text style={{ color: colors.textSecondary }}>
              Planned leave can only be applied for today or a later date.
            </Text>
          ) : null}
          {typeCode === 'SL' && sickBlocked ? (
            <Text style={{ color: brand.danger }}>
              Sick leave cannot be applied for a future date.
            </Text>
          ) : null}
          <DateField label="From" value={startDate} onChange={setStartDate} />
          <DateField label="To" value={endDate} onChange={setEndDate} />
          <Text style={{ color: colors.text, fontWeight: '700' }}>From half day</Text>
          <CheckRow
            label="Half Day Start"
            value={fromHalfStart}
            onChange={(next) => {
              setFromHalfStart(next);
              if (next) setFromHalfEnd(false);
            }}
          />
          <CheckRow
            label="Half Day End"
            value={fromHalfEnd}
            onChange={(next) => {
              setFromHalfEnd(next);
              if (next) setFromHalfStart(false);
            }}
          />
          <Text style={{ color: colors.text, fontWeight: '700' }}>To half day</Text>
          <CheckRow
            label="Half Day Start"
            value={toHalfStart}
            disabled={sameDay}
            onChange={(next) => {
              setToHalfStart(next);
              if (next) setToHalfEnd(false);
            }}
          />
          <CheckRow
            label="Half Day End"
            value={toHalfEnd}
            disabled={sameDay}
            onChange={(next) => {
              setToHalfEnd(next);
              if (next) setToHalfStart(false);
            }}
          />
          <Text style={{ color: colors.textSecondary }}>
            {sameDay
              ? 'On one day, choose Half Day Start or Half Day End on From.'
              : 'From and To each have their own Half Day Start and Half Day End. Pick one half per date.'}
          </Text>
          <Field label="Reason (optional)" value={reason} onChangeText={setReason} multiline />
          <Text style={{ color: colors.text, fontWeight: '700' }}>{chargeCopy(previewDays)}</Text>
          <PrimaryButton label="Submit request" onPress={() => void onSubmit()} />
        </Card>
      ) : null}

      {section === 'requests' ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>My requests</Text>
          <Segmented value={requestTab} options={REQUEST_TABS} onChange={setRequestTab} />
          {visibleRequests.length === 0 ? (
            <EmptyNote text={`No ${requestTab.toLowerCase()} leave.`} />
          ) : null}
          {visibleRequests.map((request) => (
            <Card key={request.id}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{request.type}</Text>
              <StatusChip status={request.status} label={leaveOutcome(request.status)} />
              <Text style={{ color: colors.textSecondary }}>
                {formatDate(request.startDate)}
                {request.endDate !== request.startDate ? ` – ${formatDate(request.endDate)}` : ''} · {request.days}{' '}
                day(s)
                {leaveHalfLabel(request) ? ` · ${leaveHalfLabel(request)}` : ''}
                {request.reason ? ` · ${request.reason}` : ''}
              </Text>
              <Text style={{ color: colors.textSecondary }}>{leaveOutcomeDetail(request)}</Text>
              {request.status === 'Pending' ? (
                <PrimaryButton label="Withdraw" onPress={() => void onWithdraw(request.id)} />
              ) : null}
            </Card>
          ))}
        </Card>
      ) : null}

      {section === 'balances' ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Balances</Text>
          {balances.map((balance) => (
            <Card key={balance.code}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {balance.type} · {balanceLeft(balance)} left
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                Entitled {balance.entitled} · Used {balance.used}
                {balance.pending > 0 ? ` · Waiting ${balance.pending} (not deducted yet)` : ''}
              </Text>
            </Card>
          ))}
        </Card>
      ) : null}

      {section === 'calendar' ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Holiday calendar</Text>
          {months.length === 0 ? <EmptyNote text="No upcoming holidays." /> : null}
          {months.map(([label, list]) => (
            <Card key={label}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
              {list.map((holiday) => (
                <Text key={holiday.date} style={{ color: colors.textSecondary }}>
                  {holiday.name} · {formatDate(holiday.date)}
                </Text>
              ))}
            </Card>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
