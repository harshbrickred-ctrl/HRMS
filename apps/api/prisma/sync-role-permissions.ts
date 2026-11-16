/** Replace RolePermission rows with ROLE_PERMISSION_MATRIX only. */
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import {
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
      /* missing */
    }
  }
}

async function main() {
  await loadEnv();
  const prisma = new PrismaClient();
  const perms = await prisma.permission.findMany();
  const permId = new Map(perms.map((row) => [row.code, row.id]));
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let deleted = 0;
  let upserted = 0;

  for (const tenant of tenants) {
    for (const role of ROLE_CATALOG) {
      const row = await prisma.role.findUnique({
        where: { tenantId_code: { tenantId: tenant.id, code: role.code } },
      });
      if (!row) continue;
      const wanted = ROLE_PERMISSION_MATRIX[role.code] ?? [];
      const wantedIds = wanted
        .map((code) => permId.get(code))
        .filter((id): id is string => Boolean(id));

      const remove = await prisma.rolePermission.deleteMany({
        where: {
          roleId: row.id,
          ...(wantedIds.length
            ? { permissionId: { notIn: wantedIds } }
            : {}),
        },
      });
      deleted += remove.count;

      for (const permissionId of wantedIds) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: row.id, permissionId },
          },
          update: {},
          create: { roleId: row.id, permissionId },
        });
        upserted += 1;
      }

      const codes = await prisma.rolePermission.findMany({
        where: { roleId: row.id },
        include: { permission: true },
      });
      const hasAssign = codes.some((c) => c.permission.code === 'rbac.assign');
      console.log(
        `${role.code}: ${codes.length} perms` +
          (hasAssign ? ' [has rbac.assign]' : ''),
      );
    }
  }

  console.log(`done deleted=${deleted} upserted=${upserted}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
