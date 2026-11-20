/** Same catalogue the API uses — HRMS Roles and Responsibilities doc. */

export const ROLE_CATALOG: { code: string; name: string; dept: string }[] = [
  { code: 'EXEC', name: 'Executive / CEO', dept: 'Management' },
  { code: 'HRH', name: 'HR Head', dept: 'HR' },
  { code: 'HRA', name: 'HR Admin', dept: 'HR' },
  { code: 'HRBP', name: 'HR Business Partner', dept: 'HR' },
  { code: 'REC', name: 'Recruiter', dept: 'HR' },
  { code: 'PAY', name: 'Payroll Executive', dept: 'HR' },
  { code: 'LP', name: 'Learning and Performance Lead', dept: 'HR' },
  { code: 'FIN', name: 'Finance Head / Controller', dept: 'Finance' },
  { code: 'ACC', name: 'Accounts Executive', dept: 'Finance' },
  { code: 'ITA', name: 'IT / Asset Admin', dept: 'IT' },
  { code: 'SYS', name: 'System Administrator', dept: 'IT' },
  { code: 'ADM', name: 'Admin / Facilities', dept: 'Admin' },
  { code: 'LEG', name: 'Legal / Compliance Officer', dept: 'Legal' },
  { code: 'AUD', name: 'Internal Auditor', dept: 'Audit' },
  { code: 'MGR', name: 'Reporting Manager', dept: 'Line' },
  { code: 'EMP', name: 'Employee', dept: 'All' },
  { code: 'ALU', name: 'Alumni', dept: 'All' },
];

export const LEGACY_ROLE_CODES: Record<string, string> = {
  EMPLOYEE: 'EMP',
  MANAGER: 'MGR',
  HR_EXEC: 'HRA',
  HR_HEAD: 'HRH',
  FINANCE_READ: 'FIN',
  IT_ADMIN: 'ITA',
  SECURITY_ADMIN: 'SYS',
  LEADERSHIP_READ: 'EXEC',
};

export function canonicalRoleCode(code: string): string {
  return LEGACY_ROLE_CODES[code] ?? code;
}

/** Higher = more senior (HRMS RACI). Assign only at your level or below. */
export const ROLE_RANK: Record<string, number> = {
  ALU: 0,
  EMP: 1,
  MGR: 2,
  REC: 3,
  LP: 3,
  ADM: 3,
  ACC: 3,
  HRA: 4,
  HRBP: 4,
  PAY: 4,
  ITA: 4,
  LEG: 4,
  AUD: 4,
  SYS: 5,
  HRH: 5,
  FIN: 5,
  EXEC: 6,
};

export function roleRank(code: string): number {
  return ROLE_RANK[canonicalRoleCode(code)] ?? 1;
}

export function maxRoleRank(codes: string[]): number {
  return codes.reduce((highest, code) => Math.max(highest, roleRank(code)), 0);
}

export function canAssignRole(actorRoles: string[] | undefined, roleCode: string): boolean {
  if (!actorRoles?.length) return false;
  return roleRank(roleCode) <= maxRoleRank(actorRoles);
}

export function assignableRoles<T extends { code: string }>(
  actorRoles: string[] | undefined,
  roles: T[],
): T[] {
  return roles.filter((role) => canAssignRole(actorRoles, role.code));
}

export function rolesSeniorToActor(
  actorRoles: string[] | undefined,
  targetRoles: string[],
): string[] {
  const ceiling = maxRoleRank(actorRoles ?? []);
  const blocked = new Set<string>();
  for (const code of targetRoles) {
    const canon = canonicalRoleCode(code);
    if (roleRank(canon) > ceiling) blocked.add(canon);
  }
  return [...blocked];
}

/** True if the user holds any of the allowed roles (legacy codes accepted). */
export function userHasAnyRole(userRoles: string[] | undefined, allowed: string[]): boolean {
  if (!userRoles?.length || !allowed.length) return false;
  const held = new Set(userRoles.map(canonicalRoleCode));
  for (const role of userRoles) held.add(role);
  return allowed.some((code) => held.has(code) || held.has(canonicalRoleCode(code)));
}

