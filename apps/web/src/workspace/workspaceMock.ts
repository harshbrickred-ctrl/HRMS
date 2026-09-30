import { useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createInitialEssState,
  departments,
  employeeIdFor,
  ORGANIZATION,
  personForLogin,
  teams,
  type Holiday,
  type LeaveBalance,
  type Person,
} from '../ess/mock/essMock';

const seed = createInitialEssState();

export type InboxItem = {
  id: string;
  kind: 'Leave' | 'Attendance';
  person: string;
  personId: string;
  approverId: string;
  approverName: string;
  summary: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';
};

export type TeamException = {
  id: string;
  person: string;
  personId: string;
  approverId: string;
  date: string;
  issue: string;
};

export type ImportRow = {
  id: string;
  name: string;
  rows: number;
  at: string;
};

export type WorkflowItem = {
  name: string;
  steps: string;
  stuck: number;
};

export type AuditItem = {
  id: string;
  at: string;
  actor: string;
  action: string;
};

export type MailItem = {
  id: string;
  to: string;
  subject: string;
  status: 'Delivered' | 'Bounced' | 'Queued';
};

export type JobItem = {
  name: string;
  lastRun: string;
  status: 'Ok' | 'Retrying';
};

export const holidays: Holiday[] = seed.holidays;
export const leaveTypes: LeaveBalance[] = seed.leaveBalances;
export const companyDocs = seed.documents.filter((doc) => doc.owner === 'company');

export const teamExceptions: TeamException[] = [
  {
    id: 'te-1',
    person: 'Kabir Singh',
    personId: 'p-003',
    approverId: 'p-002',
    date: '15 Sep',
    issue: 'Missing out punch',
  },
  {
    id: 'te-2',
    person: 'Arjun Patel',
    personId: 'p-009',
    approverId: 'p-004',
    date: '8 Sep',
    issue: 'Absent without leave',
  },
];

export const workflows: WorkflowItem[] = [
  { name: 'Leave approval', steps: 'Team manager', stuck: 2 },
  { name: 'Attendance correction', steps: 'Team manager', stuck: 1 },
  { name: 'Document verification', steps: 'HR', stuck: 0 },
];

export const auditLog: AuditItem[] = [
  { id: 'a-1', at: '29 Sep, 09:12', actor: 'admin@peopleos.local', action: 'Signed in' },
  { id: 'a-2', at: '28 Sep, 16:40', actor: 'hr@peopleos.local', action: 'Exported leave balances' },
  { id: 'a-3', at: '22 Sep, 11:05', actor: 'manager@peopleos.local', action: 'Approved casual leave' },
];

export const mailHealth: MailItem[] = [
  { id: 'm-1', to: 'harsh.yadav@brickredsys.in', subject: 'Leave pending review', status: 'Delivered' },
  { id: 'm-2', to: 'kabir.singh@peopleos.local', subject: 'Attendance exception', status: 'Queued' },
  { id: 'm-3', to: 'old.address@example.com', subject: 'Password reset', status: 'Bounced' },
];

export const jobs: JobItem[] = [
  { name: 'Leave reminders', lastRun: '29 Sep, 08:00', status: 'Ok' },
  { name: 'Escalations', lastRun: '29 Sep, 08:05', status: 'Ok' },
  { name: 'Payroll export', lastRun: '28 Sep, 18:00', status: 'Retrying' },
];

type SettingsFlags = {
  smtp: boolean;
  retention: boolean;
  reminders: boolean;
};

type WorkspaceState = {
  inbox: InboxItem[];
  employees: Person[];
  imports: ImportRow[];
  settings: SettingsFlags;
};

