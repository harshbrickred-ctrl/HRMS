import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { HARSH_LEAVE, LEAVE_CATALOG } from '../src/hr/leave-catalog';

const prisma = new PrismaClient();

const ROLE_CATALOG: { code: string; name: string }[] = [
  { code: 'EMPLOYEE', name: 'Employee' },
  { code: 'MANAGER', name: 'Manager' },
  { code: 'HR_EXEC', name: 'HR Executive' },
  { code: 'HR_HEAD', name: 'HR Head' },
  { code: 'FINANCE_READ', name: 'Finance Read' },
  { code: 'IT_ADMIN', name: 'IT Admin' },
  { code: 'SECURITY_ADMIN', name: 'Security Admin' },
  { code: 'LEADERSHIP_READ', name: 'Leadership Read' },
];

const PERMISSIONS: { code: string; description: string }[] = [
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
];

/** role code → permission codes */
const ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  SECURITY_ADMIN: [
    'rbac.assign',
    'rbac.read',
    'identity.manage',
    'audit.read',
  ],
  IT_ADMIN: ['rbac.assign', 'rbac.read', 'identity.manage', 'attendance.device.manage'],
  HR_HEAD: [
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
    'helpdesk.manage',
    'helpdesk.self',
    'payslip.manage',
    'payslip.self',
  ],
  LEADERSHIP_READ: ['audit.read', 'reports.read'],
  FINANCE_READ: ['reports.read', 'payslip.self'],
  MANAGER: [
    'reports.read',
    'attendance.self',
    'attendance.team.read',
    'attendance.approve',
    'leave.self',
    'leave.team.read',
    'leave.approve',
    'helpdesk.self',
    'payslip.self',
  ],
  HR_EXEC: [
    'hr.manage',
    'reports.read',
    'attendance.self',
    'attendance.manage',
    'attendance.override',
    'attendance.period.lock',
    'attendance.device.manage',
    'leave.self',
    'leave.manage',
    'helpdesk.manage',
    'helpdesk.self',
    'payslip.manage',
    'payslip.self',
  ],
  EMPLOYEE: [
    'attendance.self',
    'leave.self',
    'helpdesk.self',
    'payslip.self',
  ],
};

