import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { HARSH_LEAVE, LEAVE_CATALOG } from '../src/hr/leave-catalog';
import {
  PERMISSIONS,
  ROLE_CATALOG,
  ROLE_PERMISSION_MATRIX,
} from '../src/rbac/role-matrix';

const prisma = new PrismaClient();
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

/** Same defaults the asset_master migration gives existing tenants. */
const ASSET_CATEGORIES = [
  {
    code: 'laptop',
    name: 'Laptop',
    tagPrefix: 'LAP',
    fields: [
      { key: 'ram', label: 'RAM', type: 'text' },
      { key: 'storage', label: 'Storage', type: 'text' },
      { key: 'processor', label: 'Processor', type: 'text' },
      { key: 'os', label: 'OS', type: 'text' },
    ],
  },
  {
    code: 'mobile',
    name: 'Mobile',
    tagPrefix: 'MOB',
    fields: [
      { key: 'imei', label: 'IMEI', type: 'text' },
      { key: 'device_number', label: 'Device Number', type: 'text' },
    ],
  },
  { code: 'id_card', name: 'ID Card', tagPrefix: 'IDC', fields: [] },
  { code: 'furniture', name: 'Furniture', tagPrefix: 'FUR', fields: [] },
  { code: 'access_card', name: 'Access Card', tagPrefix: 'ACC', fields: [] },
  {
    code: 'software_licence',
    name: 'Software Licence',
    tagPrefix: 'SWL',
    fields: [
      { key: 'licence_key', label: 'Licence Key', type: 'text' },
      { key: 'seat_count', label: 'Seat Count', type: 'number' },
    ],
  },
  { code: 'monitor', name: 'Monitor', tagPrefix: 'MON', fields: [] },
  { code: 'other', name: 'Other', tagPrefix: 'OTH', fields: [] },
];

const HARSH_DOCUMENTS: Array<{ fileName: string; category: string }> = [
  { fileName: 'BR_offer_letter_Acceptance.pdf', category: 'Brickred Documents' },
  { fileName: 'NDA_Acceptance.pdf', category: 'Brickred Documents' },
  { fileName: 'BR_Letter_of_Appointment_Acceptance.pdf', category: 'Brickred Documents' },
  { fileName: 'BR_Joining_Report_Confidential_Agreement.pdf', category: 'Brickred Documents' },
  { fileName: '12th_Pass_Certificate.pdf', category: 'Educational Certificates' },
  { fileName: '12th_Marksheet.pdf', category: 'Educational Certificates' },
  { fileName: 'Voter_ID.pdf', category: 'Employee Documents' },
  { fileName: '10th_Pass_Certificate.pdf', category: 'Employee Documents' },
  { fileName: 'Bank_Passbook.pdf', category: 'Employee Documents' },
  { fileName: 'passport_pic.pdf', category: 'Employee Documents' },
  { fileName: 'PAN.pdf', category: 'Employee Documents' },
  { fileName: 'Aadhar_Card.pdf', category: 'Employee Documents' },
  { fileName: 'Pay_Slip_Mar-May.pdf', category: 'Past Employment Documents' },
  { fileName: 'Resignation_Acceptance_Redlinux_Technologies.pdf', category: 'Past Employment Documents' },
];

function placeholderPdf(title: string) {
  const safe = title.replace(/[()\\]/g, ' ').slice(0, 80);
  const stream = `BT /F1 12 Tf 72 720 Td (${safe}) Tj ET`;
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
    `4 0 obj<< /Length ${Buffer.byteLength(stream)} >>stream\n${stream}\nendstream\nendobj`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += `${object}\n`;
  }
  const xref = offsets.length;
  const startxref = Buffer.byteLength(body);
  body += `xref\n0 ${xref}\n`;
  body += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer<< /Size ${xref} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(body);
}

