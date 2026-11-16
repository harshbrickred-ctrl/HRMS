import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, useColorScheme } from 'react-native';
import { Redirect, router } from 'expo-router';
import {
  Card,
  DateField,
  EmptyNote,
  Field,
  FileField,
  GhostButton,
  SelectField,
  SearchSelect,
  Segmented,
  Insights,
  PrimaryButton,
  Screen,
  StatusChip,
} from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { showToast } from '@/lib/toast';
import { HrEmployees } from '@/screens/HrEmployeesScreen';
import {
  createDepartment,
  createLocation,
  createTeam,
  fetchDirectory,
  fetchHrEmployee,
  fetchHrEmployees,
  fetchHrOrg,
  personName,
  updateHrLeaveBalances,
  deleteHrDocument,
  downloadHrDocument,
  uploadHrDocument,
  type HrEmployee,
  type HrOrg,
} from '@/lib/hrApi';
import { useAuth } from '@/lib/auth';
import {
  createDevice,
  createHoliday,
  decideCorrection,
  downloadRegister,
  fetchAttendanceExceptions,
  fetchAttendancePeriod,
  fetchDevices,
  fetchHolidays,
  fetchShifts,
  fetchTeamAttendance,
  fetchUnmatchedPunches,
  lockAttendancePeriod,
  uiStatus,
  type AttendanceDevice,
  type HolidayDto,
  type ShiftDto,
} from '@/lib/attendanceApi';
import {
  applyLeaveForEmployee,
  decideLeaveRequest,
  fetchTeamLeave,
  LEAVE_TYPE_CATALOG,
  type LeaveRequestDto,
} from '@/lib/leaveApi';
import { fetchReportSummary, fetchWorkflowQueues, type ReportSummary, type WorkflowQueue } from '@/lib/reportsApi';
import { fetchEmployeePayslips, uploadEmployeePayslip, type PayslipDto } from '@/lib/payslipApi';
import { useWorkspace } from '@/mock/workspace';
import { LeaveApprovalsPanel } from '@/components/LeaveApprovalsPanel';
import { hrefToRoute } from '@/lib/routes';

export { HrEmployees };