const LEGACY_ROLE_CODES = ['Admin', 'Employee'];

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@peopleos.local')
    .trim()
    .toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing =
    (await prisma.tenant.findUnique({ where: { code: 'BR' } })) ??
    (await prisma.tenant.findUnique({ where: { code: 'default' } }));
  const tenant = existing
    ? await prisma.tenant.update({
        where: { id: existing.id },
        data: { code: 'BR', name: 'Brickred Systems' },
      })
    : await prisma.tenant.create({
        data: { code: 'BR', name: 'Brickred Systems' },
      });

  // Remove legacy role codes from default tenant
  await prisma.role.deleteMany({
    where: { tenantId: tenant.id, code: { in: LEGACY_ROLE_CODES } },
  });

  const rolesByCode = new Map<string, string>();
  for (const role of ROLE_CATALOG) {
    const row = await prisma.role.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: role.code } },
      update: { name: role.name },
      create: { tenantId: tenant.id, code: role.code, name: role.name },
    });
    rolesByCode.set(role.code, row.id);
  }

  const permsByCode = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: { code: perm.code, description: perm.description },
    });
    permsByCode.set(perm.code, row.id);
  }

  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const roleId = rolesByCode.get(roleCode);
    if (!roleId) continue;
    for (const permCode of permCodes) {
      const permissionId = permsByCode.get(permCode);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  async function upsertUser(email: string, roleCodes: string[]) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: { passwordHash, status: 'ACTIVE' },
      create: {
        tenantId: tenant.id,
        email,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    for (const code of roleCodes) {
      const roleId = rolesByCode.get(code);
      if (!roleId) continue;
      await prisma.userRole.create({
        data: { userId: user.id, roleId },
      });
    }
    return user;
  }

  await upsertUser(adminEmail, ['SECURITY_ADMIN']);
  const employeeUser = await upsertUser('employee@peopleos.local', ['EMPLOYEE']);
  const managerUser = await upsertUser('manager@peopleos.local', ['MANAGER', 'EMPLOYEE']);
  const hrUser = await upsertUser('hr@peopleos.local', ['HR_EXEC', 'EMPLOYEE']);

  async function ensureNamed(kind: 'department' | 'location', name: string) {
    if (kind === 'department') {
      return prisma.department.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        update: {},
        create: { tenantId: tenant.id, name },
      });
    }
    return prisma.location.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name },
    });
  }

  const engineering = await ensureNamed('department', 'Engineering');
  const product = await ensureNamed('department', 'Product');
  const humanResources = await ensureNamed('department', 'Human Resources');
  const finance = await ensureNamed('department', 'Finance');
  await ensureNamed('department', 'Leadership');
  const noida = await ensureNamed('location', 'Noida');
  const bengaluru = await ensureNamed('location', 'Bengaluru');
  await ensureNamed('location', 'Hyderabad');
  const mumbai = await ensureNamed('location', 'Mumbai');

  async function ensureEmployee(input: {
    userId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    photo: string;
    departmentId: string;
    locationId: string;
  }) {
    return prisma.employee.upsert({
      where: { userId: input.userId },
      update: {
        employeeCode: input.employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
        designation: input.designation,
        photo: input.photo,
        departmentId: input.departmentId,
        locationId: input.locationId,
      },
      create: {
        tenantId: tenant.id,
        ...input,
      },
    });
  }

  const harsh = await ensureEmployee({
    userId: employeeUser.id,
    employeeCode: 'BR266',
    firstName: 'Harsh',
    lastName: 'Yadav',
    designation: 'Analyst - Development',
    photo: '/employees/harsh-yadav.png',
    departmentId: engineering.id,
    locationId: noida.id,
  });
  const rohit = await ensureEmployee({
    userId: managerUser.id,
    employeeCode: 'BR123',
    firstName: 'Rohit',
    lastName: 'Mehta',
    designation: 'Engineering Manager',
    photo: '/employees/rohit-mehta.png',
    departmentId: engineering.id,
    locationId: bengaluru.id,
  });
  const ananya = await ensureEmployee({
    userId: hrUser.id,
    employeeCode: 'BR156',
    firstName: 'Ananya',
    lastName: 'Desai',
    designation: 'HR Executive',
    photo: '/employees/ananya-desai.png',
    departmentId: humanResources.id,
    locationId: mumbai.id,
  });

  async function ensureTeam(
    name: string,
    departmentId: string,
    managerId?: string,
  ) {
    return prisma.team.upsert({
      where: {
        tenantId_departmentId_name: {
          tenantId: tenant.id,
          departmentId,
          name,
        },
      },
      update: { managerId: managerId ?? null },
      create: {
        tenantId: tenant.id,
        name,
        departmentId,
        managerId: managerId ?? null,
      },
    });
  }

  const platform = await ensureTeam('Platform', engineering.id, rohit.id);
  await ensureTeam('Quality', engineering.id);
  await ensureTeam('Design', product.id);
  const people = await ensureTeam('People', humanResources.id);
  await ensureTeam('Accounts', finance.id);

  await prisma.employee.update({
    where: { id: harsh.id },
    data: { teamId: platform.id, managerId: rohit.id },
  });
  await prisma.employee.update({
    where: { id: ananya.id },
    data: { teamId: people.id, managerId: null },
  });

  for (const employee of [harsh, rohit, ananya]) {
    const amounts = employee.id === harsh.id ? HARSH_LEAVE : {};
    for (const item of LEAVE_CATALOG) {
      const seeded = amounts[item.code] ?? { entitled: 0, used: 0, pending: 0 };
      await prisma.leaveBalance.upsert({
        where: { employeeId_code: { employeeId: employee.id, code: item.code } },
        update:
          employee.id === harsh.id
            ? seeded
            : {},
        create: {
          employeeId: employee.id,
          code: item.code,
          type: item.type,
          ...seeded,
        },
      });
    }
  }

  const general = await prisma.shift.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'GENERAL' } },
    update: {
      name: 'General',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      overnight: false,
    },
    create: {
      tenantId: tenant.id,
      code: 'GENERAL',
      name: 'General',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
    },
  });
  await prisma.attendancePolicy.upsert({
    where: { tenantId: tenant.id },
    update: {
      timeZone: 'Asia/Kolkata',
      graceMinutes: 10,
      halfDayMaxMinutes: 300,
      duplicateWindowMinutes: 5,
      webPunchEnabled: true,
    },
    create: { tenantId: tenant.id, webPunchEnabled: true },
  });
  for (const employee of [harsh, rohit, ananya]) {
    const open = await prisma.shiftAssignment.findFirst({
      where: { employeeId: employee.id, effectiveTo: null },
    });
    if (!open) {
      await prisma.shiftAssignment.create({
        data: {
          tenantId: tenant.id,
          employeeId: employee.id,
          shiftId: general.id,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
    }
  }
  const gandhi = new Date('2026-10-02T00:00:00.000Z');
  const existingHoliday = await prisma.holiday.findFirst({
    where: { tenantId: tenant.id, holidayDate: gandhi, locationId: null },
  });
  if (!existingHoliday) {
    await prisma.holiday.create({
      data: { tenantId: tenant.id, holidayDate: gandhi, name: 'Gandhi Jayanti' },
    });
  }

  const pendingLeave = await prisma.leaveRequest.findFirst({
    where: { tenantId: tenant.id, employeeId: harsh.id, status: 'Pending' },
  });
  if (!pendingLeave) {
    await prisma.leaveRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: harsh.id,
        code: 'CL',
        type: 'Casual Leave',
        fromDate: new Date('2026-10-22T00:00:00.000Z'),
        toDate: new Date('2026-10-22T00:00:00.000Z'),
        days: 1,
        reason: 'Personal errand',
        status: 'Pending',
        approverEmployeeId: rohit.id,
      },
    });
  }
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: { tenantId: tenant.id, employeeId: harsh.id, status: 'Approved' },
  });
  if (!approvedLeave) {
    await prisma.leaveRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: harsh.id,
        code: 'SL',
        type: 'Sick Leave',
        fromDate: new Date('2026-09-08T00:00:00.000Z'),
        toDate: new Date('2026-09-08T00:00:00.000Z'),
        days: 1,
        reason: 'Fever',
        status: 'Approved',
        approverEmployeeId: rohit.id,
        decidedAt: new Date('2026-09-07T10:00:00.000Z'),
        decisionNote: 'Get well soon',
      },
    });
  }

  console.log(
    `Seeded tenant=${tenant.code} roles=${ROLE_CATALOG.length} users=4 admin=${adminEmail}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
