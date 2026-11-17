/**
 * PeopleOS role catalogue — aligned to
 * "HRMS Roles and Responsibilities: Departments and Features".
 * Codes are the document short names. Legacy codes still resolve via LEGACY_ROLE_CODES.
 */
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

/** Old PeopleOS codes → document short codes (startup migrates DB rows). */
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

/**
 * Org seniority for hiring / role assignment (HRMS RACI doc).
 * Higher = more senior. You may assign only roles at your level or below.
 * EXEC approves senior hires; heads (HRH/FIN/SYS) sit under EXEC; operators
 * under heads; managers under operators; employees at the base.
 */
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

/** Role codes in `targetRoles` that sit above the actor's highest role. */
export function rolesSeniorToActor(actorRoles: string[], targetRoles: string[]): string[] {
  const ceiling = maxRoleRank(actorRoles);
  const blocked = new Set<string>();
  for (const code of targetRoles) {
    const canon = canonicalRoleCode(code);
    if (roleRank(canon) > ceiling) blocked.add(canon);
  }
  return [...blocked];
}

export function canAssignRole(actorRoles: string[], roleCode: string): boolean {
  return roleRank(roleCode) <= maxRoleRank(actorRoles);
}

/** Roles that may hold the last rbac.assign seat. */
export const SYSTEM_ADMIN_CODES = ['SYS', 'SECURITY_ADMIN'] as const;

/** HR / admin officers who may backdate earned leave and run leave admin. */
export const LEAVE_OFFICER_CODES = [
  'HRA',
  'HRH',
  'HRBP',
  'SYS',
  'ITA',
  'HR_EXEC',
  'HR_HEAD',
  'SECURITY_ADMIN',
  'IT_ADMIN',
] as const;

export const PERMISSIONS: { code: string; description: string }[] = [
  { code: 'rbac.assign', description: 'Assign and revoke user roles' },
  { code: 'rbac.read', description: 'Read role catalog and user role assignments' },
  { code: 'identity.manage', description: 'Manage identity settings' },
  { code: 'audit.read', description: 'Read audit events' },
  { code: 'reports.read', description: 'Read operational reports' },
  { code: 'hr.manage', description: 'Manage employees, org structure, documents, and leave balances' },
  { code: 'attendance.self', description: 'View and punch own attendance and request a correction' },
  { code: 'attendance.team.read', description: 'View team attendance and exceptions' },
  { code: 'attendance.approve', description: 'Approve or reject attendance corrections' },
  { code: 'attendance.manage', description: 'Manage shifts, holidays, policies, and the attendance register' },
  { code: 'attendance.override', description: 'Correct an attendance day with a reason' },
  { code: 'attendance.period.lock', description: 'Lock an attendance month' },
  { code: 'attendance.device.manage', description: 'Register biometric devices and enroll employee PINs' },
  { code: 'leave.self', description: 'Apply and withdraw own leave requests' },
  { code: 'leave.team.read', description: 'View team leave requests' },
  { code: 'leave.approve', description: 'Approve or reject leave requests' },
  { code: 'leave.manage', description: 'Manage leave balances and company leave' },
  { code: 'helpdesk.self', description: 'Create and view own helpdesk tickets' },
  { code: 'helpdesk.manage', description: 'Manage helpdesk tickets across the company' },
  { code: 'payslip.self', description: 'View and download own payslips' },
  { code: 'payslip.manage', description: 'Upload and manage employee payslips' },
  { code: 'salary.manage', description: 'Upload salary structures and generate monthly pay' },
  { code: 'assets.self', description: 'View currently assigned assets and raise asset tickets' },
  { code: 'assets.manage', description: 'Manage the asset register, categories, assignments, and history' },
  { code: 'assets.tickets.manage', description: 'Handle asset issues, queries, and new-asset requests' },
];

const SELF = ['attendance.self', 'leave.self', 'helpdesk.self', 'payslip.self', 'assets.self'] as const;

/** role code → permission codes (existing product features only). */
export const ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  EMP: [...SELF],
  ALU: ['payslip.self', 'leave.self'],
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
    'payslip.self',
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
    'payslip.self',
    'assets.self',
    'assets.manage',
    'assets.tickets.manage',
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
    'salary.manage',
    'assets.self',
  ],
  REC: ['reports.read', 'leave.self', 'helpdesk.self', 'payslip.self', 'assets.self'],
  PAY: [
    'reports.read',
    'payslip.manage',
    'salary.manage',
    'payslip.self',
    'hr.manage',
    'attendance.self',
    'leave.self',
    'helpdesk.self',
    'assets.self',
  ],
  LP: ['reports.read', 'leave.self', 'attendance.self', 'helpdesk.self', 'payslip.self', 'assets.self'],
  FIN: [
    'reports.read',
    'audit.read',
    'payslip.self',
    'payslip.manage',
    'salary.manage',
    'attendance.self',
    'leave.self',
    'helpdesk.self',
    'assets.self',
  ],
  ACC: ['reports.read', 'salary.manage', 'payslip.self', 'attendance.self', 'leave.self', 'helpdesk.self', 'assets.self'],
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
  ],
  // Main platform admin: every permission in the product.
  SYS: PERMISSIONS.map((permission) => permission.code),
  ADM: [
    'assets.self',
    'assets.manage',
    'assets.tickets.manage',
    'leave.self',
    'attendance.self',
    'helpdesk.self',
    'payslip.self',
  ],
  LEG: ['audit.read', 'reports.read', 'leave.self', 'attendance.self', 'helpdesk.self', 'payslip.self'],
  AUD: ['audit.read', 'reports.read'],
  EXEC: [
    'audit.read',
    'reports.read',
    'leave.self',
    'attendance.self',
    'helpdesk.self',
    'payslip.self',
    'assets.self',
  ],
};

// Keep legacy codes working until every token is refreshed after migration.
for (const [legacy, canon] of Object.entries(LEGACY_ROLE_CODES)) {
  ROLE_PERMISSION_MATRIX[legacy] = ROLE_PERMISSION_MATRIX[canon] ?? [];
}

export function permissionsForRoleCode(code: string): string[] {
  const canon = canonicalRoleCode(code);
  return ROLE_PERMISSION_MATRIX[canon] ?? ROLE_PERMISSION_MATRIX[code] ?? [];
}