let state: WorkspaceState = {
  inbox: [
    {
      id: 'lr-2',
      kind: 'Leave',
      person: 'Harsh Yadav',
      personId: 'p-001',
      approverId: 'p-002',
      approverName: 'Rohit Mehta',
      summary: 'Casual Leave · 28–29 Sep',
      status: 'Pending',
    },
    {
      id: 'cr-1',
      kind: 'Attendance',
      person: 'Harsh Yadav',
      personId: 'p-001',
      approverId: 'p-002',
      approverName: 'Rohit Mehta',
      summary: 'Correction · 15 Sep',
      status: 'Pending',
    },
    {
      id: 'in-1',
      kind: 'Leave',
      person: 'Kabir Singh',
      personId: 'p-003',
      approverId: 'p-002',
      approverName: 'Rohit Mehta',
      summary: 'Casual leave · 28–29 Sep',
      status: 'Pending',
    },
    {
      id: 'in-3',
      kind: 'Leave',
      person: 'Meera Iyer',
      personId: 'p-004',
      approverId: 'p-002',
      approverName: 'Rohit Mehta',
      summary: 'Earned leave · 6–8 Oct',
      status: 'Approved',
    },
    {
      id: 'tl-3',
      kind: 'Leave',
      person: 'Arjun Patel',
      personId: 'p-009',
      approverId: 'p-004',
      approverName: 'Meera Iyer',
      summary: 'Work from home · 1 Oct',
      status: 'Pending',
    },
  ],
  employees: seed.people.map((person) => ({ ...person })),
  imports: [],
  settings: { smtp: true, retention: true, reminders: false },
};

const listeners = new Set<() => void>();

function emit(next: WorkspaceState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function submitApproval(input: Omit<InboxItem, 'status'>) {
  emit({
    ...state,
    inbox: [{ ...input, status: 'Pending' }, ...state.inbox.filter((item) => item.id !== input.id)],
  });
}

export function setApprovalStatus(id: string, status: InboxItem['status']) {
  emit({
    ...state,
    inbox: state.inbox.map((item) => (item.id === id ? { ...item, status } : item)),
  });
}

export function useWorkspace() {
  const { user } = useAuth();
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  const me = personForLogin(user?.email, snapshot.employees);
  const myInbox = me ? snapshot.inbox.filter((item) => item.approverId === me.id) : [];
  const pending = snapshot.inbox.filter((item) => item.status === 'Pending');
  const myPending = myInbox.filter((item) => item.status === 'Pending');
  const onLeave = myInbox.filter((item) => item.kind === 'Leave' && item.status === 'Approved').length;
  const exceptions = me
    ? teamExceptions.filter((item) => item.approverId === me.id)
    : teamExceptions;
  const directReports = me
    ? snapshot.employees.filter((person) => person.managerId === me.id)
    : [];

  return {
    ...snapshot,
    me,
    myInbox,
    directReports,
    pending,
    myPending,
    onLeave,
    exceptions,
    headcount: snapshot.employees.length,
    decide(id: string, status: 'Approved' | 'Rejected') {
      setApprovalStatus(id, status);
    },
    addEmployee(input: { name: string; department: string; location: string; title: string }) {
      const department =
        departments.find((item) => item.name.toLowerCase() === input.department.trim().toLowerCase()) ??
        departments[0];
      const team = teams.find((item) => item.departmentId === department.id);
      const manager = team
        ? state.employees.find((person) => person.id === team.managerId)
        : undefined;
      const person: Person = {
        id: `p-local-${state.employees.length + 1}`,
        photo: '',
        employeeCode: employeeIdFor(state.employees.map((employee) => employee.employeeCode)),
        organizationId: ORGANIZATION.code,
        name: input.name.trim(),
        title: input.title.trim() || 'New joiner',
        department: department.name,
        location: input.location.trim() || 'Noida',
        workEmail: `${input.name.trim().toLowerCase().replace(/\s+/g, '.')}@peopleos.local`,
        workPhone: '—',
        teamId: team?.id,
        managerId: manager?.id,
        managerName: manager?.name,
      };
      emit({ ...state, employees: [person, ...state.employees] });
    },
    addImport(name: string) {
      emit({
        ...state,
        imports: [
          {
            id: `imp-${state.imports.length + 1}`,
            name,
            rows: 12,
            at: new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
          },
          ...state.imports,
        ],
      });
    },
    toggleSetting(key: keyof SettingsFlags) {
      emit({ ...state, settings: { ...state.settings, [key]: !state.settings[key] } });
    },
  };
}
