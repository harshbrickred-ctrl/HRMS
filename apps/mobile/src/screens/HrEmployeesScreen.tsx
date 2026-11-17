import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, useColorScheme, View } from 'react-native';
import {
  Avatar,
  Card,
  CheckRow,
  EmptyNote,
  Field,
  GhostButton,
  PrimaryButton,
  Screen,
  Segmented,
  SelectField,
  StatusChip,
} from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import {
  assignableRoles,
  canAssignRole,
  rolesSeniorToActor,
} from '@/lib/roleCatalog';
import { showToast } from '@/lib/toast';
import {
  createHrEmployee,
  fetchHrEmployees,
  fetchHrOrg,
  fetchHrRoles,
  personName,
  updateHrEmployee,
  type HrEmployee,
  type HrOrg,
  type HrRole,
} from '@/lib/hrApi';

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  designation: string;
  roleCodes: string[];
  departmentId: string;
  locationId: string;
  teamId: string;
  managerId: string;
  status: 'ACTIVE' | 'DISABLED';
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED';
type Mode = 'directory' | 'add' | 'record';

const STEPS = ['Person', 'Placement', 'Access', 'Review'] as const;
const STEP_COPY = [
  'Name, work email, and the password you will share with them.',
  'Where they sit in the organization. You can leave a field unassigned.',
  'Roles decide which sections this account can open.',
  'Check the record, then create the account.',
];

function emptyDraft(): Draft {
  return {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    designation: '',
    roleCodes: ['EMP'],
    departmentId: '',
    locationId: '',
    teamId: '',
    managerId: '',
    status: 'ACTIVE',
  };
}

function draftFrom(person: HrEmployee): Draft {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    password: '',
    designation: person.designation,
    roleCodes: person.roles,
    departmentId: person.departmentId ?? '',
    locationId: person.locationId ?? '',
    teamId: person.teamId ?? '',
    managerId: person.managerId ?? '',
    status: person.status,
  };
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function incomplete(person: HrEmployee) {
  return !person.departmentId || !person.locationId || !person.designation.trim();
}

function personError(form: Draft, editing: boolean) {
  if (!form.firstName.trim() || !form.lastName.trim()) return 'Enter a first and last name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid work email.';
  if (!editing && form.password.length < 8) return 'Password must be at least 8 characters.';
  if (editing && form.password && form.password.length < 8) {
    return 'A new password must be at least 8 characters.';
  }
  return null;
}

function accessError(form: Draft) {
  if (!form.roleCodes.length) return 'Choose at least one role.';
  return null;
}

