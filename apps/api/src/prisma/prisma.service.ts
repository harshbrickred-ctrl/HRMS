import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';
import {
  LEGACY_ROLE_CODES,
  ROLE_CATALOG,
  ROLE_PERMISSION_MATRIX,
  PERMISSIONS,
} from '../rbac/role-matrix';

function neonConnectionString(raw: string) {
  return raw
    .replace(/([?&])channel_binding=[^&]*/g, '$1')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

function clientOptions() {
  const connectionString = process.env.DATABASE_URL ?? '';
  if (!connectionString.includes('neon.tech')) return undefined;
  neonConfig.webSocketConstructor = ws;
  return { adapter: new PrismaNeon({ connectionString: neonConnectionString(connectionString) }) };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super(clientOptions());
  }

  async onModuleInit() {
    await this.$connect();
    await this.ensureLeaveHalfColumns();
    await this.ensureEmployeeBankColumns();
    await this.ensureDepartmentHeadColumn();
    await this.ensureRoleCatalog();
  }

  /** Rename legacy role codes and upsert the document role catalogue. */
  private async ensureRoleCatalog() {
    const tenants = await this.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      for (const [legacy, canon] of Object.entries(LEGACY_ROLE_CODES)) {
        const oldRole = await this.role.findUnique({
          where: { tenantId_code: { tenantId: tenant.id, code: legacy } },
        });
        if (!oldRole) continue;
        const newRole = await this.role.findUnique({
          where: { tenantId_code: { tenantId: tenant.id, code: canon } },
        });
        const catalogName =
          ROLE_CATALOG.find((role) => role.code === canon)?.name ?? canon;
        if (!newRole) {
          await this.role.update({
            where: { id: oldRole.id },
            data: { code: canon, name: catalogName },
          });
          continue;
        }
        const links = await this.userRole.findMany({ where: { roleId: oldRole.id } });
        for (const link of links) {
          const exists = await this.userRole.findUnique({
            where: { userId_roleId: { userId: link.userId, roleId: newRole.id } },
          });
          if (!exists) {
            await this.userRole.create({
              data: { userId: link.userId, roleId: newRole.id },
            });
          }
        }
        await this.userRole.deleteMany({ where: { roleId: oldRole.id } });
        await this.rolePermission.deleteMany({ where: { roleId: oldRole.id } });
        await this.role.delete({ where: { id: oldRole.id } });
      }

      for (const role of ROLE_CATALOG) {
        await this.role.upsert({
          where: { tenantId_code: { tenantId: tenant.id, code: role.code } },
          update: { name: role.name },
          create: { tenantId: tenant.id, code: role.code, name: role.name },
        });
      }
    }

    for (const perm of PERMISSIONS) {
      await this.permission.upsert({
        where: { code: perm.code },
        update: { description: perm.description },
        create: { code: perm.code, description: perm.description },
      });
    }

    const perms = await this.permission.findMany();
    const permId = new Map(perms.map((row) => [row.code, row.id]));
    for (const tenant of tenants) {
      for (const role of ROLE_CATALOG) {
        const row = await this.role.findUnique({
          where: { tenantId_code: { tenantId: tenant.id, code: role.code } },
        });
        if (!row) continue;
        const wanted = new Set(ROLE_PERMISSION_MATRIX[role.code] ?? []);
        const wantedIds = [...wanted]
          .map((code) => permId.get(code))
          .filter((id): id is string => Boolean(id));

        // Drop stale links (e.g. old IT_ADMIN rbac.assign left on ITA).
        await this.rolePermission.deleteMany({
          where: {
            roleId: row.id,
            ...(wantedIds.length
              ? { permissionId: { notIn: wantedIds } }
              : {}),
          },
        });

        for (const permissionId of wantedIds) {
          await this.rolePermission.upsert({
            where: {
              roleId_permissionId: { roleId: row.id, permissionId },
            },
            update: {},
            create: { roleId: row.id, permissionId },
          });
        }
      }
    }
  }

  private async ensureDepartmentHeadColumn() {
    await this.$executeRawUnsafe(
      `ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "headId" TEXT`,
    );
  }

  private async ensureEmployeeBankColumns() {
    const statements = [
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankName" TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "ifscCode" TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT NOT NULL DEFAULT ''`,
    ];
    for (const sql of statements) {
      await this.$executeRawUnsafe(sql);
    }
  }

  private async ensureLeaveHalfColumns() {
    const statements = [
      `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "fromHalfStart" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "fromHalfEnd" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "toHalfStart" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "toHalfEnd" BOOLEAN NOT NULL DEFAULT false`,
      `UPDATE "LeaveRequest" SET "fromHalfStart" = true WHERE "halfDayStart" = true AND "fromDate" = "toDate" AND "fromHalfStart" = false AND "fromHalfEnd" = false AND "toHalfStart" = false AND "toHalfEnd" = false`,
      `UPDATE "LeaveRequest" SET "fromHalfEnd" = true WHERE "halfDayStart" = true AND "fromDate" <> "toDate" AND "fromHalfStart" = false AND "fromHalfEnd" = false AND "toHalfStart" = false AND "toHalfEnd" = false`,
      `UPDATE "LeaveRequest" SET "toHalfStart" = true WHERE "halfDayEnd" = true AND "fromDate" <> "toDate" AND "fromHalfStart" = false AND "fromHalfEnd" = false AND "toHalfStart" = false AND "toHalfEnd" = false`,
      `UPDATE "LeaveRequest" SET "fromHalfEnd" = true WHERE "halfDayEnd" = true AND "fromDate" = "toDate" AND "fromHalfStart" = false AND "fromHalfEnd" = false AND "toHalfStart" = false AND "toHalfEnd" = false`,
    ];
    for (const sql of statements) {
      await this.$executeRawUnsafe(sql);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
