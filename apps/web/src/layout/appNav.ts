import {
  ADMIN_ROLES,
  FINANCE_ROLES,
  HR_ROLES,
  IT_ROLES,
  LEADERSHIP_ROLES,
  MANAGER_ROLES,
  userHasAnyRole,
} from '../workspace/roleCatalog';

export type NavIconId =
  | 'home'
  | 'leave'
  | 'attendance'
  | 'people'
  | 'myTeam'
  | 'documents'
  | 'profile'
  | 'permissions'
  | 'salary'
  | 'notifications'
  | 'helpdesk'
  | 'assets'
  | 'overview'
  | 'inbox'
  | 'teamLeave'
  | 'teamAttendance'
  | 'teamDirectory'
  | 'employees'
  | 'organization'
  | 'leaveAdmin'
  | 'attendanceAdmin'
  | 'hrDocuments'
  | 'workflows'
  | 'reports'
  | 'migration'
  | 'roles'
  | 'audit'
  | 'adminNotifications'
  | 'settings'
  | 'jobs'
  | 'leadership'
  | 'leadershipReports';

export type NavItem = {
  to: string;
  label: string;
  icon: NavIconId;
  end?: boolean;
};

export type NavSectionId =
  | 'overview'
  | 'time'
  | 'pay'
  | 'workplace'
  | 'account'
  | 'support'
  | 'it-assets'
  | 'team-approvals'
  | 'team-time'
  | 'team-directory'
  | 'hr-people'
  | 'hr-time'
  | 'hr-programs'
  | 'admin-access'
  | 'admin-platform'
  | 'leadership'
  | 'finance';

export type NavEmphasis = 'subtle' | 'clear';

