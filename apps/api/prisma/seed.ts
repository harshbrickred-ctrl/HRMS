import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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
];

/** role code → permission codes */
const ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  SECURITY_ADMIN: [
    'rbac.assign',
    'rbac.read',
    'identity.manage',
    'audit.read',
  ],
  IT_ADMIN: ['rbac.assign', 'rbac.read', 'identity.manage'],
  HR_HEAD: ['rbac.read', 'audit.read', 'reports.read'],
  LEADERSHIP_READ: ['audit.read', 'reports.read'],
  FINANCE_READ: ['reports.read'],
  MANAGER: ['reports.read'],
  HR_EXEC: [],
  EMPLOYEE: [],
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
  await upsertUser('employee@peopleos.local', ['EMPLOYEE']);
  await upsertUser('manager@peopleos.local', ['MANAGER', 'EMPLOYEE']);
  await upsertUser('hr@peopleos.local', ['HR_EXEC', 'EMPLOYEE', 'LEADERSHIP_READ']);

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
