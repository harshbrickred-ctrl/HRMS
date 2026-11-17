import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { EmployeePhoto } from '../ess/components/EmployeePhoto';
import {
  assignableRoles,
  canAssignRole,
  rolesSeniorToActor,
} from './roleCatalog';
import {
  createHrEmployee,
  fetchHrEmployees,
  fetchHrOrg,
  fetchHrRoles,
  updateHrEmployee,
  type HrEmployee,
  type HrOrg,
  type HrRole,
} from './hrApi';
import { showToast } from '../ui/toast';
import './hr-master.css';

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
  bankName: string;
  ifscCode: string;
  bankAccountNumber: string;
  basic: string;
  hra: string;
  specialAllowance: string;
  statutoryBonus: string;
  dailyAllowance: string;
  gratuity: string;
  leaveEncashment: string;
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED';

const STEPS = ['Person', 'Placement', 'Bank', 'Salary', 'Access', 'Review'] as const;

const STEP_COPY = [
  'Name, work email, and the password you will share with them.',
  'Where they sit in the organization. You can leave a field unassigned.',
  'Bank name, IFSC and the account where salary is credited.',
  'Monthly salary structure. Basic is required. The other amounts can be zero.',
  'Roles decide which sections this account can open.',
  'Check the record, then create the account.',
];

const emptyDraft = (): Draft => ({
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
  bankName: '',
  ifscCode: '',
  bankAccountNumber: '',
  basic: '',
  hra: '',
  specialAllowance: '',
  statutoryBonus: '',
  dailyAllowance: '',
  gratuity: '',
  leaveEncashment: '',
});

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

function rupees(raw: string) {
  const value = amount(raw) ?? 0;
  return `₹${value.toLocaleString('en-IN')}`;
}

function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function incomplete(person: HrEmployee) {
  return !person.departmentId || !person.locationId || !person.designation.trim();
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
    bankName: person.bankName ?? '',
    ifscCode: person.ifscCode ?? '',
    bankAccountNumber: person.bankAccountNumber ?? '',
    basic: person.salary ? String(person.salary.basic) : '',
    hra: person.salary ? String(person.salary.hra) : '',
    specialAllowance: person.salary ? String(person.salary.special) : '',
    statutoryBonus: person.salary ? String(person.salary.statutoryBonus) : '',
    dailyAllowance: person.salary ? String(person.salary.dailyAllowance) : '',
    gratuity: person.salary ? String(person.salary.gratuity) : '',
    leaveEncashment: person.salary ? String(person.salary.leaveEncashment) : '',
  };
}

