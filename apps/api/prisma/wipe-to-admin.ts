/**
 * Destructive: wipe all app data, keep one tenant + role catalogue + single admin.
 * Usage: npx ts-node -O "{\"module\":\"CommonJS\"}" prisma/wipe-to-admin.ts
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import {
  PERMISSIONS,
  ROLE_CATALOG,
  ROLE_PERMISSION_MATRIX,
} from '../src/rbac/role-matrix';

async function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(__dirname, '..', name);
    try {
      const text = await fs.readFile(file, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      /* missing file */
    }
  }
}

async function main() {
  await loadEnv();
  const prisma = new PrismaClient();

  const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? 'admin@peopleos.local')
    .trim()
    .toLowerCase();
  const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  // Order does not matter with CASCADE; truncate every app table.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AssetTicketComment",
      "AssetTicket",
      "AssetAssignment",
      "Asset",
      "AttendanceCorrection",
      "AttendanceDay",
      "AttendancePunch",
      "AttendancePeriod",
      "DeviceOperationLog",
      "DeviceCommand",
      "DeviceEnrollment",
      "AttendanceDevice",
      "AttendancePolicy",
      "Holiday",
      "ShiftAssignment",
      "Shift",
      "SalaryLine",
      "SalaryStructure",
      "Payslip",
      "EmployeeDocument",
      "HelpdeskComment",
      "HelpdeskTicket",
      "Notification",
      "LeaveRequest",
      "LeaveBalance",
      "Employee",
      "Team",
      "Department",
      "Location",
      "PasswordResetOtp",
      "RefreshToken",
      "AuditEvent",
      "UserRole",
      "RolePermission",
      "User",
      "Role",
      "Permission",
      "Tenant"
    RESTART IDENTITY CASCADE
  `);

  const tenant = await prisma.tenant.create({
    data: { code: 'BR', name: 'Brickred Systems' },
  });

  const permsByCode = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const row = await prisma.permission.create({
      data: { code: perm.code, description: perm.description },
    });
    permsByCode.set(perm.code, row.id);
  }

  const rolesByCode = new Map<string, string>();
  for (const role of ROLE_CATALOG) {
    const row = await prisma.role.create({
      data: { tenantId: tenant.id, code: role.code, name: role.name },
    });
    rolesByCode.set(role.code, row.id);
  }

  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    if (!rolesByCode.has(roleCode)) continue;
    const roleId = rolesByCode.get(roleCode)!;
    for (const permCode of permCodes) {
      const permissionId = permsByCode.get(permCode);
      if (!permissionId) continue;
      await prisma.rolePermission.create({
        data: { roleId, permissionId },
      });
    }
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: ADMIN_EMAIL,
      passwordHash,
      status: 'ACTIVE',
    },
  });

  // Main admin gets every catalogue role so all nav and screens open.
  for (const role of ROLE_CATALOG) {
    const roleId = rolesByCode.get(role.code);
    if (!roleId) continue;
    await prisma.userRole.create({ data: { userId: admin.id, roleId } });
  }

  const users = await prisma.user.count();
  const employees = await prisma.employee.count();
  const indiaLocations = [
    'Noida',
    'Delhi',
    'Gurugram',
    'Bengaluru',
    'Hyderabad',
    'Mumbai',
    'Pune',
    'Chennai',
    'Kolkata',
    'Ahmedabad',
    'Jaipur',
    'Chandigarh',
  ];
  for (const name of indiaLocations) {
    await prisma.location.create({ data: { tenantId: tenant.id, name } });
  }

  console.log(
    JSON.stringify({
      ok: true,
      tenant: tenant.code,
      adminEmail: ADMIN_EMAIL,
      users,
      employees,
      roles: ROLE_CATALOG.length,
      locations: indiaLocations.length,
    }),
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
});
