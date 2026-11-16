/** Grant admin@peopleos.local every catalogue role. */
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { ROLE_CATALOG } from '../src/rbac/role-matrix';

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
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@peopleos.local').trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email },
    include: { roles: true },
  });
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const roles = await prisma.role.findMany({
    where: { tenantId: user.tenantId, code: { in: ROLE_CATALOG.map((r) => r.code) } },
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.createMany({
    data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
  });

  console.log(
    JSON.stringify({
      ok: true,
      email,
      roles: roles.map((r) => r.code).sort(),
      count: roles.length,
    }),
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