function amount(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function bankError(form: Draft, required: boolean) {
  const name = form.bankName.trim();
  const ifsc = form.ifscCode.trim().toUpperCase();
  const account = form.bankAccountNumber.replace(/\s/g, '');
  if (!required && !name && !ifsc && !account) return null;
  if (!name) return 'Enter the bank name.';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return 'Enter a valid 11-character IFSC code.';
  if (!/^\d{9,18}$/.test(account)) return 'Enter the bank account number, 9 to 18 digits.';
  return null;
}

function salaryError(form: Draft, required: boolean) {
  const fields: Array<[string, string]> = [
    ['Basic salary', form.basic],
    ['HRA', form.hra],
    ['Special allowance', form.specialAllowance],
    ['Statutory bonus', form.statutoryBonus],
    ['Daily allowance', form.dailyAllowance],
    ['Gratuity', form.gratuity],
    ['Leave encashment', form.leaveEncashment],
  ];
  for (const [label, raw] of fields) {
    if (raw.trim() && amount(raw) == null) return `${label} must be a whole number of rupees.`;
  }
  if (required && (amount(form.basic) ?? 0) <= 0) return 'Enter basic salary.';
  return null;
}

function payPayload(form: Draft) {
  return {
    bankName: form.bankName.trim(),
    ifscCode: form.ifscCode.trim().toUpperCase(),
    bankAccountNumber: form.bankAccountNumber.replace(/\s/g, ''),
    basic: amount(form.basic) ?? 0,
    hra: amount(form.hra) ?? 0,
    specialAllowance: amount(form.specialAllowance) ?? 0,
    statutoryBonus: amount(form.statutoryBonus) ?? 0,
    dailyAllowance: amount(form.dailyAllowance) ?? 0,
    gratuity: amount(form.gratuity) ?? 0,
    leaveEncashment: amount(form.leaveEncashment) ?? 0,
  };
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

export function HrEmployeesPage() {
  const { user } = useAuth();
  const [org, setOrg] = useState<HrOrg | null>(null);
  const [roles, setRoles] = useState<HrRole[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'directory' | 'add' | 'record'>('directory');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Draft>(emptyDraft);
  const [baseline, setBaseline] = useState('');
  const [step, setStep] = useState(0);
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
  const teams = useMemo(() => {
    const all = [...(org?.teams ?? [])].sort((left, right) =>
      `${left.departmentName} ${left.name}`.localeCompare(`${right.departmentName} ${right.name}`),
    );
    if (!form.departmentId) return all;
    const matched = all.filter((team) => team.departmentId === form.departmentId);
    const others = all.filter((team) => team.departmentId !== form.departmentId);
    return [...matched, ...others];
  }, [org, form.departmentId]);
  const managers = employees.filter(
    (person) =>
      person.id !== selectedId &&
      (person.roles ?? []).some((role) => role === 'MGR' || role === 'MANAGER'),
  );

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
    void reload().catch((err) => setError(messageOf(err)));
  }, []);

  function remember(next: Draft) {
    setForm(next);
    setBaseline(JSON.stringify(next));
  }

  function dirty() {
    return JSON.stringify(form) !== baseline;
  }

  function confirmLeave(prompt: string) {
    if (!dirty()) return true;
    return window.confirm(prompt);
  }

  function openDirectory() {
    setMode('directory');
    setSelectedId(null);
    setError(null);
  }

  function startAdd() {
    const next = emptyDraft();
    remember(next);
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
    const problem =
      step === 0
        ? personError(form, false)
        : step === 2
          ? bankError(form, true)
          : step === 3
            ? salaryError(form, true)
            : step === 4
              ? accessError(form)
              : null;
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
    const problem = personError(form, false) ?? bankError(form, true) ?? salaryError(form, true) ?? accessError(form);
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
        ...payPayload(form),
      });
      const rows = await reload();
      const fresh = rows.find((person) => person.id === created.id) ?? created;
      startRecord(fresh);
      setMessage(`Account created for ${fresh.email}. Employee code ${fresh.employeeCode}.`);
      showToast(`Account created for ${fresh.email}. Employee code ${fresh.employeeCode}.`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveRecord(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const problem = personError(form, true) ?? bankError(form, false) ?? salaryError(form, false) ?? accessError(form);
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
        ...payPayload(form),
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
          fullName(person),
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
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [departmentFilter, employees, incompleteOnly, query, statusFilter]);

  const activeCount = employees.filter((person) => person.status === 'ACTIVE').length;

  function labelOf(id: string, rows: Array<{ id: string; name: string }> | undefined) {
    return rows?.find((row) => row.id === id)?.name ?? 'Unassigned';
  }

  function roleNames(codes: string[]) {
    return codes
      .map((code) => roles.find((role) => role.code === code)?.name ?? code)
      .join(', ');
  }

  const fields = EmployeeFields({
    form,
    setForm,
    org,
    teams,
    managers,
    roles: visibleRoles,
    roleChangesLocked,
    emailLocked: mode === 'record',
    passwordRequired: mode === 'add',
    onToggleRole: toggleRole,
  });

  if (mode === 'add') {
    return (
      <div className="hr-master">
        <form
          className="hr-flow"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (step < STEPS.length - 1) advance();
            else void createAccount();
          }}
        >
          <div className="hr-flow-head">
            <button
              type="button"
              className="ess-btn"
              onClick={() => {
                if (confirmLeave('Leave this new member without creating the account?')) openDirectory();
              }}
            >
              Back to directory
            </button>
            <h2>Add member</h2>
            <p className="hr-flow-copy">{STEP_COPY[step]}</p>
          </div>
          <ol className="hr-steps">
            {STEPS.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  className={`hr-step${index === step ? ' is-current' : ''}${index < step ? ' is-done' : ''}`}
                  aria-current={index === step ? 'step' : undefined}
                  disabled={index > step}
                  onClick={() => {
                    if (index < step) {
                      setError(null);
                      setStep(index);
                    }
                  }}
                >
                  <span className="hr-step-index">Step {index + 1}</span>
                  <span className="hr-step-label">{label}</span>
                </button>
              </li>
            ))}
          </ol>
          <section className="hr-panel" aria-label={STEPS[step]}>
            {error ? (
              <p className="hr-alert" role="alert">
                {error}
              </p>
            ) : null}
            {step === 0 ? fields.person : null}
            {step === 1 ? fields.placement : null}
            {step === 2 ? fields.bank : null}
            {step === 3 ? fields.salary : null}
            {step === 4 ? fields.access : null}
            {step === 5 ? (
              <Review
                form={form}
                department={labelOf(form.departmentId, org?.departments)}
                location={labelOf(form.locationId, org?.locations)}
                team={labelOf(form.teamId, org?.teams)}
                manager={
                  managers.find((person) => person.id === form.managerId)
                    ? fullName(managers.find((person) => person.id === form.managerId)!)
                    : 'No manager'
                }
                roles={roleNames(form.roleCodes)}
              />
            ) : null}
          </section>
          <div className="hr-flow-actions">
            <button
              type="button"
              className="ess-btn"
              onClick={() => {
                if (confirmLeave('Leave this new member without creating the account?')) openDirectory();
              }}
            >
              Cancel
            </button>
            <div className="hr-flow-actions-end">
              {step > 0 ? (
                <button
                  type="button"
                  className="ess-btn"
                  onClick={() => {
                    setError(null);
                    setStep((current) => current - 1);
                  }}
                >
                  Back
                </button>
              ) : null}
              <button type="submit" className="ess-btn ess-btn-primary" disabled={submitting}>
                {step < STEPS.length - 1 ? 'Continue' : submitting ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (mode === 'record' && selected) {
    return (
      <div className="hr-master">
        <form className="hr-record" noValidate onSubmit={(event) => void saveRecord(event)}>
          <div className="hr-record-head">
            <button
              type="button"
              className="ess-btn"
              onClick={() => {
                if (confirmLeave('Leave without saving changes to this member?')) openDirectory();
              }}
            >
              Back to directory
            </button>
            <h2>{fullName(form) || fullName(selected)}</h2>
            <p className="hr-record-meta">
              {selected.employeeCode}
              {form.designation ? ` · ${form.designation}` : ''}
              {form.email ? ` · ${form.email}` : ''}
            </p>
          </div>
          {error ? (
            <p className="hr-alert" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="hr-status-note" role="status">
              {message}
            </p>
          ) : null}
          <div className="hr-sections">
            <section className="hr-panel hr-section">
              <h3>Person</h3>
              {fields.person}
            </section>
            <section className="hr-panel hr-section">
              <h3>Placement</h3>
              {fields.placement}
            </section>
            <section className="hr-panel hr-section">
              <h3>Bank</h3>
              {fields.bank}
            </section>
            <section className="hr-panel hr-section">
              <h3>Salary structure</h3>
              {fields.salary}
            </section>
            <section className="hr-panel hr-section">
              <h3>Access</h3>
              {fields.access}
            </section>
          </div>
          <div className="hr-record-actions">
            <button
              type="button"
              className="ess-btn"
              onClick={() => {
                if (confirmLeave('Leave without saving changes to this member?')) openDirectory();
              }}
            >
              Cancel
            </button>
            <div className="hr-record-actions-end">
              <button type="submit" className="ess-btn ess-btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save member'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="hr-master">
      <div className="hr-master-bar">
        <p className="hr-master-lead">
          {ready
            ? `${employees.length} people · ${activeCount} active. Search, filter, or add a member.`
            : 'Loading the employee directory…'}
        </p>
        <button type="button" className="ess-btn ess-btn-primary" onClick={startAdd}>
          Add member
        </button>
      </div>
      {error ? (
        <p className="hr-alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hr-master-filters">
        <input
          className="hr-master-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, or code"
          aria-label="Search employees"
        />
        <select
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {org?.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <div className="hr-segment" role="group" aria-label="Filter by account status">
          {(
            [
              ['ALL', 'All'],
              ['ACTIVE', 'Active'],
              ['DISABLED', 'Inactive'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="hr-check">
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(event) => setIncompleteOnly(event.target.checked)}
          />
          Incomplete only
        </label>
      </div>
      <section className="ess-panel hr-master-table">
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Employee id</th>
                <th>Department</th>
                <th>Location</th>
                <th>Team</th>
                <th>Manager</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => (
                <tr
                  key={person.id}
                  tabIndex={0}
                  onClick={() => startRecord(person)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      startRecord(person);
                    }
                  }}
                >
                  <td data-label="Member">
                    <span className="hr-person">
                      <EmployeePhoto src={person.photo} name={fullName(person)} size="sm" />
                      <span className="hr-person-copy">
                        <strong>{fullName(person)}</strong>
                        <span>{person.designation || person.email}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Employee id">{person.employeeCode}</td>
                  <td data-label="Department">{person.departmentName ?? '—'}</td>
                  <td data-label="Location">{person.locationName ?? '—'}</td>
                  <td data-label="Team">{person.teamName ?? '—'}</td>
                  <td data-label="Manager">{person.managerName ?? '—'}</td>
                  <td data-label="Status">
                    <span className="hr-status">
                      <span
                        className={`ess-chip ${person.status === 'ACTIVE' ? 'ess-chip-approved' : 'ess-chip-withdrawn'}`}
                      >
                        {person.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                      {incomplete(person) ? (
                        <span className="ess-chip ess-chip-pendingcorrection">Incomplete</span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ready && filtered.length === 0 ? (
            <p className="hr-empty">No members match these filters.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function EmployeeFields({
  form,
  setForm,
  org,
  teams,
  managers,
  roles,
  roleChangesLocked,
  emailLocked,
  passwordRequired,
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
  onToggleRole: (code: string) => void;
}) {
  return {
    person: (
      <div className="hr-grid">
        <TextField
          id="emp-first"
          label="First name"
          value={form.firstName}
          required
          onChange={(value) => setForm((current) => ({ ...current, firstName: value }))}
        />
        <TextField
          id="emp-last"
          label="Last name"
          value={form.lastName}
          required
          onChange={(value) => setForm((current) => ({ ...current, lastName: value }))}
        />
        <TextField
          id="emp-email"
          label="Work email"
          type="email"
          value={form.email}
          required
          disabled={emailLocked}
          wide
          onChange={(value) => setForm((current) => ({ ...current, email: value }))}
        />
        <PasswordField
          id="emp-password"
          label={passwordRequired ? 'Password' : 'New password'}
          value={form.password}
          required={passwordRequired}
          hint={
            passwordRequired
              ? 'At least 8 characters. Share it with the employee so they can sign in.'
              : 'Leave blank to keep the current password.'
          }
          onChange={(value) => setForm((current) => ({ ...current, password: value }))}
        />
        <TextField
          id="emp-title"
          label="Designation"
          value={form.designation}
          onChange={(value) => setForm((current) => ({ ...current, designation: value }))}
        />
      </div>
    ),
    placement: (
      <div className="hr-grid">
        <SelectField
          id="emp-dept"
          label="Department"
          value={form.departmentId}
          onChange={(value) => setForm((current) => ({ ...current, departmentId: value, teamId: '' }))}
        >
          <option value="">Unassigned</option>
          {org?.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="emp-loc"
          label="Location"
          value={form.locationId}
          onChange={(value) => setForm((current) => ({ ...current, locationId: value }))}
        >
          <option value="">Unassigned</option>
          {org?.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="emp-team"
          label="Team"
          value={form.teamId}
          hint={
            teams.length
              ? 'Every team is listed with its department. Choosing a team sets that department.'
              : 'No teams yet. Add a team in Organization, inside a department.'
          }
          onChange={(value) => {
            const team = teams.find((item) => item.id === value);
            setForm((current) => ({
              ...current,
              teamId: value,
              departmentId: team?.departmentId || current.departmentId,
            }));
          }}
        >
          <option value="">Unassigned</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name} · {team.departmentName}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="emp-manager"
          label="Manager"
          value={form.managerId}
          onChange={(value) => setForm((current) => ({ ...current, managerId: value }))}
        >
          <option value="">No manager</option>
          {managers.map((person) => (
            <option key={person.id} value={person.id}>
              {fullName(person)}
            </option>
          ))}
        </SelectField>
      </div>
    ),
    bank: (
      <div className="hr-grid">
        <TextField
          id="emp-bank"
          label="Bank name"
          value={form.bankName}
          required
          onChange={(value) => setForm((current) => ({ ...current, bankName: value }))}
        />
        <TextField
          id="emp-ifsc"
          label="IFSC code"
          value={form.ifscCode}
          required
          onChange={(value) => setForm((current) => ({ ...current, ifscCode: value.toUpperCase() }))}
        />
        <TextField
          id="emp-account"
          label="Bank account number"
          value={form.bankAccountNumber}
          required
          wide
          onChange={(value) => setForm((current) => ({ ...current, bankAccountNumber: value }))}
        />
      </div>
    ),
    salary: (
      <div className="hr-grid">
        <TextField
          id="emp-basic"
          label="Basic salary"
          value={form.basic}
          required
          onChange={(value) => setForm((current) => ({ ...current, basic: value }))}
        />
        <TextField
          id="emp-hra"
          label="HRA"
          value={form.hra}
          onChange={(value) => setForm((current) => ({ ...current, hra: value }))}
        />
        <TextField
          id="emp-special"
          label="Special allowance"
          value={form.specialAllowance}
          onChange={(value) => setForm((current) => ({ ...current, specialAllowance: value }))}
        />
        <TextField
          id="emp-bonus"
          label="Statutory bonus"
          value={form.statutoryBonus}
          onChange={(value) => setForm((current) => ({ ...current, statutoryBonus: value }))}
        />
        <TextField
          id="emp-daily"
          label="Daily allowance"
          value={form.dailyAllowance}
          onChange={(value) => setForm((current) => ({ ...current, dailyAllowance: value }))}
        />
        <TextField
          id="emp-gratuity"
          label="Gratuity"
          value={form.gratuity}
          onChange={(value) => setForm((current) => ({ ...current, gratuity: value }))}
        />
        <TextField
          id="emp-leave"
          label="Leave encashment"
          value={form.leaveEncashment}
          onChange={(value) => setForm((current) => ({ ...current, leaveEncashment: value }))}
        />
        <p className="hr-hint is-wide">
          Amounts are monthly rupees. Blank means zero. Monthly gross is basic, HRA, special allowance, statutory bonus, and daily allowance.
          Gratuity and leave encashment are not added to that gross.
        </p>
      </div>
    ),
    access: (
      <div className="hr-grid">
        <fieldset className="hr-roles is-wide" disabled={roleChangesLocked}>
          <legend>Roles</legend>
          {roles.map((role) => (
            <label key={role.code} className="hr-role">
              <input
                type="checkbox"
                checked={form.roleCodes.includes(role.code)}
                onChange={() => onToggleRole(role.code)}
                disabled={roleChangesLocked}
              />
              <span>{role.name}</span>
            </label>
          ))}
        </fieldset>
        <SelectField
          id="emp-status"
          label="Account"
          value={form.status}
          onChange={(value) =>
            setForm((current) => ({ ...current, status: value as Draft['status'] }))
          }
        >
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Inactive</option>
        </SelectField>
      </div>
    ),
  };
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  disabled,
  wide,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`ess-field${wide ? ' is-wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  required,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="ess-field">
      <label htmlFor={id}>{label}</label>
      <div className="hr-password">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          required={required}
          minLength={required || value ? 8 : undefined}
          autoComplete="new-password"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="hr-password-toggle"
          onClick={() => setShow((open) => !open)}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="hr-hint">{hint}</p>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  hint,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="ess-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      {hint ? <p className="hr-hint">{hint}</p> : null}
    </div>
  );
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
  const rows: Array<[string, string]> = [
    ['Name', fullName(form)],
    ['Email', form.email.trim()],
    ['Designation', form.designation.trim() || 'Not set'],
    ['Department', department],
    ['Location', location],
    ['Team', team],
    ['Manager', manager],
    ['Roles', roles || 'None'],
    ['Account', form.status === 'ACTIVE' ? 'Active' : 'Inactive'],
    ['Bank', form.bankName.trim() || 'Not set'],
    ['IFSC', form.ifscCode.trim().toUpperCase() || 'Not set'],
    ['Account number', form.bankAccountNumber.replace(/\s/g, '') || 'Not set'],
    ['Basic salary', rupees(form.basic)],
    ['HRA', rupees(form.hra)],
    ['Special allowance', rupees(form.specialAllowance)],
    ['Statutory bonus', rupees(form.statutoryBonus)],
    ['Daily allowance', rupees(form.dailyAllowance)],
    ['Gratuity', rupees(form.gratuity)],
    ['Leave encashment', rupees(form.leaveEncashment)],
    ['Password', 'Will be set on this account'],
  ];
  return (
    <>
      <ul className="hr-review">
        {rows.map(([label, value]) => (
          <li key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </li>
        ))}
      </ul>
      <p className="hr-hint">The employee code is assigned when the account is created.</p>
    </>
  );
}
