/** Seed common India office locations for Add Member dropdown. */
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const INDIA_LOCATIONS = [
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
  const tenant =
    (await prisma.tenant.findUnique({ where: { code: 'BR' } })) ??
    (await prisma.tenant.findFirst());
  if (!tenant) throw new Error('No tenant found');

  const created: string[] = [];
  for (const name of INDIA_LOCATIONS) {
    const row = await prisma.location.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name },
    });
    created.push(row.name);
  }

  console.log(JSON.stringify({ ok: true, tenant: tenant.code, locations: created }));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
