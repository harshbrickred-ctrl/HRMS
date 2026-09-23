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
    const previous = overrides.targetRoles ?? ['SECURITY_ADMIN'];
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
              : [{ id: 'role-sa', code: 'SECURITY_ADMIN' }]),
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

  it('blocks removing the last SECURITY_ADMIN', async () => {
    const { service, prisma } = buildService({
      targetRoles: ['SECURITY_ADMIN'],
      otherAdminCount: 0,
      roleFindResult: [{ id: 'r1', code: 'EMPLOYEE' }],
    });

    await expect(
      service.updateUserRoles(tenantId, actorUserId, targetUserId, [
        'EMPLOYEE',
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.userRole.count).toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows role update when another SECURITY_ADMIN remains', async () => {
    const { service, prisma } = buildService({
      targetRoles: ['SECURITY_ADMIN'],
      otherAdminCount: 1,
      roleFindResult: [
        { id: 'r1', code: 'EMPLOYEE' },
        { id: 'r2', code: 'MANAGER' },
      ],
    });

    const result = await service.updateUserRoles(
      tenantId,
      actorUserId,
      targetUserId,
      ['EMPLOYEE', 'MANAGER'],
    );

    expect(result.roles).toEqual(['EMPLOYEE', 'MANAGER']);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
