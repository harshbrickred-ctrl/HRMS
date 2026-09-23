import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from './permissions.service';

const SECURITY_ADMIN = 'SECURITY_ADMIN';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
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
    const nextHasSecurityAdmin = uniqueCodes.includes(SECURITY_ADMIN);
    const previouslyHadSecurityAdmin = previousCodes.includes(SECURITY_ADMIN);

    if (previouslyHadSecurityAdmin && !nextHasSecurityAdmin) {
      const otherAdmins = await this.prisma.userRole.count({
        where: {
          role: { tenantId, code: SECURITY_ADMIN },
          userId: { not: targetUserId },
          user: { status: 'ACTIVE' },
        },
      });
      if (otherAdmins === 0) {
        throw new ForbiddenException(
          'Cannot remove the last SECURITY_ADMIN with rbac.assign in this tenant',
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
