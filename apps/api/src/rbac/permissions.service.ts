import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { permissionsForRoleCode } from './role-matrix';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectivePermissions(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    const set = new Set<string>();
    for (const ur of rows) {
      // Matrix is the source of truth. Ignore stale RolePermission rows left
      // from older role codes (e.g. IT_ADMIN → ITA still carrying rbac.assign).
      for (const code of permissionsForRoleCode(ur.role.code)) {
        set.add(code);
      }
    }
    return [...set].sort();
  }

  async userHasAllPermissions(
    userId: string,
    required: string[],
  ): Promise<boolean> {
    if (required.length === 0) return true;
    const effective = await this.getEffectivePermissions(userId);
    const set = new Set(effective);
    return required.every((code) => set.has(code));
  }
}