export const HR_ROLES = ['HRA', 'HRH', 'HRBP', 'HR_EXEC', 'HR_HEAD', 'PAY'];
export const ADMIN_ROLES = ['SYS', 'SECURITY_ADMIN'];
export const IT_ROLES = ['ITA', 'IT_ADMIN', 'ADM'];
export const MANAGER_ROLES = ['MGR', 'MANAGER'];
export const LEADERSHIP_ROLES = ['EXEC', 'LEADERSHIP_READ'];
export const FINANCE_ROLES = ['FIN', 'ACC', 'FINANCE_READ', 'PAY'];
export const AUDIT_ROLES = ['AUD', 'SYS', 'SECURITY_ADMIN', 'LEG'];

export const ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  EMP: ['attendance.self', 'leave.self', 'helpdesk.self', 'payslip.self', 'tax.self', 'assets.self'],
  ALU: ['payslip.self', 'tax.self', 'leave.self'],
  MGR: [
    'reports.read',
    'attendance.self',
    'attendance.team.read',
    'attendance.approve',
    'leave.self',
    'leave.team.read',
    'leave.approve',
    'helpdesk.self',
    'payslip.self',
    'tax.self',
    'assets.self',
  ],
  HRA: [
    'hr.manage',
    'reports.read',
    'attendance.self',
    'attendance.manage',
    'attendance.override',
    'attendance.period.lock',
    'attendance.device.manage',
    'leave.self',
    'leave.manage',
    'leave.approve',
    'helpdesk.manage',
    'helpdesk.self',
    'payslip.manage',
    'salary.manage',
    'tax.manage',
    'payslip.self',
    'tax.self',
    'assets.self',
  ],
  HRH: [
    'rbac.read',
    'audit.read',
    'reports.read',
    'hr.manage',
    'attendance.self',
    'attendance.manage',
    'attendance.override',
    'attendance.period.lock',
    'attendance.device.manage',
    'leave.self',
    'leave.manage',
    'leave.approve',
    'helpdesk.manage',
    'helpdesk.self',
    'payslip.manage',
    'salary.manage',
    'tax.manage',
    'payslip.self',
    'tax.self',
    'assets.self',
  ],
  HRBP: [
    'hr.manage',
    'reports.read',
    'attendance.self',
    'leave.self',
    'leave.manage',
    'leave.approve',
    'helpdesk.manage',
    'helpdesk.self',
    'payslip.self',
    'tax.self',
    'salary.manage',
    'tax.manage',
    'assets.self',
  ],
  REC: ['reports.read', 'leave.self', 'helpdesk.self', 'payslip.self', 'tax.self', 'assets.self'],
  PAY: [
    'reports.read',
    'payslip.manage',
    'salary.manage',
    'tax.manage',
    'payslip.self',
    'tax.self',
    'hr.manage',
    'attendance.self',
    'leave.self',
    'helpdesk.self',
    'assets.self',
  ],
  LP: ['reports.read', 'leave.self', 'attendance.self', 'helpdesk.self', 'payslip.self', 'tax.self', 'assets.self'],
  FIN: [
    'reports.read',
    'audit.read',
    'payslip.self',
    'tax.self',
    'payslip.manage',
    'salary.manage',
    'tax.manage',
    'attendance.self',
    'leave.self',
    'helpdesk.self',
    'assets.self',
  ],
  ACC: [
    'reports.read',
    'salary.manage',
    'tax.manage',
    'payslip.self',
    'tax.self',
    'attendance.self',
    'leave.self',
    'helpdesk.self',
    'assets.self',
  ],
  ITA: [
    'attendance.self',
    'attendance.device.manage',
    'leave.self',
    'leave.approve',
    'assets.self',
    'assets.manage',
    'assets.tickets.manage',
    'helpdesk.self',
    'payslip.self',
    'tax.self',
  ],
  SYS: [
    'rbac.assign',
    'rbac.read',
    'identity.manage',
    'audit.read',
    'reports.read',
    'hr.manage',
    'attendance.self',
    'attendance.team.read',
    'attendance.approve',
    'attendance.manage',
    'attendance.override',
    'attendance.period.lock',
    'attendance.device.manage',
    'leave.self',
    'leave.team.read',
    'leave.approve',
    'leave.manage',
    'helpdesk.self',
    'helpdesk.manage',
    'payslip.self',
    'payslip.manage',
    'salary.manage',
    'tax.self',
    'tax.manage',
    'assets.self',
    'assets.manage',
    'assets.tickets.manage',
  ],
  ADM: [
    'assets.self',
    'assets.manage',
    'assets.tickets.manage',
    'leave.self',
    'attendance.self',
    'helpdesk.self',
    'payslip.self',
    'tax.self',
  ],
  LEG: ['audit.read', 'reports.read', 'leave.self', 'attendance.self', 'helpdesk.self', 'payslip.self', 'tax.self'],
  AUD: ['audit.read', 'reports.read'],
  EXEC: [
    'audit.read',
    'reports.read',
    'leave.self',
    'attendance.self',
    'helpdesk.self',
    'payslip.self',
    'tax.self',
    'assets.self',
  ],
};

