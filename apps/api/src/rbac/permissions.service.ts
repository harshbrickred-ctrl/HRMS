import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectivePermissions(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    const set = new Set<string>();
    for (const ur of rows) {
      for (const rp of ur.role.permissions) {
        set.add(rp.permission.code);
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