const LEGACY_ROLE_CODES = ['Admin', 'Employee'];

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@peopleos.local')
    .trim()
    .toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing =
    (await prisma.tenant.findUnique({ where: { code: 'BR' } })) ??
    (await prisma.tenant.findUnique({ where: { code: 'default' } }));
  const tenant = existing
    ? await prisma.tenant.update({
        where: { id: existing.id },
        data: { code: 'BR', name: 'Brickred Systems' },
      })
    : await prisma.tenant.create({
        data: { code: 'BR', name: 'Brickred Systems' },
      });

  // Remove legacy role codes from default tenant
  await prisma.role.deleteMany({
    where: { tenantId: tenant.id, code: { in: LEGACY_ROLE_CODES } },
  });

  const rolesByCode = new Map<string, string>();
  for (const role of ROLE_CATALOG) {
    const row = await prisma.role.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: role.code } },
      update: { name: role.name },
      create: { tenantId: tenant.id, code: role.code, name: role.name },
    });
    rolesByCode.set(role.code, row.id);
  }

  const permsByCode = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: { code: perm.code, description: perm.description },
    });
    permsByCode.set(perm.code, row.id);
  }

  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const roleId = rolesByCode.get(roleCode);
    if (!roleId) continue;
    for (const permCode of permCodes) {
      const permissionId = permsByCode.get(permCode);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  async function upsertUser(email: string, roleCodes: string[]) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: { passwordHash, status: 'ACTIVE' },
      create: {
        tenantId: tenant.id,
        email,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    for (const code of roleCodes) {
      const roleId = rolesByCode.get(code);
      if (!roleId) continue;
      await prisma.userRole.create({
        data: { userId: user.id, roleId },
      });
    }
    return user;
  }

  await upsertUser(adminEmail, ['SECURITY_ADMIN']);
  const itUser = await upsertUser('it@peopleos.local', ['IT_ADMIN', 'EMPLOYEE']);
  const employeeUser = await upsertUser('employee@peopleos.local', ['EMPLOYEE']);
  const managerUser = await upsertUser('manager@peopleos.local', ['MANAGER', 'EMPLOYEE']);
  const hrUser = await upsertUser('hr@peopleos.local', ['HR_EXEC', 'EMPLOYEE']);

  async function ensureNamed(kind: 'department' | 'location', name: string) {
    if (kind === 'department') {
      return prisma.department.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        update: {},
        create: { tenantId: tenant.id, name },
      });
    }
    return prisma.location.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name },
    });
  }

  const engineering = await ensureNamed('department', 'Engineering');
  const product = await ensureNamed('department', 'Product');
  const humanResources = await ensureNamed('department', 'Human Resources');
  const finance = await ensureNamed('department', 'Finance');
  await ensureNamed('department', 'Leadership');
  const noida = await ensureNamed('location', 'Noida');
  const bengaluru = await ensureNamed('location', 'Bengaluru');
  const hyderabad = await ensureNamed('location', 'Hyderabad');
  const mumbai = await ensureNamed('location', 'Mumbai');

  async function ensureEmployee(input: {
    userId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    photo: string;
    departmentId: string;
    locationId: string;
  }) {
    return prisma.employee.upsert({
      where: { userId: input.userId },
      update: {
        employeeCode: input.employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
        designation: input.designation,
        photo: input.photo,
        departmentId: input.departmentId,
        locationId: input.locationId,
      },
      create: {
        tenantId: tenant.id,
        ...input,
      },
    });
  }

  const harsh = await ensureEmployee({
    userId: employeeUser.id,
    employeeCode: 'BR266',
    firstName: 'Harsh',
    lastName: 'Yadav',
    designation: 'Analyst - Development',
    photo: '/employees/harsh-yadav.png',
    departmentId: engineering.id,
    locationId: noida.id,
  });
  const rohit = await ensureEmployee({
    userId: managerUser.id,
    employeeCode: 'BR123',
    firstName: 'Rohit',
    lastName: 'Mehta',
    designation: 'Engineering Manager',
    photo: '/employees/rohit-mehta.png',
    departmentId: engineering.id,
    locationId: bengaluru.id,
  });
  const ananya = await ensureEmployee({
    userId: hrUser.id,
    employeeCode: 'BR156',
    firstName: 'Ananya',
    lastName: 'Desai',
    designation: 'HR Executive',
    photo: '/employees/ananya-desai.png',
    departmentId: humanResources.id,
    locationId: mumbai.id,
  });

  async function ensureTeam(
    name: string,
    departmentId: string,
    managerId?: string,
  ) {
    return prisma.team.upsert({
      where: {
        tenantId_departmentId_name: {
          tenantId: tenant.id,
          departmentId,
          name,
        },
      },
      update: { managerId: managerId ?? null },
      create: {
        tenantId: tenant.id,
        name,
        departmentId,
        managerId: managerId ?? null,
      },
    });
  }

  const platform = await ensureTeam('Platform', engineering.id, rohit.id);
  await ensureTeam('Quality', engineering.id);
  await ensureTeam('Design', product.id);
  const people = await ensureTeam('People', humanResources.id);
  await ensureTeam('Accounts', finance.id);

  await prisma.employee.update({
    where: { id: harsh.id },
    data: { teamId: platform.id, managerId: rohit.id },
  });
  await prisma.employee.update({
    where: { id: ananya.id },
    data: { teamId: people.id, managerId: null },
  });

  for (const employee of [harsh, rohit, ananya]) {
    const amounts = employee.id === harsh.id ? HARSH_LEAVE : {};
    for (const item of LEAVE_CATALOG) {
      const seeded = amounts[item.code] ?? { entitled: 0, used: 0, pending: 0 };
      await prisma.leaveBalance.upsert({
        where: { employeeId_code: { employeeId: employee.id, code: item.code } },
        update:
          employee.id === harsh.id
            ? seeded
            : {},
        create: {
          employeeId: employee.id,
          code: item.code,
          type: item.type,
          ...seeded,
        },
      });
    }
  }

  const general = await prisma.shift.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'GENERAL' } },
    update: {
      name: 'General',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      overnight: false,
    },
    create: {
      tenantId: tenant.id,
      code: 'GENERAL',
      name: 'General',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
    },
  });
  await prisma.attendancePolicy.upsert({
    where: { tenantId: tenant.id },
    update: {
      timeZone: 'Asia/Kolkata',
      graceMinutes: 10,
      halfDayMaxMinutes: 300,
      duplicateWindowMinutes: 5,
      webPunchEnabled: true,
    },
    create: { tenantId: tenant.id, webPunchEnabled: true },
  });
  for (const employee of [harsh, rohit, ananya]) {
    const open = await prisma.shiftAssignment.findFirst({
      where: { employeeId: employee.id, effectiveTo: null },
    });
    if (!open) {
      await prisma.shiftAssignment.create({
        data: {
          tenantId: tenant.id,
          employeeId: employee.id,
          shiftId: general.id,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
    }
  }
  const gandhi = new Date('2026-10-02T00:00:00.000Z');
  const existingHoliday = await prisma.holiday.findFirst({
    where: { tenantId: tenant.id, holidayDate: gandhi, locationId: null },
  });
  if (!existingHoliday) {
    await prisma.holiday.create({
      data: { tenantId: tenant.id, holidayDate: gandhi, name: 'Gandhi Jayanti' },
    });
  }

  const pendingLeave = await prisma.leaveRequest.findFirst({
    where: { tenantId: tenant.id, employeeId: harsh.id, status: 'Pending' },
  });
  if (!pendingLeave) {
    await prisma.leaveRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: harsh.id,
        code: 'CL',
        type: 'Casual Leave',
        fromDate: new Date('2026-10-22T00:00:00.000Z'),
        toDate: new Date('2026-10-22T00:00:00.000Z'),
        days: 1,
        reason: 'Personal errand',
        status: 'Pending',
        approverEmployeeId: rohit.id,
      },
    });
  }
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: { tenantId: tenant.id, employeeId: harsh.id, status: 'Approved' },
  });
  if (!approvedLeave) {
    await prisma.leaveRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: harsh.id,
        code: 'SL',
        type: 'Sick Leave',
        fromDate: new Date('2026-09-08T00:00:00.000Z'),
        toDate: new Date('2026-09-08T00:00:00.000Z'),
        days: 1,
        reason: 'Fever',
        status: 'Approved',
        approverEmployeeId: rohit.id,
        decidedAt: new Date('2026-09-07T10:00:00.000Z'),
        decisionNote: 'Get well soon',
      },
    });
  }

  for (const doc of HARSH_DOCUMENTS) {
    const existing = await prisma.employeeDocument.findFirst({
      where: { employeeId: harsh.id, fileName: doc.fileName },
    });
    if (existing) continue;
    const id = randomUUID();
    const relative = path.join(tenant.id, harsh.id, `${id}-${doc.fileName}`);
    const absolute = path.join(UPLOAD_ROOT, relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, placeholderPdf(doc.fileName.replace(/\.pdf$/i, '')));
    await prisma.employeeDocument.create({
      data: {
        id,
        employeeId: harsh.id,
        fileName: doc.fileName,
        category: doc.category,
        storagePath: relative.replace(/\\/g, '/'),
      },
    });
  }

  const itEmployee = await ensureEmployee({
    userId: itUser.id,
    employeeCode: 'BR900',
    firstName: 'Isha',
    lastName: 'Kapoor',
    designation: 'IT Administrator',
    photo: '',
    departmentId: engineering.id,
    locationId: noida.id,
  });

  await prisma.department.update({ where: { id: engineering.id }, data: { headId: rohit.id } });

  const categoryIds = new Map<string, string>();
  for (const category of ASSET_CATEGORIES) {
    const row = await prisma.assetCategory.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: category.code } },
      update: {},
      create: { tenantId: tenant.id, ...category },
    });
    categoryIds.set(category.code, row.id);
  }

  type SeedAssetStatus = 'in_stock' | 'allocated' | 'under_maintenance' | 'lost' | 'retired';

  async function ensureAsset(input: {
    assetTag: string;
    category: string;
    name: string;
    make: string;
    model: string;
    serialNo: string;
    status: SeedAssetStatus;
    purchasedOn?: string;
    vendor?: string;
    cost?: number;
    warrantyExpiry?: string;
    locationId?: string;
    description?: string;
    customFields?: Record<string, string | number>;
  }) {
    const { assetTag, category, status, purchasedOn, warrantyExpiry, ...details } = input;
    const categoryId = categoryIds.get(category)!;
    const dates = {
      ...(purchasedOn ? { purchasedOn: new Date(purchasedOn) } : {}),
      ...(warrantyExpiry ? { warrantyExpiry: new Date(warrantyExpiry) } : {}),
    };
    return prisma.asset.upsert({
      where: { tenantId_assetTag: { tenantId: tenant.id, assetTag } },
      update: { categoryId, ...details, ...dates },
      create: { tenantId: tenant.id, assetTag, categoryId, status, ...details, ...dates },
    });
  }

  const harshLaptop = await ensureAsset({
    assetTag: 'LAP-266',
    category: 'laptop',
    name: 'Dell Latitude 5440',
    make: 'Dell',
    model: 'Latitude 5440',
    serialNo: 'DL5440-BR266',
    status: 'allocated',
  });
  await ensureAsset({
    assetTag: 'MON-014',
    category: 'monitor',
    name: 'Dell P2422H',
    make: 'Dell',
    model: 'P2422H',
    serialNo: 'MON-P2422H-014',
    status: 'in_stock',
  });
  const openLaptop = await prisma.assetAssignment.findFirst({
    where: { assetId: harshLaptop.id, returnedOn: null },
  });
  if (!openLaptop) {
    await prisma.assetAssignment.create({
      data: {
        tenantId: tenant.id,
        assetId: harshLaptop.id,
        employeeId: harsh.id,
        assignedOn: new Date('2026-01-06T00:00:00.000Z'),
        conditionNotes: 'Issued on joining',
      },
    });
    await prisma.asset.update({
      where: { id: harshLaptop.id },
      data: { status: 'allocated' },
    });
  }
  const holders = {
    harsh: { employeeId: harsh.id, userId: employeeUser.id, name: 'Harsh Yadav' },
    rohit: { employeeId: rohit.id, userId: managerUser.id, name: 'Rohit Mehta' },
    ananya: { employeeId: ananya.id, userId: hrUser.id, name: 'Ananya Desai' },
    isha: { employeeId: itEmployee.id, userId: itUser.id, name: 'Isha Kapoor' },
  };
  type Holder = keyof typeof holders;
  type AssetStory =
    | { kind: 'allocated'; to: Holder; on: string; accessories?: string; acknowledged: boolean }
    | { kind: 'maintenance'; issue: string; vendor: string; vendorContact: string; startedOn: string; expectedOn: string }
    | { kind: 'lost'; from: Holder; allocatedOn: string; lostOn: string; reason: string }
    | { kind: 'retired'; on: string; reason: string };

  const REGISTER: Array<Parameters<typeof ensureAsset>[0] & { story?: AssetStory }> = [
    {
      assetTag: 'LAP-0001', category: 'laptop', name: 'MacBook Pro 14" M3 Pro', make: 'Apple', model: 'MacBook Pro 14 (2023)',
      serialNo: 'C02ZK1M3PRO1', status: 'allocated', purchasedOn: '2025-11-12', vendor: 'Unicorn Infosolutions', cost: 199900,
      warrantyExpiry: '2027-11-11', locationId: bengaluru.id, customFields: { ram: '18 GB', storage: '512 GB SSD', processor: 'Apple M3 Pro' },
      story: { kind: 'allocated', to: 'rohit', on: '2025-11-20', accessories: '96W USB-C charger, sleeve', acknowledged: true },
    },
    {
      assetTag: 'LAP-0002', category: 'laptop', name: 'ThinkPad T14 Gen 4', make: 'Lenovo', model: 'T14 Gen 4',
      serialNo: 'PF4T14G4A02', status: 'allocated', purchasedOn: '2026-02-03', vendor: 'Rashi Peripherals', cost: 112500,
      warrantyExpiry: '2029-02-02', locationId: mumbai.id, customFields: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i7-1355U' },
      story: { kind: 'allocated', to: 'ananya', on: '2026-02-10', accessories: '65W charger, backpack', acknowledged: true },
    },
    {
      assetTag: 'LAP-0003', category: 'laptop', name: 'Latitude 7440', make: 'Dell', model: 'Latitude 7440',
      serialNo: 'DL7440-IT0003', status: 'allocated', purchasedOn: '2026-03-15', vendor: 'Dell India Online', cost: 128000,
      warrantyExpiry: '2029-03-14', locationId: noida.id, customFields: { ram: '32 GB', storage: '1 TB SSD', processor: 'Intel Core i7-1365U' },
      story: { kind: 'allocated', to: 'isha', on: '2026-03-18', accessories: '65W charger, docking station', acknowledged: true },
    },
    {
      assetTag: 'LAP-0004', category: 'laptop', name: 'EliteBook 840 G10', make: 'HP', model: 'EliteBook 840 G10',
      serialNo: '5CG3401HP04', status: 'in_stock', purchasedOn: '2026-09-22', vendor: 'Rashi Peripherals', cost: 104300,
      warrantyExpiry: '2029-09-21', locationId: noida.id, customFields: { ram: '16 GB', storage: '512 GB SSD', processor: 'Intel Core i5-1345U' },
      description: 'Ready for the November joiners batch.',
    },
    {
      assetTag: 'LAP-0005', category: 'laptop', name: 'ThinkPad E14 Gen 5', make: 'Lenovo', model: 'E14 Gen 5',
      serialNo: 'PF4E14G5A05', status: 'under_maintenance', purchasedOn: '2025-06-09', vendor: 'Rashi Peripherals', cost: 68900,
      warrantyExpiry: '2026-12-08', locationId: hyderabad.id, customFields: { ram: '16 GB', storage: '512 GB SSD', processor: 'AMD Ryzen 5 7530U' },
      story: {
        kind: 'maintenance', issue: 'Battery swelling, trackpad lifting', vendor: 'Lenovo Service Centre, Hyderabad',
        vendorContact: '1800-419-4666', startedOn: '2026-10-27', expectedOn: '2026-11-07',
      },
    },
    {
      assetTag: 'LAP-0006', category: 'laptop', name: 'Latitude 5420', make: 'Dell', model: 'Latitude 5420',
      serialNo: 'DL5420-OLD006', status: 'retired', purchasedOn: '2021-08-02', vendor: 'Dell India Online', cost: 74000,
      warrantyExpiry: '2024-08-01', locationId: noida.id, customFields: { ram: '8 GB', storage: '256 GB SSD', processor: 'Intel Core i5-1145G7' },
      story: { kind: 'retired', on: '2026-08-14', reason: 'End of life, warranty expired and below spec' },
    },
    {
      assetTag: 'MOB-0001', category: 'mobile', name: 'iPhone 15', make: 'Apple', model: 'iPhone 15 128 GB',
      serialNo: 'F2LXQ15MOB01', status: 'allocated', purchasedOn: '2025-12-01', vendor: 'Imagine Store', cost: 79900,
      warrantyExpiry: '2026-11-30', locationId: bengaluru.id, customFields: { imei: '356789104512301', device_number: '+91 98450 11201' },
      story: { kind: 'allocated', to: 'rohit', on: '2025-12-03', accessories: 'USB-C cable, case', acknowledged: true },
    },
    {
      assetTag: 'MOB-0002', category: 'mobile', name: 'Galaxy S23', make: 'Samsung', model: 'SM-S911B',
      serialNo: 'R5CW23S23M02', status: 'in_stock', purchasedOn: '2026-04-18', vendor: 'Samsung Business Direct', cost: 64999,
      warrantyExpiry: '2027-04-17', locationId: noida.id, customFields: { imei: '352315402318822', device_number: '' },
    },
    {
      assetTag: 'MOB-0003', category: 'mobile', name: 'Pixel 7a', make: 'Google', model: 'Pixel 7a',
      serialNo: '2B071JEGR0003', status: 'lost', purchasedOn: '2025-07-21', vendor: 'Flipkart Business', cost: 39999,
      warrantyExpiry: '2026-07-20', locationId: noida.id, customFields: { imei: '358240051190334', device_number: '+91 99100 22603' },
      story: {
        kind: 'lost', from: 'harsh', allocatedOn: '2026-01-06', lostOn: '2026-09-29',
        reason: 'Lost while commuting; FIR filed at Sector 62 police station',
      },
    },
    {
      assetTag: 'MON-0001', category: 'monitor', name: 'UltraFine 27UL850', make: 'LG', model: '27UL850-W',
      serialNo: 'LG27UL850M01', status: 'allocated', purchasedOn: '2025-10-04', vendor: 'Amazon Business', cost: 38500,
      warrantyExpiry: '2028-10-03', locationId: noida.id,
      story: { kind: 'allocated', to: 'harsh', on: '2026-01-06', accessories: 'USB-C cable, HDMI cable', acknowledged: true },
    },
    {
      assetTag: 'MON-0002', category: 'monitor', name: 'UltraSharp U2723QE', make: 'Dell', model: 'U2723QE',
      serialNo: 'CN0U2723QE02', status: 'in_stock', purchasedOn: '2026-05-30', vendor: 'Dell India Online', cost: 52000,
      warrantyExpiry: '2029-05-29', locationId: bengaluru.id,
    },
    {
      assetTag: 'ACC-0001', category: 'access_card', name: 'Noida office access card', make: 'HID', model: 'iCLASS SE',
      serialNo: 'HID-NOI-04471', status: 'allocated', purchasedOn: '2026-01-02', vendor: 'Secure Access Systems', cost: 650,
      locationId: noida.id, description: 'Floors 3 and 4, server room excluded.',
      story: { kind: 'allocated', to: 'harsh', on: '2026-01-06', acknowledged: true },
    },
    {
      assetTag: 'ACC-0002', category: 'access_card', name: 'Noida office access card', make: 'HID', model: 'iCLASS SE',
      serialNo: 'HID-NOI-04472', status: 'in_stock', purchasedOn: '2026-01-02', vendor: 'Secure Access Systems', cost: 650,
      locationId: noida.id,
    },
    {
      assetTag: 'IDC-0001', category: 'id_card', name: 'Employee ID card', make: 'Brickred', model: 'PVC photo ID',
      serialNo: 'IDC-BR156', status: 'allocated', purchasedOn: '2026-02-05', vendor: 'PrintStop', cost: 250,
      locationId: mumbai.id,
      story: { kind: 'allocated', to: 'ananya', on: '2026-02-10', accessories: 'Lanyard', acknowledged: true },
    },
    {
      assetTag: 'IDC-0002', category: 'id_card', name: 'Employee ID card', make: 'Brickred', model: 'PVC photo ID',
      serialNo: 'IDC-BR900', status: 'allocated', purchasedOn: '2026-03-12', vendor: 'PrintStop', cost: 250,
      locationId: noida.id,
      story: { kind: 'allocated', to: 'isha', on: '2026-10-30', accessories: 'Lanyard', acknowledged: false },
    },
    {
      assetTag: 'FUR-0001', category: 'furniture', name: 'Aeron ergonomic chair', make: 'Herman Miller', model: 'Aeron Size B',
      serialNo: 'HM-AER-B0001', status: 'allocated', purchasedOn: '2025-09-15', vendor: 'Featherlite Office Furniture', cost: 142000,
      warrantyExpiry: '2037-09-14', locationId: bengaluru.id,
      story: { kind: 'allocated', to: 'rohit', on: '2025-09-20', acknowledged: true },
    },
    {
      assetTag: 'FUR-0002', category: 'furniture', name: 'Electric standing desk', make: 'Featherlite', model: 'Elevate 1500',
      serialNo: 'FL-ELV-1500-02', status: 'in_stock', purchasedOn: '2026-06-11', vendor: 'Featherlite Office Furniture', cost: 46000,
      warrantyExpiry: '2031-06-10', locationId: noida.id,
    },
    {
      assetTag: 'SWL-0001', category: 'software_licence', name: 'JetBrains All Products Pack', make: 'JetBrains', model: 'Organisation subscription',
      serialNo: 'JB-ORG-2026-0001', status: 'in_stock', purchasedOn: '2026-04-01', vendor: 'JetBrains s.r.o.', cost: 245000,
      warrantyExpiry: '2027-03-31', customFields: { licence_key: 'JB-XXXX-XXXX-7Q2M', seat_count: 10 },
      description: 'Annual subscription; seats assigned from the JetBrains account portal.',
    },
    {
      assetTag: 'SWL-0002', category: 'software_licence', name: 'Adobe Creative Cloud for teams', make: 'Adobe', model: 'All Apps',
      serialNo: 'ADB-CCT-2026-0002', status: 'allocated', purchasedOn: '2026-02-01', vendor: 'Adobe Systems India', cost: 58000,
      warrantyExpiry: '2027-01-31', customFields: { licence_key: 'ADB-XXXX-XXXX-91KF', seat_count: 1 },
      story: { kind: 'allocated', to: 'ananya', on: '2026-02-12', acknowledged: false },
    },
    {
      assetTag: 'OTH-0001', category: 'other', name: 'MX Keys + MX Master 3S combo', make: 'Logitech', model: 'MX Keys S Combo',
      serialNo: 'LGT-MXC-0001', status: 'in_stock', purchasedOn: '2026-07-08', vendor: 'Amazon Business', cost: 17995,
      warrantyExpiry: '2027-07-07', locationId: noida.id,
    },
  ];

  const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
  for (const { story, ...item } of REGISTER) {
    const asset = await ensureAsset(item);
    if (!story) continue;
    // Write each asset's history once, so changes made in the app survive a re-seed.
    const [assignments, history] = await Promise.all([
      prisma.assetAssignment.count({ where: { assetId: asset.id } }),
      prisma.assetStatusHistory.count({ where: { assetId: asset.id } }),
    ]);
    if (assignments > 0 || history > 0) continue;
    const base = { tenantId: tenant.id, assetId: asset.id, changedById: itUser.id };

    if (story.kind === 'allocated') {
      const holder = holders[story.to];
      await prisma.assetAssignment.create({
        data: {
          tenantId: tenant.id,
          assetId: asset.id,
          employeeId: holder.employeeId,
          assignedOn: day(story.on),
          issueCondition: 'good',
          accessories: story.accessories ?? '',
          issuedById: itUser.id,
          ...(story.acknowledged
            ? { ackStatus: 'acknowledged', ackAt: day(story.on), ackById: holder.userId, ackMethod: 'digital' }
            : {}),
        },
      });
      await prisma.assetStatusHistory.create({
        data: { ...base, fromStatus: 'in_stock', toStatus: 'allocated', reason: `Allocated to ${holder.name}`, source: 'allocation', changedAt: day(story.on) },
      });
    } else if (story.kind === 'maintenance') {
      await prisma.assetMaintenance.create({
        data: {
          tenantId: tenant.id,
          assetId: asset.id,
          issue: story.issue,
          vendor: story.vendor,
          vendorContact: story.vendorContact,
          startedOn: day(story.startedOn),
          expectedOn: day(story.expectedOn),
          createdById: itUser.id,
        },
      });
      await prisma.assetStatusHistory.create({
        data: { ...base, fromStatus: 'in_stock', toStatus: 'under_maintenance', reason: story.issue, source: 'maintenance', changedAt: day(story.startedOn) },
      });
    } else if (story.kind === 'lost') {
      const holder = holders[story.from];
      await prisma.assetAssignment.create({
        data: {
          tenantId: tenant.id,
          assetId: asset.id,
          employeeId: holder.employeeId,
          assignedOn: day(story.allocatedOn),
          issueCondition: 'good',
          issuedById: itUser.id,
          ackStatus: 'acknowledged',
          ackAt: day(story.allocatedOn),
          ackById: holder.userId,
          ackMethod: 'digital',
          returnedOn: day(story.lostOn),
          returnedById: itUser.id,
          endReason: 'lost',
          damageNotes: story.reason,
        },
      });
      await prisma.assetStatusHistory.createMany({
        data: [
          { ...base, fromStatus: 'in_stock', toStatus: 'allocated', reason: `Allocated to ${holder.name}`, source: 'allocation', changedAt: day(story.allocatedOn) },
          { ...base, fromStatus: 'allocated', toStatus: 'lost', reason: story.reason, source: 'status', changedAt: day(story.lostOn) },
        ],
      });
    } else {
      await prisma.assetStatusHistory.create({
        data: { ...base, fromStatus: 'in_stock', toStatus: 'retired', reason: story.reason, source: 'status', changedAt: day(story.on) },
      });
    }
  }

  console.log(
    `Seeded tenant=${tenant.code} roles=${ROLE_CATALOG.length} users=5 admin=${adminEmail} harshDocs=${HARSH_DOCUMENTS.length} assets=${REGISTER.length + 2}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
