export type NavIconId =
  | 'home'
  | 'leave'
  | 'attendance'
  | 'people'
  | 'myTeam'
  | 'documents'
  | 'profile'
  | 'salary'
  | 'notifications'
  | 'helpdesk'
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
  | 'leadershipReports'
  | 'mobile';

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
  | 'team-approvals'
  | 'team-time'
  | 'team-directory'
  | 'hr-people'
  | 'hr-time'
  | 'hr-programs'
  | 'hr-insight'
  | 'admin-access'
  | 'admin-platform'
  | 'leadership';

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
    items: [{ to: '/ess/salary', label: 'Salary', icon: 'salary' }],
  },
  {
    id: 'workplace',
    label: 'Workplace',
    emphasis: 'subtle',
    roles: [],
    items: [
      { to: '/ess/documents', label: 'Document Center', icon: 'documents' },
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
      { to: '/ess/notifications', label: 'Notifications', icon: 'notifications' },
      { to: '/ess/settings', label: 'Settings', icon: 'settings' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    emphasis: 'subtle',
    roles: [],
    items: [
      { to: '/ess/helpdesk', label: 'Helpdesk', icon: 'helpdesk' },
      { to: '/mobile', label: 'Mobile', icon: 'mobile' },
    ],
  },
  {
    id: 'team-approvals',
    label: 'Approvals',
    emphasis: 'clear',
    roles: ['MANAGER'],
    items: [
      { to: '/manager', label: 'Overview', icon: 'overview', end: true },
      { to: '/manager/inbox', label: 'Inbox', icon: 'inbox' },
    ],
  },
  {
    id: 'team-time',
    label: 'Time',
    emphasis: 'clear',
    roles: ['MANAGER'],
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
    roles: ['MANAGER'],
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
    roles: ['HR_EXEC', 'HR_HEAD'],
    items: [
      { to: '/hr', label: 'Overview', icon: 'overview', end: true },
      { to: '/hr/employees', label: 'Employees', icon: 'employees' },
      { to: '/hr/organization', label: 'Organization', icon: 'organization' },
    ],
  },
  {
    id: 'hr-time',
    label: 'Time',
    emphasis: 'clear',
    roles: ['HR_EXEC', 'HR_HEAD'],
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
    roles: ['HR_EXEC', 'HR_HEAD'],
    items: [
      { to: '/hr/documents', label: 'Documents', icon: 'hrDocuments' },
      { to: '/hr/workflows', label: 'Workflows', icon: 'workflows' },
    ],
  },
  {
    id: 'hr-insight',
    label: 'Insight',
    emphasis: 'clear',
    roles: ['HR_EXEC', 'HR_HEAD'],
    items: [
      { to: '/hr/reports', label: 'Reports', icon: 'reports' },
      { to: '/hr/migration', label: 'Migration', icon: 'migration' },
    ],
  },
  {
    id: 'admin-access',
    label: 'Access',
    emphasis: 'clear',
    roles: ['SECURITY_ADMIN', 'IT_ADMIN'],
    items: [
      { to: '/admin', label: 'Overview', icon: 'overview', end: true },
      { to: '/admin/roles', label: 'Users & Roles', icon: 'roles' },
      { to: '/admin/audit', label: 'Audit log', icon: 'audit' },
    ],
  },
  {
    id: 'admin-platform',
    label: 'Platform',
    emphasis: 'clear',
    roles: ['SECURITY_ADMIN', 'IT_ADMIN'],
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
    id: 'leadership',
    label: 'Leadership',
    emphasis: 'clear',
    roles: ['LEADERSHIP_READ'],
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

function canAccessSection(
  section: NavSection,
  userRoles: string[] | undefined,
): boolean {
  if (section.roles.length === 0) return true;
  if (!userRoles?.length) return false;
  return section.roles.some((r) => userRoles.includes(r));
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