for (const [legacy, canon] of Object.entries(LEGACY_ROLE_CODES)) {
  ROLE_PERMISSION_MATRIX[legacy] = ROLE_PERMISSION_MATRIX[canon] ?? [];
}

export const PERMISSION_LABELS: Record<string, string> = {
  'rbac.assign': 'Assign roles',
  'rbac.read': 'View roles',
  'identity.manage': 'Identity settings',
  'audit.read': 'Audit log',
  'reports.read': 'Reports',
  'hr.manage': 'People and org',
  'attendance.self': 'Own attendance',
  'attendance.team.read': 'Team attendance',
  'attendance.approve': 'Attendance approvals',
  'attendance.manage': 'Attendance setup',
  'attendance.override': 'Correct a day',
  'attendance.period.lock': 'Lock a month',
  'attendance.device.manage': 'Biometric devices',
  'leave.self': 'Own leave',
  'leave.team.read': 'Team leave',
  'leave.approve': 'Leave approvals',
  'leave.manage': 'Leave admin',
  'helpdesk.self': 'Own tickets',
  'helpdesk.manage': 'Helpdesk admin',
  'payslip.self': 'Own payslips',
  'payslip.manage': 'Payslip admin',
  'salary.manage': 'Salary upload',
  'tax.self': 'Own tax declaration',
  'tax.manage': 'Tax reviews',
  'assets.self': 'Own assets',
  'assets.manage': 'Asset register',
  'assets.tickets.manage': 'Asset tickets',
};

export const PERMISSION_GROUPS: Array<{ title: string; codes: string[] }> = [
  { title: 'Access', codes: ['rbac.assign', 'rbac.read', 'identity.manage', 'audit.read', 'reports.read'] },
  { title: 'People', codes: ['hr.manage'] },
  {
    title: 'Attendance',
    codes: [
      'attendance.self',
      'attendance.team.read',
      'attendance.approve',
      'attendance.manage',
      'attendance.override',
      'attendance.period.lock',
      'attendance.device.manage',
    ],
  },
  { title: 'Leave', codes: ['leave.self', 'leave.team.read', 'leave.approve', 'leave.manage'] },
  { title: 'Helpdesk', codes: ['helpdesk.self', 'helpdesk.manage'] },
  { title: 'Pay', codes: ['payslip.self', 'payslip.manage', 'salary.manage', 'tax.self', 'tax.manage'] },
  { title: 'Assets', codes: ['assets.self', 'assets.manage', 'assets.tickets.manage'] },
];

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_CATALOG.map((role) => [role.code, role.name]),
);
ROLE_LABELS.EMPLOYEE = 'Employee';
ROLE_LABELS.MANAGER = 'Reporting Manager';
ROLE_LABELS.HR_EXEC = 'HR Admin';
ROLE_LABELS.HR_HEAD = 'HR Head';
ROLE_LABELS.FINANCE_READ = 'Finance Head / Controller';
ROLE_LABELS.IT_ADMIN = 'IT / Asset Admin';
ROLE_LABELS.SECURITY_ADMIN = 'System Administrator';
ROLE_LABELS.LEADERSHIP_READ = 'Executive / CEO';

export function roleLabel(code: string) {
  return ROLE_LABELS[code] ?? ROLE_LABELS[canonicalRoleCode(code)] ?? code.replaceAll('_', ' ');
}

export function permissionsForRoles(roleCodes: string[]) {
  const granted = new Set<string>();
  for (const code of roleCodes) {
    const key = canonicalRoleCode(code);
    for (const permission of ROLE_PERMISSION_MATRIX[key] ?? ROLE_PERMISSION_MATRIX[code] ?? []) {
      granted.add(permission);
    }
  }
  return granted;
}