function Denied({ title }: { title: string }) {
  return (
    <Screen title={title} back>
      <Card>
        <EmptyNote text="Your role does not include this workspace." />
      </Card>
    </Screen>
  );
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function useSummary() {
  const [figures, setFigures] = useState<ReportSummary | null>(null);
  useEffect(() => {
    fetchReportSummary()
      .then(setFigures)
      .catch(() => setFigures(null));
  }, []);
  return figures;
}

export function LiveManager({ page }: { page: string }) {
  const { user, hasRole } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const summary = useSummary();
  const now = new Date();
  const [leaveItems, setLeaveItems] = useState<LeaveRequestDto[]>([]);
  const [corrections, setCorrections] = useState<
    Array<{ id: string; date: string; reason: string; status: string; person?: { name: string } | null }>
  >([]);
  const [exceptions, setExceptions] = useState<
    Array<{ date: string; status: string; checkIn: string | null; checkOut: string | null; person: { name: string } | null }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [teamTab, setTeamTab] = useState<'Pending' | 'Approved'>('Pending');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  function load() {
    Promise.all([fetchTeamLeave(), fetchTeamAttendance(now.getFullYear(), now.getMonth() + 1)])
      .then(([leave, attendance]) => {
        setLeaveItems(leave.requests);
        setCorrections(attendance.corrections);
        setExceptions(attendance.exceptions);
        setError(null);
      })
      .catch((err: unknown) => setError(messageOf(err)));
  }

  useEffect(() => {
    if (hasRole('MGR') || hasRole('MANAGER') || hasRole('SYS') || hasRole('SECURITY_ADMIN')) load();
    // month is stable for this session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return <Redirect href="/login" />;
  if (
    !hasRole('MGR') &&
    !hasRole('MANAGER') &&
    !hasRole('SYS') &&
    !hasRole('SECURITY_ADMIN')
  ) {
    return <Denied title="Manager" />;
  }

  async function onLeave(id: string, status: 'Approved' | 'Rejected', note?: string) {
    try {
      await decideLeaveRequest(id, status, note);
      showToast(status === 'Approved' ? 'Leave approved.' : 'Leave rejected.');
      setRejectId(null);
      setRejectNote('');
      load();
    } catch (err: unknown) {
      setError(messageOf(err));
    }
  }

  async function onCorrection(id: string, status: 'Approved' | 'Rejected') {
    try {
      await decideCorrection(id, status);
      showToast(status === 'Approved' ? 'Correction approved.' : 'Correction rejected.');
      load();
    } catch (err: unknown) {
      setError(messageOf(err));
    }
  }

  if (page === 'inbox') {
    const pendingLeave = leaveItems.filter((item) => item.status === 'Pending');
    const pendingCorrections = corrections.filter((item) => item.status === 'Pending');
    return (
      <Screen title="Inbox" back>
        {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
        {pendingLeave.length === 0 && pendingCorrections.length === 0 ? (
          <EmptyNote text="Nothing is waiting for you." />
        ) : null}
        {pendingLeave.map((item) => (
          <Card key={item.id}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.person?.name ?? 'Employee'} · Leave</Text>
            <StatusChip status={item.status} />
            <Text style={{ color: colors.textSecondary }}>
              {item.type} · {item.startDate}
              {item.endDate !== item.startDate ? ` – ${item.endDate}` : ''} · {item.days} day(s) · {item.reason}
            </Text>
            <PrimaryButton label="Approve" onPress={() => void onLeave(item.id, 'Approved')} />
            {rejectId === item.id ? (
              <>
                <Field label="Rejection comment" value={rejectNote} onChangeText={setRejectNote} multiline />
                <PrimaryButton
                  danger
                  label="Confirm reject"
                  disabled={!rejectNote.trim()}
                  onPress={() => void onLeave(item.id, 'Rejected', rejectNote.trim())}
                />
              </>
            ) : (
              <PrimaryButton
                danger
                label="Reject"
                onPress={() => {
                  setRejectId(item.id);
                  setRejectNote('');
                }}
              />
            )}
          </Card>
        ))}
        {pendingCorrections.map((item) => (
          <Card key={item.id}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {item.person?.name ?? 'Employee'} · Attendance
            </Text>
            <StatusChip status={item.status} />
            <Text style={{ color: colors.textSecondary }}>
              {item.date} · {item.reason}
            </Text>
            <PrimaryButton label="Approve" onPress={() => void onCorrection(item.id, 'Approved')} />
            <PrimaryButton danger label="Reject" onPress={() => void onCorrection(item.id, 'Rejected')} />
          </Card>
        ))}
      </Screen>
    );
  }

  if (page === 'team-leave') {
    const visibleLeave = leaveItems.filter((item) => item.status === teamTab);
    return (
      <Screen title="Team Leave" back>
        <Segmented
          value={teamTab}
          options={[
            ['Pending', `Pending (${leaveItems.filter((item) => item.status === 'Pending').length})`],
            ['Approved', `Approved (${leaveItems.filter((item) => item.status === 'Approved').length})`],
          ]}
          onChange={setTeamTab}
        />
        {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
        {visibleLeave.length === 0 ? <EmptyNote text={`No ${teamTab.toLowerCase()} team leave.`} /> : null}
        {visibleLeave.map((item) => (
          <Card key={item.id}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.person?.name ?? 'Employee'}</Text>
            <StatusChip status={item.status} />
            <Text style={{ color: colors.textSecondary }}>
              {item.type} · {item.startDate}
              {item.endDate !== item.startDate ? ` – ${item.endDate}` : ''} · {item.days} day(s) · {item.reason}
            </Text>
            {item.status === 'Pending' ? (
              <>
                <PrimaryButton label="Approve" onPress={() => void onLeave(item.id, 'Approved')} />
                {rejectId === item.id ? (
                  <>
                    <Field label="Rejection comment" value={rejectNote} onChangeText={setRejectNote} multiline />
                    <PrimaryButton
                      danger
                      label="Confirm reject"
                      disabled={!rejectNote.trim()}
                      onPress={() => void onLeave(item.id, 'Rejected', rejectNote.trim())}
                    />
                  </>
                ) : (
                  <PrimaryButton
                    danger
                    label="Reject"
                    onPress={() => {
                      setRejectId(item.id);
                      setRejectNote('');
                    }}
                  />
                )}
              </>
            ) : null}
          </Card>
        ))}
      </Screen>
    );
  }

  if (page === 'team-attendance') {
    return (
      <Screen title="Team Attendance" back>
        <Insights
          items={[
            ['Exceptions', exceptions.length],
            ['Corrections', corrections.filter((item) => item.status === 'Pending').length],
            ['Absences', exceptions.filter((item) => item.status === 'absent').length],
          ]}
        />
        {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
        {corrections.map((item) => (
          <Card key={item.id}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.person?.name ?? 'Employee'}</Text>
            <StatusChip status={item.status} />
            <Text style={{ color: colors.textSecondary }}>
              {item.date} · {item.reason}
            </Text>
            {item.status === 'Pending' ? (
              <>
                <PrimaryButton label="Approve" onPress={() => void onCorrection(item.id, 'Approved')} />
                <PrimaryButton danger label="Reject" onPress={() => void onCorrection(item.id, 'Rejected')} />
              </>
            ) : null}
          </Card>
        ))}
        {exceptions.map((item) => (
          <Card key={`${item.person?.name ?? 'x'}-${item.date}`}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.person?.name ?? 'Employee'}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {item.date} · {uiStatus(item.status)} · {item.checkIn ?? '—'} → {item.checkOut ?? '—'}
            </Text>
          </Card>
        ))}
      </Screen>
    );
  }

  if (page === 'directory') {
    return <ManagerDirectory />;
  }

  const pending = leaveItems.filter((item) => item.status === 'Pending').length;
  return (
    <Screen title="Manager" back>
      <Insights
        items={[
          ['Pending approvals', pending + corrections.filter((item) => item.status === 'Pending').length],
          ['On leave', summary?.onLeave ?? 0],
          ['Exceptions', exceptions.length],
        ]}
      />
      <PrimaryButton label="Open inbox" onPress={() => router.push('/manager/inbox')} />
    </Screen>
  );
}

function ManagerDirectory() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const { user } = useAuth();
  const [rows, setRows] = useState<
    Array<{ id: string; name: string; designation: string; code: string; department: string; location: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchDirectory()
      .then((people) => {
        const me = people.find((person) => person.email.toLowerCase() === user?.email?.toLowerCase());
        const reports = me ? people.filter((person) => person.managerId === me.id) : [];
        setRows(
          reports.map((person) => ({
            id: person.id,
            name: personName(person),
            designation: person.designation,
            code: person.employeeCode,
            department: person.departmentName || 'Unassigned',
            location: person.locationName || '—',
          })),
        );
      })
      .catch((err: unknown) => setError(messageOf(err)));
  }, [user?.email]);
  return (
    <Screen title="Team Directory" back>
      <Insights
        items={[
          ['Direct reports', rows.length],
          ['Departments', new Set(rows.map((person) => person.department)).size],
          ['Locations', new Set(rows.map((person) => person.location)).size],
        ]}
      />
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      {rows.map((person) => (
        <Card key={person.id}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>{person.name}</Text>
          <Text style={{ color: colors.textSecondary }}>{person.designation}</Text>
          <Text style={{ color: colors.textSecondary }}>
            {person.code} · {person.department}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

export function LiveHr({ page }: { page: string }) {
  const { user, hasRole } = useAuth();
  if (!user) return <Redirect href="/login" />;
  if (
    !hasRole('HRA') &&
    !hasRole('HRH') &&
    !hasRole('HRBP') &&
    !hasRole('PAY') &&
    !hasRole('SYS') &&
    !hasRole('SECURITY_ADMIN') &&
    !hasRole('HR_EXEC') &&
    !hasRole('HR_HEAD')
  ) {
    return <Denied title="HR" />;
  }
  if (page === 'employees') return <HrEmployees />;
  if (page === 'organization') return <HrOrganization />;
  if (page === 'leave') return <HrLeave />;
  if (page === 'attendance') return <HrAttendance />;
  if (page === 'documents') return <HrDocs />;
  if (page === 'workflows') return <HrWorkflows />;
  if (page === 'reports') return <HrReports />;
  if (page === 'migration') return <HrMigration />;
  return <HrOverview />;
}

function HrOverview() {
  const workspace = useWorkspace();
  const [people, setPeople] = useState<HrEmployee[]>([]);
  useEffect(() => {
    fetchHrEmployees()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, []);
  const incomplete = people.filter(
    (person) => !person.departmentId || !person.locationId || !person.designation.trim(),
  ).length;
  return (
    <Screen title="HR" back>
      <Insights
        items={[
          ['Employees', people.length],
          ['Incomplete profiles', incomplete],
          ['Import rows', workspace.imports.length],
        ]}
      />
      <Card>
        <Text style={{ fontWeight: '700' }}>
          {incomplete} people missing a department, location, or designation
        </Text>
        <Text>{workspace.imports.length === 0 ? 'No files recorded yet' : `${workspace.imports.length} recorded`}</Text>
      </Card>
    </Screen>
  );
}

function HrOrganization() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [org, setOrg] = useState<HrOrg | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchHrOrg()
      .then(setOrg)
      .catch((err: unknown) => setError(messageOf(err)));
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <Screen title="Organization" back>
      <Insights
        items={[
          ['Departments', org?.departments.length ?? 0],
          ['Locations', org?.locations.length ?? 0],
          ['Teams', org?.teams.length ?? 0],
        ]}
      />
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      <Field label="Name" value={name} onChangeText={setName} />
      <PrimaryButton
        label="Add department"
        onPress={() => {
          if (!name.trim()) return;
          void createDepartment(name.trim()).then(() => {
            setName('');
            load();
            showToast('Department added.');
          });
        }}
      />
      <PrimaryButton
        label="Add location"
        onPress={() => {
          if (!name.trim()) return;
          void createLocation(name.trim()).then(() => {
            setName('');
            load();
            showToast('Location added.');
          });
        }}
      />
      <PrimaryButton
        label="Add team in first department"
        onPress={() => {
          const departmentId = org?.departments[0]?.id;
          if (!name.trim() || !departmentId) return;
          void createTeam({ name: name.trim(), departmentId }).then(() => {
            setName('');
            load();
            showToast('Team added.');
          });
        }}
      />
      {org?.departments.map((item) => (
        <Card key={item.id}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>{item.name}</Text>
          {org.teams
            .filter((team) => team.departmentId === item.id)
            .map((team) => (
              <Text key={team.id} style={{ color: colors.textSecondary }}>
                {team.name} · {team.managerName || 'No manager'}
              </Text>
            ))}
        </Card>
      ))}
      <Card>
        <Text style={{ color: colors.text, fontWeight: '800' }}>Locations</Text>
        {org?.locations.map((item) => (
          <Text key={item.id} style={{ color: colors.text }}>
            {item.name}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}

function HrLeave() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyCode, setApplyCode] = useState('CL');
  const [applyFrom, setApplyFrom] = useState('');
  const [applyTo, setApplyTo] = useState('');
  const [applyReason, setApplyReason] = useState('');
  const [applyFromHalfStart, setApplyFromHalfStart] = useState(false);
  const [applyFromHalfEnd, setApplyFromHalfEnd] = useState(false);
  const [applyToHalfStart, setApplyToHalfStart] = useState(false);
  const [applyToHalfEnd, setApplyToHalfEnd] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const applySameDay = Boolean(applyFrom) && (!applyTo || applyFrom === applyTo);
  useEffect(() => {
    if (applySameDay && (applyToHalfStart || applyToHalfEnd)) {
      setApplyToHalfStart(false);
      setApplyToHalfEnd(false);
    }
  }, [applySameDay, applyToHalfStart, applyToHalfEnd]);

  function load() {
    fetchHrEmployees()
      .then((rows) => {
        setEmployees(rows);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch((err: unknown) => setError(messageOf(err)));
  }
  useEffect(() => {
    load();
  }, []);
  const selected = employees.find((person) => person.id === selectedId);

  return (
    <Screen title="Leave Admin" back>
      <LeaveApprovalsPanel />
      {selected ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
            Apply leave for {personName(selected)}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            HR and admin can apply leave on a past date. Employees still cannot.
          </Text>
          <SelectField
            label="Type"
            value={applyCode}
            onChange={setApplyCode}
            options={LEAVE_TYPE_CATALOG.map((item) => ({ value: item.code, label: item.type }))}
          />
          <DateField label="From" value={applyFrom} onChange={setApplyFrom} />
          <DateField label="To" value={applyTo} onChange={setApplyTo} />
          <Text style={{ color: colors.text, fontWeight: '700' }}>From half day</Text>
          <PrimaryButton
            label={applyFromHalfStart ? 'From Half Day Start on' : 'From Half Day Start'}
            onPress={() => {
              setApplyFromHalfStart((value) => !value);
              setApplyFromHalfEnd(false);
            }}
          />
          <PrimaryButton
            label={applyFromHalfEnd ? 'From Half Day End on' : 'From Half Day End'}
            onPress={() => {
              setApplyFromHalfEnd((value) => !value);
              setApplyFromHalfStart(false);
            }}
          />
          <Text style={{ color: colors.text, fontWeight: '700' }}>To half day</Text>
          <PrimaryButton
            label={applyToHalfStart ? 'To Half Day Start on' : 'To Half Day Start'}
            disabled={applySameDay}
            onPress={() => {
              setApplyToHalfStart((value) => !value);
              setApplyToHalfEnd(false);
            }}
          />
          <PrimaryButton
            label={applyToHalfEnd ? 'To Half Day End on' : 'To Half Day End'}
            disabled={applySameDay}
            onPress={() => {
              setApplyToHalfEnd((value) => !value);
              setApplyToHalfStart(false);
            }}
          />
          <Field label="Reason" value={applyReason} onChangeText={setApplyReason} multiline />
          {applyMessage ? <Text style={{ color: colors.textSecondary }}>{applyMessage}</Text> : null}
          <PrimaryButton
            label="Apply leave"
            disabled={!applyFrom}
            onPress={() => {
              setError(null);
              setApplyMessage(null);
              void applyLeaveForEmployee({
                employeeId: selected.id,
                code: applyCode,
                fromDate: applyFrom,
                toDate: applyTo || applyFrom,
                halfDayStart: applyFromHalfStart !== applyFromHalfEnd,
                halfDayEnd: !applySameDay && applyToHalfStart !== applyToHalfEnd,
                fromHalfStart: applyFromHalfStart,
                fromHalfEnd: applyFromHalfEnd,
                toHalfStart: applySameDay ? false : applyToHalfStart,
                toHalfEnd: applySameDay ? false : applyToHalfEnd,
                reason: applyReason,
              })
                .then(() => {
                  setApplyFrom('');
                  setApplyTo('');
                  setApplyReason('');
                  setApplyFromHalfStart(false);
                  setApplyFromHalfEnd(false);
                  setApplyToHalfStart(false);
                  setApplyToHalfEnd(false);
                  setApplyMessage('Leave applied. It is pending approval.');
                  showToast('Leave applied.');
                })
                .catch((err: unknown) => setError(messageOf(err)));
            }}
          />
        </Card>
      ) : null}
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Balances</Text>
      <Text style={{ color: colors.textSecondary }}>
        Adjust entitled days for one person at a time.
      </Text>
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      {employees.map((person) => (
        <Pressable key={person.id} onPress={() => setSelectedId(person.id)}>
          <Text style={{ color: person.id === selectedId ? colors.text : colors.textSecondary, fontWeight: '700' }}>
            {personName(person)}
          </Text>
        </Pressable>
      ))}
      {selected?.leaveBalances?.map((balance) => (
        <Card key={balance.code}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {balance.type} · {balance.available} available
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Entitled {balance.entitled} · Used {balance.used} · Pending {balance.pending}
          </Text>
          <GhostButton
            label="Add 1 entitled"
            onPress={() => {
              const balances = (selected.leaveBalances ?? []).map((item) => ({
                code: item.code,
                entitled: item.code === balance.code ? item.entitled + 1 : item.entitled,
                used: item.used,
                pending: item.pending,
              }));
              void updateHrLeaveBalances(selected.id, balances).then(() => {
                load();
                showToast('Leave balance updated.');
              });
            }}
          />
        </Card>
      ))}
    </Screen>
  );
}

function HrAttendance() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const [exceptions, setExceptions] = useState<Array<{ date: string; status: string; person: { name: string } | null }>>(
    [],
  );
  const [unmatched, setUnmatched] = useState<Array<{ id: string; pin: string; serial: string }>>([]);
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [holidays, setHolidays] = useState<HolidayDto[]>([]);
  const [shifts, setShifts] = useState<ShiftDto[]>([]);
  const [period, setPeriod] = useState<'open' | 'locked'>('open');
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [serial, setSerial] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    Promise.all([
      fetchAttendanceExceptions(year, month),
      fetchUnmatchedPunches(),
      fetchDevices().catch(() => ({ devices: [], operationLogs: [] })),
      fetchHolidays(),
      fetchShifts(),
      fetchAttendancePeriod(year, month),
    ])
      .then(([exceptionRows, pins, devicePayload, holidayRows, shiftRows, periodRow]) => {
        setExceptions(exceptionRows);
        setUnmatched(pins);
        setDevices(devicePayload.devices);
        setHolidays(holidayRows);
        setShifts(shiftRows);
        setPeriod(periodRow.status);
      })
      .catch((err: unknown) => setError(messageOf(err)));
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <Screen title="Attendance Admin" back>
      <Insights
        items={[
          ['Exceptions', exceptions.length],
          ['Unmatched', unmatched.length],
          ['Period', period],
        ]}
      />
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      <Text style={{ color: colors.textSecondary }}>{shifts.map((shift) => shift.name).join(', ') || 'No shifts'}</Text>
      <PrimaryButton
        label="Download register"
        onPress={() => {
          void downloadRegister(year, month).catch((err: unknown) => setError(messageOf(err)));
        }}
      />
      {period === 'open' ? (
        <PrimaryButton
          label="Lock this month"
          onPress={() => {
            void lockAttendancePeriod(year, month).then(() => {
              load();
              showToast('Month locked.');
            });
          }}
        />
      ) : null}
      <Field label="Holiday name" value={holidayName} onChangeText={setHolidayName} />
      <DateField label="Holiday date" value={holidayDate} onChange={setHolidayDate} />
      <PrimaryButton
        label="Add holiday"
        onPress={() => {
          if (!holidayName.trim() || !holidayDate) return;
          void createHoliday({ name: holidayName.trim(), date: holidayDate }).then(() => {
            setHolidayName('');
            setHolidayDate('');
            load();
            showToast('Holiday saved.');
          });
        }}
      />
      {holidays.map((holiday) => (
        <Text key={holiday.id} style={{ color: colors.text }}>
          {holiday.date} · {holiday.name}
        </Text>
      ))}
      <Field label="Device serial" value={serial} onChangeText={setSerial} />
      <Field label="Device name" value={deviceName} onChangeText={setDeviceName} />
      <PrimaryButton
        label="Register device"
        onPress={() => {
          if (!serial.trim() || !deviceName.trim()) return;
          void createDevice({ serial: serial.trim(), name: deviceName.trim() }).then(() => {
            setSerial('');
            setDeviceName('');
            load();
            showToast('Device registered.');
          });
        }}
      />
      {devices.map((device) => (
        <Text key={device.id} style={{ color: colors.textSecondary }}>
          {device.name} · {device.serial} · {device.enrollments.length} pins
        </Text>
      ))}
      {exceptions.slice(0, 20).map((item) => (
        <Text key={`${item.person?.name}-${item.date}`} style={{ color: colors.text }}>
          {item.person?.name ?? 'Employee'} · {item.date} · {uiStatus(item.status)}
        </Text>
      ))}
    </Screen>
  );
}

const DOC_CATEGORIES = [
  'Employee Documents',
  'Brickred Documents',
  'Educational Certificates',
  'Past Employment Documents',
];

function confirmRemove(fileName: string) {
  const message = `Remove ${fileName}? This deletes the file.`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert('Remove document', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

function HrDocs() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HrEmployee | null>(null);
  const [payslips, setPayslips] = useState<PayslipDto[]>([]);
  const [category, setCategory] = useState(DOC_CATEGORIES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [tab, setTab] = useState<'documents' | 'upload' | 'pdf'>('documents');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [label, setLabel] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfKey, setPdfKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchHrEmployees()
      .then((rows) => {
        const sorted = [...rows].sort((a, b) => personName(a).localeCompare(personName(b)));
        setEmployees(sorted);
        setSelectedId((current) => current ?? sorted[0]?.id ?? null);
      })
      .catch((err: unknown) => setError(messageOf(err)));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDetail(null);
    fetchHrEmployee(selectedId)
      .then((person) => {
        if (!cancelled) setDetail(person);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err));
      });
    fetchEmployeePayslips(selectedId)
      .then((rows) => {
        if (!cancelled) setPayslips(rows);
      })
      .catch(() => {
        if (!cancelled) setPayslips([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const documents = detail?.id === selectedId ? (detail.documents ?? []) : [];
  const categoryOptions = useMemo(() => {
    const extra = documents
      .map((item) => item.category)
      .filter((item) => !DOC_CATEGORIES.includes(item));
    return [...DOC_CATEGORIES, ...new Set(extra)];
  }, [documents]);

  function onChoose(next: File | null) {
    setError(null);
    setMessage(null);
    if (!next) {
      setFile(null);
      return;
    }
    const ext = next.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'].includes(ext)) {
      setFile(null);
      setFileKey((current) => current + 1);
      setError('Use a PDF, PNG, JPG, DOC, or DOCX file.');
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      setFile(null);
      setFileKey((current) => current + 1);
      setError('Choose a file up to 10 MB.');
      return;
    }
    setFile(next);
  }

  async function onUpload() {
    if (!selectedId || !file) {
      setError('Choose a file to upload.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await uploadHrDocument(selectedId, file, category);
      setDetail(updated);
      setMessage(`${file.name} saved in ${category}.`);
      showToast(`${file.name} saved.`);
      setFile(null);
      setFileKey((current) => current + 1);
      setTab('documents');
    } catch (err: unknown) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(documentId: string, fileName: string) {
    if (!selectedId) return;
    const ok = await confirmRemove(fileName);
    if (!ok) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await deleteHrDocument(selectedId, documentId);
      setDetail(updated);
      setMessage(`${fileName} removed.`);
      showToast(`${fileName} removed.`);
    } catch (err: unknown) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  function onChoosePdf(next: File | null) {
    setError(null);
    setMessage(null);
    if (!next) {
      setPdfFile(null);
      return;
    }
    const ext = next.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext !== 'pdf') {
      setPdfFile(null);
      setPdfKey((current) => current + 1);
      setError('Choose a PDF file.');
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      setPdfFile(null);
      setPdfKey((current) => current + 1);
      setError('Choose a file up to 10 MB.');
      return;
    }
    setPdfFile(next);
  }

  async function onUploadPayslip() {
    if (!selectedId || !pdfFile || !label.trim()) {
      setError('Add a label and choose a PDF.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await uploadEmployeePayslip(selectedId, month, label.trim(), pdfFile);
      setPayslips(await fetchEmployeePayslips(selectedId));
      setMessage(`${pdfFile.name} saved as a payslip.`);
      showToast('Payslip uploaded.');
      setLabel('');
      setPdfFile(null);
      setPdfKey((current) => current + 1);
    } catch (err: unknown) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Document Center" back>
      <Text style={{ color: colors.textSecondary }}>
        Pick a person, then open a tab to see files, upload a document, or upload a payslip PDF.
      </Text>
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      {message ? <Text style={{ color: colors.text, fontWeight: '700' }}>{message}</Text> : null}
      <SearchSelect
        label="Search people"
        value={selectedId ?? ''}
        placeholder="Search name"
        onChange={setSelectedId}
        options={employees.map((person) => ({
          value: person.id,
          label: `${personName(person)} · ${person.employeeCode}`,
        }))}
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          ['documents', 'Documents'],
          ['upload', 'Document upload'],
          ['pdf', 'PDF upload'],
        ]}
      />
      {tab === 'documents' ? (
        <>
          {detail?.id === selectedId ? (
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              {personName(detail)} · {documents.length} {documents.length === 1 ? 'file' : 'files'}
            </Text>
          ) : (
            <Text style={{ color: colors.textSecondary }}>Loading files…</Text>
          )}
          {documents.map((doc) => (
            <Card key={doc.id}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{doc.fileName}</Text>
              <Text style={{ color: colors.textSecondary }}>
                {doc.category} · {doc.uploadedAt}
              </Text>
              <GhostButton
                label="Download"
                onPress={() => {
                  if (!selectedId) return;
                  void downloadHrDocument(selectedId, doc.id, doc.fileName).catch((err: unknown) =>
                    setError(messageOf(err)),
                  );
                }}
              />
              <GhostButton label="Delete" disabled={busy} onPress={() => void onDelete(doc.id, doc.fileName)} />
            </Card>
          ))}
          {detail?.id === selectedId && documents.length === 0 ? (
            <EmptyNote text="No files for this person yet." />
          ) : null}
        </>
      ) : null}
      {tab === 'upload' ? (
        <>
          <SelectField
            label="Category"
            value={category}
            onChange={setCategory}
            options={categoryOptions.map((item) => ({ value: item, label: item }))}
          />
          <FileField key={fileKey} label="File" onChange={onChoose} disabled={busy} />
          <Text style={{ color: colors.textSecondary }}>
            {file ? `${file.name} · ready to upload` : 'PDF, PNG, JPG, DOC, or DOCX · up to 10 MB'}
          </Text>
          <PrimaryButton
            label={busy ? 'Uploading…' : 'Upload'}
            onPress={() => void onUpload()}
            disabled={busy || !file || !selectedId}
          />
        </>
      ) : null}
      {tab === 'pdf' ? (
        <>
          {payslips.length === 0 ? (
            <EmptyNote text="No payslip PDFs for this person yet." />
          ) : (
            payslips.map((slip) => (
              <Text key={slip.id} style={{ color: colors.textSecondary }}>
                {slip.label} · {slip.month}
              </Text>
            ))
          )}
          <Field label="Payslip month" value={month} onChangeText={setMonth} placeholder="YYYY-MM" />
          <Field label="Payslip label" value={label} onChangeText={setLabel} />
          <FileField key={pdfKey} label="PDF" accept=".pdf" onChange={onChoosePdf} disabled={busy} />
          <Text style={{ color: colors.textSecondary }}>
            {pdfFile ? `${pdfFile.name} · ready to upload` : 'PDF only · up to 10 MB'}
          </Text>
          <PrimaryButton
            label={busy ? 'Uploading…' : 'Upload PDF'}
            onPress={() => void onUploadPayslip()}
            disabled={busy || !pdfFile || !label.trim() || !selectedId}
          />
        </>
      ) : null}
    </Screen>
  );
}

function HrWorkflows() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [queues, setQueues] = useState<WorkflowQueue[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchWorkflowQueues()
      .then((data) => setQueues(data.queues))
      .catch((err: unknown) => setError(messageOf(err)));
  }, []);
  const stuck = queues.reduce((sum, item) => sum + item.stuck, 0);
  return (
    <Screen title="Workflows" back>
      <Insights
        items={[
          ['Queues', queues.length],
          ['Stuck', stuck],
          ['Clear', queues.filter((item) => item.stuck === 0).length],
        ]}
      />
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      {queues.map((item) => (
        <Card key={item.id}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
          <Text style={{ color: colors.textSecondary }}>{item.stuck} stuck</Text>
          <GhostButton label="Open" onPress={() => router.push(hrefToRoute(item.href))} />
        </Card>
      ))}
    </Screen>
  );
}

function HrReports() {
  const figures = useSummary();
  const rows: Array<[string, number]> = figures
    ? [
        ['Headcount', figures.headcount],
        ['On leave', figures.onLeave],
        ['Exceptions', figures.attendanceExceptions],
        ['Open tickets', figures.openTickets],
      ]
    : [];
  return (
    <Screen title="Reports" back>
      <Insights items={rows.slice(0, 3)} />
      {rows.map(([label, value]) => (
        <Card key={label}>
          <Text style={{ fontWeight: '700' }}>{label}</Text>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>{value}</Text>
        </Card>
      ))}
    </Screen>
  );
}

function HrMigration() {
  const workspace = useWorkspace();
  const [importName, setImportName] = useState('greytHR-employees.csv');
  return (
    <Screen title="Migration" back>
      <Insights
        items={[
          ['Recorded', workspace.imports.length],
          ['Source', 'CSV'],
          ['Last file', workspace.imports[0]?.name ?? '—'],
        ]}
      />
      <Field label="File name" value={importName} onChangeText={setImportName} />
      <PrimaryButton
        label="Append import"
        onPress={() => {
          if (!importName.trim()) return;
          workspace.addImport(importName.trim());
          showToast('Import recorded.');
        }}
      />
      {workspace.imports.length === 0 ? <EmptyNote text="Nothing recorded yet." /> : null}
      {workspace.imports.map((row) => (
        <Card key={row.id}>
          <Text style={{ fontWeight: '700' }}>{row.name}</Text>
          <Text>{row.at}</Text>
        </Card>
      ))}
    </Screen>
  );
}

export function LiveExec({ page }: { page: string }) {
  const { user, hasRole } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const figures = useSummary();
  if (!user) return <Redirect href="/login" />;
  if (
    !hasRole('EXEC') &&
    !hasRole('LEADERSHIP_READ') &&
    !hasRole('FIN') &&
    !hasRole('ACC') &&
    !hasRole('SYS') &&
    !hasRole('SECURITY_ADMIN')
  ) {
    return <Denied title="Leadership" />;
  }
  const rows: Array<[string, number]> = figures
    ? [
        ['Headcount', figures.headcount],
        ['On leave', figures.onLeave],
        ['Exceptions', figures.attendanceExceptions],
        ['Awaiting approval', figures.pendingLeave + figures.pendingCorrections],
      ]
    : [
        ['Headcount', 0],
        ['On leave', 0],
        ['Exceptions', 0],
        ['Awaiting approval', 0],
      ];
  if (page === 'reports') {
    return (
      <Screen title="Reports" back>
        {rows.map(([label, value]) => (
          <Card key={label}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
          </Card>
        ))}
      </Screen>
    );
  }
  return (
    <Screen title="Leadership" back>
      <Insights items={rows.slice(0, 3)} />
      <Text style={{ color: colors.textSecondary }}>Read only · {rows[3][1]} awaiting approval</Text>
    </Screen>
  );
}
