import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';
import { ROLE_CATALOG, rolesSeniorToActor, SYSTEM_ADMIN_CODES } from './role-matrix';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async listRoles(tenantId: string) {
    const catalogOrder = new Map(ROLE_CATALOG.map((role, index) => [role.code, index]));
    const rows = await this.prisma.role.findMany({
      where: { tenantId, code: { in: ROLE_CATALOG.map((role) => role.code) } },
      select: { id: true, code: true, name: true },
    });
    return rows.sort(
      (a, b) => (catalogOrder.get(a.code) ?? 99) - (catalogOrder.get(b.code) ?? 99),
    );
  }

  async listUsers(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        status: true,
        roles: { include: { role: { select: { code: true, name: true } } } },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      status: u.status,
      roles: u.roles.map((r) => r.role.code),
    }));
  }

  async myPermissions(userId: string) {
    return { permissions: await this.permissions.getEffectivePermissions(userId) };
  }

  async updateUserRoles(
    tenantId: string,
    actorUserId: string,
    targetUserId: string,
    roleCodes: string[],
  ) {
    const uniqueCodes = [...new Set(roleCodes.map((c) => c.trim()).filter(Boolean))];
    if (uniqueCodes.length === 0) {
      throw new BadRequestException('At least one role is required');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.prisma.role.findMany({
      where: { tenantId, code: { in: uniqueCodes } },
    });
    if (roles.length !== uniqueCodes.length) {
      const found = new Set(roles.map((r) => r.code));
      const missing = uniqueCodes.filter((c) => !found.has(c));
      throw new BadRequestException(`Unknown role codes: ${missing.join(', ')}`);
    }

    const previousCodes = target.roles.map((r) => r.role.code).sort();

    const actor = await this.prisma.user.findFirst({
      where: { id: actorUserId, tenantId },
      include: { roles: { include: { role: { select: { code: true } } } } },
    });
    const actorRoles = actor?.roles.map((link) => link.role.code) ?? [];
    const blocked = rolesSeniorToActor(actorRoles, uniqueCodes);
    if (blocked.length > 0) {
      throw new ForbiddenException(
        `You cannot assign senior roles (${blocked.join(', ')}). Assign only at your level or below.`,
      );
    }

    const isSystemAdmin = (codes: string[]) =>
      codes.some((code) => (SYSTEM_ADMIN_CODES as readonly string[]).includes(code));
    const nextHasSystemAdmin = isSystemAdmin(uniqueCodes);
    const previouslyHadSystemAdmin = isSystemAdmin(previousCodes);

    if (previouslyHadSystemAdmin && !nextHasSystemAdmin) {
      const otherAdmins = await this.prisma.userRole.count({
        where: {
          role: { tenantId, code: { in: [...SYSTEM_ADMIN_CODES] } },
          userId: { not: targetUserId },
          user: { status: 'ACTIVE' },
        },
      });
      if (otherAdmins === 0) {
        throw new ForbiddenException(
          'Cannot remove the last System Administrator (SYS) with rbac.assign in this tenant',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: targetUserId } });
      await tx.userRole.createMany({
        data: roles.map((r) => ({ userId: targetUserId, roleId: r.id })),
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorUserId,
          action: 'rbac.roles.update',
          entityType: 'User',
          entityId: targetUserId,
          metadata: {
            previousRoles: previousCodes,
            nextRoles: uniqueCodes.sort(),
          },
        },
      });
    });

    return {
      id: target.id,
      email: target.email,
      status: target.status,
      roles: uniqueCodes.sort(),
    };
  }
}
