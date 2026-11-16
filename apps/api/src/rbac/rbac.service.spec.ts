import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { PermissionsService } from './permissions.service';

describe('RbacService.updateUserRoles', () => {
  const tenantId = 'tenant-1';
  const actorUserId = 'actor-1';
  const targetUserId = 'user-1';

  function buildService(overrides: {
    targetRoles?: string[];
    otherAdminCount?: number;
    roleFindResult?: { id: string; code: string }[];
  }) {
    const previous = overrides.targetRoles ?? ['SYS'];
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: targetUserId,
          email: 'admin@peopleos.local',
          status: 'ACTIVE',
          roles: previous.map((code) => ({ role: { code } })),
        }),
      },
      role: {
        findMany: jest.fn().mockResolvedValue(
          overrides.roleFindResult ??
            (overrides.targetRoles
              ? overrides.targetRoles.map((code, i) => ({
                  id: `role-${i}`,
                  code,
                }))
              : [{ id: 'role-sa', code: 'SYS' }]),
        ),
      },
      userRole: {
        count: jest.fn().mockResolvedValue(overrides.otherAdminCount ?? 0),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      auditEvent: { create: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          userRole: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          auditEvent: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      }),
    };

    const permissions = {} as PermissionsService;
    const service = new RbacService(prisma as never, permissions);
    return { service, prisma };
  }

  it('rejects empty role set after trim', async () => {
    const { service } = buildService({});
    await expect(
      service.updateUserRoles(tenantId, actorUserId, targetUserId, ['  ']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks removing the last SYS admin', async () => {
    const { service, prisma } = buildService({
      targetRoles: ['SYS'],
      otherAdminCount: 0,
      roleFindResult: [{ id: 'r1', code: 'EMP' }],
    });

    await expect(
      service.updateUserRoles(tenantId, actorUserId, targetUserId, ['EMP']),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.userRole.count).toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows role update when another SYS remains', async () => {
    const { service, prisma } = buildService({
      targetRoles: ['SYS'],
      otherAdminCount: 1,
      roleFindResult: [
        { id: 'r1', code: 'EMP' },
        { id: 'r2', code: 'MGR' },
      ],
    });

    const result = await service.updateUserRoles(
      tenantId,
      actorUserId,
      targetUserId,
      ['EMP', 'MGR'],
    );

    expect(result.roles).toEqual(['EMP', 'MGR']);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