export function HrEmployees() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const { user } = useAuth();
  const [org, setOrg] = useState<HrOrg | null>(null);
  const [roles, setRoles] = useState<HrRole[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>('directory');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Draft>(emptyDraft);
  const [baseline, setBaseline] = useState('');
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [query, setQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = employees.find((person) => person.id === selectedId) ?? null;
  const actorRoles = user?.roles ?? [];
  const visibleRoles = useMemo(
    () => assignableRoles(actorRoles, roles),
    [actorRoles, roles],
  );
  const roleChangesLocked = rolesSeniorToActor(actorRoles, form.roleCodes).length > 0;
  const teams = useMemo(
    () => org?.teams.filter((team) => team.departmentId === form.departmentId) ?? [],
    [org, form.departmentId],
  );
  const managers = employees.filter(
    (person) =>
      person.id !== selectedId &&
      (person.roles ?? []).some((role) => role === 'MGR' || role === 'MANAGER'),
  );
  const activeCount = employees.filter((person) => person.status === 'ACTIVE').length;

  async function reload() {
    const [nextOrg, nextRoles, nextEmployees] = await Promise.all([
      fetchHrOrg(),
      fetchHrRoles(),
      fetchHrEmployees(),
    ]);
    setOrg(nextOrg);
    setRoles(nextRoles);
    setEmployees(nextEmployees);
    setReady(true);
    return nextEmployees;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [peopleResult, orgResult, roleResult] = await Promise.allSettled([
        fetchHrEmployees(),
        fetchHrOrg(),
        fetchHrRoles(),
      ]);
      if (cancelled) return;
      const problems: string[] = [];
      if (peopleResult.status === 'fulfilled') {
        setEmployees(Array.isArray(peopleResult.value) ? peopleResult.value : []);
      } else {
        problems.push(messageOf(peopleResult.reason));
      }
      if (orgResult.status === 'fulfilled') setOrg(orgResult.value);
      else problems.push(messageOf(orgResult.reason));
      if (roleResult.status === 'fulfilled') {
        setRoles(Array.isArray(roleResult.value) ? roleResult.value : []);
      } else {
        problems.push(messageOf(roleResult.reason));
      }
      setError(problems[0] ?? null);
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function remember(next: Draft) {
    setForm(next);
    setBaseline(JSON.stringify(next));
    setShowPassword(false);
  }

  function dirty() {
    return JSON.stringify(form) !== baseline;
  }

  function confirmLeave(prompt: string, next: () => void) {
    if (!dirty()) {
      next();
      return;
    }
    Alert.alert('Leave this form?', prompt, [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: next },
    ]);
  }

  function openDirectory() {
    setMode('directory');
    setSelectedId(null);
    setError(null);
  }

  function startAdd() {
    remember(emptyDraft());
    setSelectedId(null);
    setStep(0);
    setError(null);
    setMessage(null);
    setMode('add');
  }

  function startRecord(person: HrEmployee) {
    remember(draftFrom(person));
    setSelectedId(person.id);
    setError(null);
    setMessage(null);
    setMode('record');
  }

  function toggleRole(code: string) {
    if (!canAssignRole(actorRoles, code)) return;
    setForm((current) => ({
      ...current,
      roleCodes: current.roleCodes.includes(code)
        ? current.roleCodes.filter((item) => item !== code)
        : [...current.roleCodes, code],
    }));
  }

  function advance() {
    const problem = step === 0 ? personError(form, false) : step === 2 ? accessError(form) : null;
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function placement() {
    return {
      departmentId: form.departmentId || null,
      locationId: form.locationId || null,
      teamId: form.teamId || null,
      managerId: form.managerId || null,
    };
  }

  async function createAccount() {
    const problem = personError(form, false) ?? accessError(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createHrEmployee({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        designation: form.designation.trim(),
        roleCodes: form.roleCodes,
        departmentId: form.departmentId || undefined,
        locationId: form.locationId || undefined,
        teamId: form.teamId || undefined,
        managerId: form.managerId || undefined,
        status: form.status,
      });
      const rows = await reload();
      const fresh = rows.find((person) => person.id === created.id) ?? created;
      startRecord(fresh);
      setMessage(`Account created for ${fresh.email}. Employee code ${fresh.employeeCode}.`);
      showToast(`Account created for ${fresh.email}.`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveRecord() {
    if (!selected) return;
    const problem = personError(form, true) ?? accessError(form);
    if (problem) {
      setError(problem);
      setMessage(null);
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateHrEmployee(selected.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        designation: form.designation.trim(),
        ...(roleChangesLocked ? {} : { roleCodes: form.roleCodes }),
        ...placement(),
        status: form.status,
        password: form.password.trim() || undefined,
      });
      const rows = await reload();
      const fresh = rows.find((person) => person.id === updated.id) ?? updated;
      startRecord(fresh);
      setMessage('Employee saved.');
      showToast('Employee saved.');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter((person) => {
        if (statusFilter !== 'ALL' && person.status !== statusFilter) return false;
        if (departmentFilter && person.departmentId !== departmentFilter) return false;
        if (incompleteOnly && !incomplete(person)) return false;
        if (!q) return true;
        return [
          personName(person),
          person.email,
          person.employeeCode,
          person.designation,
          person.departmentName ?? '',
          person.locationName ?? '',
          person.managerName ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => personName(a).localeCompare(personName(b)));
  }, [departmentFilter, employees, incompleteOnly, query, statusFilter]);

  function labelOf(id: string, rows: Array<{ id: string; name: string }> | undefined) {
    return rows?.find((row) => row.id === id)?.name ?? 'Unassigned';
  }

  function roleNames(codes: string[]) {
    return codes.map((code) => roles.find((role) => role.code === code)?.name ?? code).join(', ');
  }

  const fields = useEmployeeFields({
    form,
    setForm,
    org,
    teams,
    managers,
    roles: visibleRoles,
    roleChangesLocked,
    emailLocked: mode === 'record',
    passwordRequired: mode === 'add',
    showPassword,
    onTogglePassword: () => setShowPassword((open) => !open),
    onToggleRole: toggleRole,
  });

  if (mode === 'add') {
    return (
      <Screen title="Add member" back>
        <GhostButton
          label="Back to directory"
          onPress={() =>
            confirmLeave('Leave this new member without creating the account?', openDirectory)
          }
        />
        <Text style={{ color: colors.textSecondary }}>{STEP_COPY[step]}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {STEPS.map((label, index) => {
            const current = index === step;
            const done = index < step;
            return (
              <Pressable
                key={label}
                disabled={index > step}
                onPress={() => {
                  if (index < step) {
                    setError(null);
                    setStep(index);
                  }
                }}
                style={{
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: current || done ? brand.primary : colors.card,
                  borderWidth: 1,
                  borderColor: current || done ? brand.primary : colors.border,
                  opacity: index > step ? 0.45 : 1,
                }}
              >
                <Text style={{ color: current || done ? brand.primaryInk : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                  Step {index + 1}
                </Text>
                <Text style={{ color: current || done ? brand.primaryInk : colors.text, fontWeight: '800' }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
        {step === 0 ? fields.person : null}
        {step === 1 ? fields.placement : null}
        {step === 2 ? fields.access : null}
        {step === 3 ? (
          <Review
            form={form}
            department={labelOf(form.departmentId, org?.departments)}
            location={labelOf(form.locationId, org?.locations)}
            team={labelOf(form.teamId, org?.teams)}
            manager={
              managers.find((person) => person.id === form.managerId)
                ? personName(managers.find((person) => person.id === form.managerId)!)
                : 'No manager'
            }
            roles={roleNames(form.roleCodes)}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {step > 0 ? (
            <View style={{ flex: 1 }}>
              <GhostButton
                label="Back"
                onPress={() => {
                  setError(null);
                  setStep((current) => current - 1);
                }}
              />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <GhostButton
                label="Cancel"
                onPress={() =>
                  confirmLeave('Leave this new member without creating the account?', openDirectory)
                }
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label={step < STEPS.length - 1 ? 'Continue' : submitting ? 'Creating…' : 'Create account'}
              disabled={submitting}
              onPress={() => {
                if (step < STEPS.length - 1) advance();
                else void createAccount();
              }}
            />
          </View>
        </View>
      </Screen>
    );
  }

  if (mode === 'record' && selected) {
    return (
      <Screen title={personName(form) || personName(selected)} back>
        <GhostButton
          label="Back to directory"
          onPress={() => confirmLeave('Leave without saving changes to this member?', openDirectory)}
        />
        <Text style={{ color: colors.textSecondary }}>
          {selected.employeeCode}
          {form.designation ? ` · ${form.designation}` : ''}
          {form.email ? ` · ${form.email}` : ''}
        </Text>
        {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
        {message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Person</Text>
        {fields.person}
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Placement</Text>
        {fields.placement}
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Access</Text>
        {fields.access}
        <PrimaryButton
          label={submitting ? 'Saving…' : 'Save member'}
          disabled={submitting}
          onPress={() => void saveRecord()}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Employees" back>
      <Text style={{ color: colors.textSecondary }}>
        {ready
          ? `${employees.length} people · ${activeCount} active. Search, filter, or add a member.`
          : 'Loading the employee directory…'}
      </Text>
      <PrimaryButton label="Add member" onPress={startAdd} />
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      <Field
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="Search name, email, or code"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <SelectField
        label="Department"
        value={departmentFilter}
        onChange={setDepartmentFilter}
        options={[
          { value: '', label: 'All departments' },
          ...(org?.departments.map((department) => ({ value: department.id, label: department.name })) ?? []),
        ]}
      />
      {ready && !org ? (
        <Text style={{ color: brand.danger }}>Departments could not be loaded.</Text>
      ) : null}
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
        Members · {filtered.length}
      </Text>
      <Segmented
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          ['ALL', 'All'],
          ['ACTIVE', 'Active'],
          ['DISABLED', 'Inactive'],
        ]}
      />
      <CheckRow label="Incomplete only" value={incompleteOnly} onChange={setIncompleteOnly} />
      {ready && filtered.length === 0 ? <EmptyNote text="No members match these filters." /> : null}
      {filtered.map((person) => (
        <Pressable key={person.id} onPress={() => startRecord(person)}>
          <Card>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Avatar name={personName(person)} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{personName(person)}</Text>
                <Text style={{ color: colors.textSecondary }}>{person.designation || person.email}</Text>
              </View>
            </View>
            <Text style={{ color: colors.text }}>{person.employeeCode}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {person.departmentName ?? '—'} · {person.locationName ?? '—'}
            </Text>
            <Text style={{ color: colors.textSecondary }}>Manager · {person.managerName ?? '—'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <StatusChip
                status={person.status === 'ACTIVE' ? 'approved' : 'withdrawn'}
                label={person.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              />
              {incomplete(person) ? <StatusChip status="pending" label="Incomplete" /> : null}
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

function useEmployeeFields({
  form,
  setForm,
  org,
  teams,
  managers,
  roles,
  roleChangesLocked,
  emailLocked,
  passwordRequired,
  showPassword,
  onTogglePassword,
  onToggleRole,
}: {
  form: Draft;
  setForm: (update: (current: Draft) => Draft) => void;
  org: HrOrg | null;
  teams: HrOrg['teams'];
  managers: HrEmployee[];
  roles: HrRole[];
  roleChangesLocked: boolean;
  emailLocked: boolean;
  passwordRequired: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
  onToggleRole: (code: string) => void;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const person = (
    <Card>
      <Field
        label="First name"
        value={form.firstName}
        onChangeText={(value) => setForm((current) => ({ ...current, firstName: value }))}
      />
      <Field
        label="Last name"
        value={form.lastName}
        onChangeText={(value) => setForm((current) => ({ ...current, lastName: value }))}
      />
      <Field
        label="Work email"
        value={form.email}
        editable={!emailLocked}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={(value) => setForm((current) => ({ ...current, email: value }))}
      />
      <Field
        label={passwordRequired ? 'Password' : 'New password'}
        value={form.password}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(value) => setForm((current) => ({ ...current, password: value }))}
      />
      <GhostButton label={showPassword ? 'Hide password' : 'Show password'} onPress={onTogglePassword} />
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
        {passwordRequired
          ? 'At least 8 characters. Share it with the employee so they can sign in.'
          : 'Leave blank to keep the current password.'}
      </Text>
      <Field
        label="Designation"
        value={form.designation}
        onChangeText={(value) => setForm((current) => ({ ...current, designation: value }))}
      />
    </Card>
  );
  const placement = (
    <Card>
      <SelectField
        label="Department"
        value={form.departmentId}
        onChange={(value) => setForm((current) => ({ ...current, departmentId: value, teamId: '' }))}
        options={[
          { value: '', label: 'Unassigned' },
          ...(org?.departments.map((department) => ({ value: department.id, label: department.name })) ?? []),
        ]}
      />
      <SelectField
        label="Location"
        value={form.locationId}
        onChange={(value) => setForm((current) => ({ ...current, locationId: value }))}
        options={[
          { value: '', label: 'Unassigned' },
          ...(org?.locations.map((location) => ({ value: location.id, label: location.name })) ?? []),
        ]}
      />
      <SelectField
        label="Team"
        value={form.teamId}
        onChange={(value) => setForm((current) => ({ ...current, teamId: value }))}
        options={[
          { value: '', label: 'Unassigned' },
          ...teams.map((team) => ({ value: team.id, label: team.name })),
        ]}
      />
      {form.departmentId ? null : (
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Choose a department to see its teams.</Text>
      )}
      <SelectField
        label="Manager"
        value={form.managerId}
        onChange={(value) => setForm((current) => ({ ...current, managerId: value }))}
        options={[
          { value: '', label: 'No manager' },
          ...managers.map((person) => ({ value: person.id, label: personName(person) })),
        ]}
      />
    </Card>
  );
  const access = (
    <Card>
      <Text style={{ color: colors.text, fontWeight: '800' }}>Roles</Text>
      {roles.map((role) => (
        <CheckRow
          key={role.code}
          label={role.name}
          value={form.roleCodes.includes(role.code)}
          onChange={() => onToggleRole(role.code)}
          disabled={roleChangesLocked}
        />
      ))}
      <SelectField
        label="Account"
        value={form.status}
        onChange={(value) => setForm((current) => ({ ...current, status: value as Draft['status'] }))}
        options={[
          { value: 'ACTIVE', label: 'Active' },
          { value: 'DISABLED', label: 'Inactive' },
        ]}
      />
    </Card>
  );
  return { person, placement, access };
}

function Review({
  form,
  department,
  location,
  team,
  manager,
  roles,
}: {
  form: Draft;
  department: string;
  location: string;
  team: string;
  manager: string;
  roles: string;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const rows: Array<[string, string]> = [
    ['Name', personName(form)],
    ['Email', form.email.trim()],
    ['Designation', form.designation.trim() || 'Not set'],
    ['Department', department],
    ['Location', location],
    ['Team', team],
    ['Manager', manager],
    ['Roles', roles || 'None'],
    ['Account', form.status === 'ACTIVE' ? 'Active' : 'Inactive'],
    ['Password', 'Will be set on this account'],
  ];
  return (
    <Card>
      {rows.map(([label, value]) => (
        <View key={label} style={{ gap: 2 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{label}</Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
        </View>
      ))}
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
        The employee code is assigned when the account is created.
      </Text>
    </Card>
  );
}
