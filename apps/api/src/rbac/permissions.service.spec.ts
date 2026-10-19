import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  it('unions permission codes across roles', async () => {
    const prisma = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: {
              permissions: [
                { permission: { code: 'rbac.read' } },
                { permission: { code: 'audit.read' } },
              ],
            },
          },
          {
            role: {
              permissions: [{ permission: { code: 'rbac.read' } }],
            },
          },
        ]),
      },
    };
    const service = new PermissionsService(prisma as never);
    await expect(service.getEffectivePermissions('u1')).resolves.toEqual([
      'audit.read',
      'rbac.read',
    ]);
  });

  it('userHasAllPermissions requires every code', async () => {
    const prisma = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: {
              permissions: [{ permission: { code: 'rbac.read' } }],
            },
          },
        ]),
      },
    };
    const service = new PermissionsService(prisma as never);
    await expect(
      service.userHasAllPermissions('u1', ['rbac.read']),
    ).resolves.toBe(true);
    await expect(
      service.userHasAllPermissions('u1', ['rbac.read', 'rbac.assign']),
    ).resolves.toBe(false);
  });

  it('grants the role matrix when the database links are empty', async () => {
    const prisma = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: {
              code: 'EMPLOYEE',
              permissions: [],
            },
          },
        ]),
      },
    };
    const service = new PermissionsService(prisma as never);
    await expect(service.getEffectivePermissions('u1')).resolves.toEqual([
      'attendance.self',
      'helpdesk.self',
      'leave.self',
      'payslip.self',
    ]);
  });
});
