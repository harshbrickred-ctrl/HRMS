import { AssetRequestsService } from './asset-requests.service';

/** Who hears about a new asset request. The database and notification sender are mocked. */

const TENANT = 'tenant-1';
const REQUESTER_USER = 'user-requester';
const MANAGER_USER = 'user-manager';
const HEAD_USER = 'user-head';

function approver(id: string, userId: string, firstName: string) {
  return { id, userId, firstName, lastName: 'Approver', employeeCode: id.toUpperCase(), user: { status: 'ACTIVE' } };
}

function setup(options: { managerId: string | null; headId: string | null; categoryName?: string }) {
  const categoryName = options.categoryName ?? 'Laptop';
  const employee = {
    id: 'emp-1',
    tenantId: TENANT,
    userId: REQUESTER_USER,
    firstName: 'Rahul',
    lastName: 'Sharma',
    employeeCode: 'BR012',
    managerId: options.managerId,
    department: options.headId ? { name: 'Engineering', headId: options.headId } : null,
  };
  const prisma = {
    employee: { findUnique: jest.fn().mockResolvedValue(employee) },
    assetCategory: { findFirst: jest.fn().mockResolvedValue({ id: 'cat-1', name: categoryName }) },
    assetRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          id: 'req-1',
          number: 5,
          employee,
          category: { id: 'cat-1', name: categoryName },
          managerApprover: data.managerApproverId ? approver('mgr-1', MANAGER_USER, 'Rohit') : null,
          headApprover: data.headApproverId ? approver('head-1', HEAD_USER, 'Priya') : null,
          decisions: [],
          fulfilledAt: null,
          createdAt: new Date('2026-11-12T10:00:00Z'),
        }),
      ),
    },
  };
  const support = {
    audit: jest.fn().mockResolvedValue(undefined),
    notifyUser: jest.fn().mockResolvedValue(undefined),
    notifyAssetAdmins: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AssetRequestsService(prisma as never, support as never, {} as never);
  const submit = () => service.create(REQUESTER_USER, { categoryId: 'cat-1', reason: 'New joiner laptop' });
  return { support, submit };
}

describe('asset request submit notifications', () => {
  it('tells the reporting manager and the asset desk once each, linking IT to the request', async () => {
    const { support, submit } = setup({ managerId: 'mgr-1', headId: null });
    await submit();

    expect(support.notifyUser).toHaveBeenCalledTimes(1);
    expect(support.notifyUser).toHaveBeenCalledWith(TENANT, MANAGER_USER, {
      title: 'Asset request AR-000005 to approve',
      body: 'Rahul Sharma needs: Laptop',
    });
    expect(support.notifyAssetAdmins).toHaveBeenCalledTimes(1);
    expect(support.notifyAssetAdmins).toHaveBeenCalledWith(
      TENANT,
      {
        title: 'New asset request AR-000005',
        body: 'Rahul Sharma has submitted a Laptop request for approval.',
        href: '/it/requests?request=req-1',
      },
      [MANAGER_USER, REQUESTER_USER],
    );
  });

  it('writes "an" before asset names that start with a vowel', async () => {
    const { support, submit } = setup({ managerId: 'mgr-1', headId: null, categoryName: 'ID Card' });
    await submit();

    expect(support.notifyAssetAdmins.mock.calls[0][1].body).toBe(
      'Rahul Sharma has submitted an ID Card request for approval.',
    );
  });

  it('goes to the department head when there is no manager, and leaves the head out of the IT message', async () => {
    const { support, submit } = setup({ managerId: null, headId: 'head-1' });
    await submit();

    expect(support.notifyUser).toHaveBeenCalledTimes(1);
    expect(support.notifyUser.mock.calls[0][1]).toBe(HEAD_USER);
    expect(support.notifyAssetAdmins).toHaveBeenCalledTimes(1);
    expect(support.notifyAssetAdmins.mock.calls[0][2]).toEqual([HEAD_USER, REQUESTER_USER]);
  });

  it('sends the asset desk only the existing "no approver" notice when nobody can approve', async () => {
    const { support, submit } = setup({ managerId: null, headId: null });
    await submit();

    expect(support.notifyUser).not.toHaveBeenCalled();
    expect(support.notifyAssetAdmins).toHaveBeenCalledTimes(1);
    expect(support.notifyAssetAdmins.mock.calls[0][1].title).toBe('Asset request AR-000005 has no approver');
  });
});