export type NavSection = {
  id: NavSectionId;
  label: string;
  emphasis: NavEmphasis;
  /** Empty = always visible for authenticated users */
  roles: string[];
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    emphasis: 'subtle',
    roles: [],
    items: [{ to: '/ess', label: 'Home', icon: 'home', end: true }],
  },
  {
    id: 'time',
    label: 'Time',
    emphasis: 'subtle',
    roles: [],
    items: [
      { to: '/ess/attendance', label: 'Attendance', icon: 'attendance' },
      { to: '/ess/leave', label: 'Leave', icon: 'leave' },
    ],
  },
  {
    id: 'pay',
    label: 'Pay',
    emphasis: 'subtle',
    roles: [],
    items: [
      { to: '/ess/salary', label: 'My Payout', icon: 'salary' },
      { to: '/ess/reimbursements', label: 'Reimbursement', icon: 'documents' },
    ],
  },
  {
    id: 'workplace',
    label: 'Workplace',
    emphasis: 'subtle',
    roles: [],
    items: [
      { to: '/ess/documents', label: 'My Document', icon: 'documents' },
      { to: '/ess/assets', label: 'My Assets', icon: 'assets' },
      { to: '/ess/people', label: 'People', icon: 'people' },
      { to: '/ess/team', label: 'My Team', icon: 'myTeam' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    emphasis: 'subtle',
    roles: [],
    items: [
      { to: '/ess/profile', label: 'Profile', icon: 'profile' },
      { to: '/ess/permissions', label: 'My permissions', icon: 'permissions' },
      { to: '/ess/notifications', label: 'Notifications', icon: 'notifications' },
      { to: '/ess/settings', label: 'Settings', icon: 'settings' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    emphasis: 'subtle',
    roles: [],
    items: [{ to: '/ess/helpdesk', label: 'Helpdesk', icon: 'helpdesk' }],
  },
  {
    id: 'team-approvals',
    label: 'Approvals',
    emphasis: 'clear',
    roles: [...MANAGER_ROLES],
    items: [
      { to: '/manager', label: 'Overview', icon: 'overview', end: true },
      { to: '/manager/inbox', label: 'Inbox', icon: 'inbox' },
    ],
  },
  {
    id: 'team-time',
    label: 'Time',
    emphasis: 'clear',
    roles: [...MANAGER_ROLES],
    items: [
      { to: '/manager/team-leave', label: 'Team Leave', icon: 'teamLeave' },
      {
        to: '/manager/team-attendance',
        label: 'Team Attendance',
        icon: 'teamAttendance',
      },
    ],
  },
  {
    id: 'team-directory',
    label: 'Directory',
    emphasis: 'clear',
    roles: [...MANAGER_ROLES],
    items: [
      {
        to: '/manager/directory',
        label: 'Team Directory',
        icon: 'teamDirectory',
      },
    ],
  },
  {
    id: 'hr-people',
    label: 'People',
    emphasis: 'clear',
    roles: [...HR_ROLES],
    items: [
      { to: '/hr', label: 'Overview', icon: 'overview', end: true },
      { to: '/hr/employees', label: 'Employees', icon: 'employees' },
      { to: '/hr/salary', label: 'Salary', icon: 'salary' },
      { to: '/hr/organization', label: 'Organization', icon: 'organization' },
      { to: '/hr/directory', label: 'Team Directory', icon: 'teamDirectory' },
    ],
  },
  {
    id: 'hr-time',
    label: 'Time',
    emphasis: 'clear',
    roles: [...HR_ROLES],
    items: [
      { to: '/hr/leave', label: 'Leave Admin', icon: 'leaveAdmin' },
      {
        to: '/hr/attendance',
        label: 'Attendance Admin',
        icon: 'attendanceAdmin',
      },
    ],
  },
  {
    id: 'hr-programs',
    label: 'Programs',
    emphasis: 'clear',
    roles: [...HR_ROLES],
    items: [
      { to: '/hr/documents', label: 'Document Center', icon: 'hrDocuments' },
      { to: '/hr/tax', label: 'Tax reviews', icon: 'salary' },
      { to: '/hr/workflows', label: 'Workflows', icon: 'workflows' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    emphasis: 'clear',
    roles: [...FINANCE_ROLES],
    items: [
      { to: '/finance/payout', label: 'Payout', icon: 'salary' },
      { to: '/hr/documents', label: 'Payslips & documents', icon: 'hrDocuments' },
      { to: '/exec/reports', label: 'Cost reports', icon: 'reports' },
    ],
  },
  {
    id: 'admin-access',
    label: 'Access',
    emphasis: 'clear',
    roles: [...ADMIN_ROLES],
    items: [
      { to: '/admin', label: 'Overview', icon: 'overview', end: true },
      { to: '/admin/employees', label: 'Employees', icon: 'employees' },
      { to: '/admin/leave', label: 'Leave approvals', icon: 'leaveAdmin' },
      { to: '/admin/roles', label: 'Users & Roles', icon: 'roles' },
      { to: '/admin/audit', label: 'Audit log', icon: 'audit' },
    ],
  },
  {
    id: 'admin-platform',
    label: 'Platform',
    emphasis: 'clear',
    roles: [...ADMIN_ROLES],
    items: [
      {
        to: '/admin/notifications',
        label: 'Notifications',
        icon: 'adminNotifications',
      },
      { to: '/admin/settings', label: 'System settings', icon: 'settings' },
      { to: '/admin/jobs', label: 'Jobs', icon: 'jobs' },
    ],
  },
  {
    id: 'it-assets',
    label: 'Assets',
    emphasis: 'clear',
    roles: ['IT_ADMIN', 'HR_HEAD'],
    items: [
      { to: '/it/dashboard', label: 'Asset dashboard', icon: 'overview' },
      { to: '/it/assets', label: 'Asset register', icon: 'assets' },
      { to: '/it/requests', label: 'Requests and approvals', icon: 'inbox' },
      { to: '/it/allocate', label: 'Issue and return', icon: 'employees' },
      { to: '/it/maintenance', label: 'Maintenance and warranty', icon: 'jobs' },
      { to: '/it/reports', label: 'Asset reports', icon: 'reports' },
      { to: '/it/categories', label: 'Asset categories', icon: 'workflows' },
      { to: '/it/approvers', label: 'Request approvers', icon: 'roles' },
    ],
  },
  {
    id: 'leadership',
    label: 'Leadership',
    emphasis: 'clear',
    roles: [...LEADERSHIP_ROLES],
    items: [
      { to: '/exec', label: 'Overview', icon: 'leadership', end: true },
      {
        to: '/exec/reports',
        label: 'Reports',
        icon: 'leadershipReports',
      },
    ],
  },
];

/** Asset pages reached from tabs and links rather than the sidebar. */
const IT_SUBPAGE_TITLES: Record<string, string> = {
  '/it/return': 'Issue and return',
  '/it/transfer': 'Issue and return',
  '/it/employee-assets': 'Issue and return',
  '/it/tickets': 'Asset tickets',
};

function canAccessSection(
  section: NavSection,
  userRoles: string[] | undefined,
): boolean {
  if (section.roles.length === 0) return true;
  // System admin sees the full sidebar.
  if (userHasAnyRole(userRoles, ADMIN_ROLES)) return true;
  return userHasAnyRole(userRoles, section.roles);
}

export function navSectionsForUser(
  userRoles: string[] | undefined,
): NavSection[] {
  return NAV_SECTIONS.filter((s) => canAccessSection(s, userRoles));
}

export function allNavItems(sections: NavSection[]): NavItem[] {
  return sections.flatMap((s) => s.items);
}

export function titleForPath(
  pathname: string,
  sections: NavSection[],
): string {
  const items = allNavItems(sections);
  const exact = items.find((i) => i.to === pathname);
  const inSection = items.some((i) => i.to.startsWith('/it/')) ? IT_SUBPAGE_TITLES[pathname] : undefined;
  if (!exact && inSection) return inSection;
  if (exact) return exact.label;
  const prefix = [...items]
    .filter((i) => pathname.startsWith(i.to) && i.to !== '/ess')
    .sort((a, b) => b.to.length - a.to.length)[0];
  return prefix?.label ?? 'PeopleOS';
}

export const SIDEBAR_COLLAPSED_KEY = 'peopleos-sidebar-collapsed';

export function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}
