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
  await ensureNamed('location', 'Hyderabad');
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

  async function ensureAsset(input: {
    assetTag: string;
    category: 'laptop' | 'monitor' | 'phone' | 'access_card' | 'other';
    makeModel: string;
    serialNo: string;
    status: 'in_stock' | 'assigned' | 'repair' | 'retired' | 'lost';
  }) {
    return prisma.asset.upsert({
      where: { tenantId_assetTag: { tenantId: tenant.id, assetTag: input.assetTag } },
      update: {
        category: input.category,
        makeModel: input.makeModel,
        serialNo: input.serialNo,
      },
      create: {
        tenantId: tenant.id,
        ...input,
      },
    });
  }

  const harshLaptop = await ensureAsset({
    assetTag: 'LAP-266',
    category: 'laptop',
    makeModel: 'Dell Latitude 5440',
    serialNo: 'DL5440-BR266',
    status: 'assigned',
  });
  await ensureAsset({
    assetTag: 'MON-014',
    category: 'monitor',
    makeModel: 'Dell P2422H',
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
      data: { status: 'assigned' },
    });
  }
  void itEmployee;

  console.log(
    `Seeded tenant=${tenant.code} roles=${ROLE_CATALOG.length} users=5 admin=${adminEmail} harshDocs=${HARSH_DOCUMENTS.length}`,
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
