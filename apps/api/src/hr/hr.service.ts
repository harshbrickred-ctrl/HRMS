import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createReadStream, promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';
import { Readable } from 'stream';
import { AttendanceService } from '../attendance/attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { rolesSeniorToActor, SYSTEM_ADMIN_CODES } from '../rbac/role-matrix';
import { LEAVE_CATALOG, leaveTypeName } from './leave-catalog';
import type {
  AdjustLeaveDto,
  CreateEmployeeDto,
  CreateTeamDto,
  NameDto,
  UpdateEmployeeDto,
  UpdateLeaveBalancesDto,
  UpdateTeamDto,
} from './dto/hr.dto';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const ALLOWED_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx']);

const employeeInclude = {
  user: { include: { roles: { include: { role: true } } } },
  department: true,
  location: true,
  team: true,
  manager: true,
  leaveBalances: { orderBy: { code: 'asc' as const } },
  documents: {
    orderBy: { uploadedAt: 'desc' as const },
    select: {
      id: true,
      fileName: true,
      category: true,
      uploadedAt: true,
    },
  },
  salaryStructure: {
    select: {
      monthlyGross: true,
      basic: true,
      hra: true,
      da: true,
      otherAllowances: true,
      statutoryBonus: true,
      dailyAllowance: true,
      gratuityMonthly: true,
      leaveEncashment: true,
    },
  },
} satisfies Prisma.EmployeeInclude;

type EmployeeRow = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>;

function available(entitled: number, used: number, pending: number) {
  return entitled - used - pending;
}

function blankToNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

type PayInput = {
  bankName?: string;
  ifscCode?: string;
  bankAccountNumber?: string;
  basic?: number;
  hra?: number;
  specialAllowance?: number;
  statutoryBonus?: number;
  dailyAllowance?: number;
  gratuity?: number;
  leaveEncashment?: number;
};

function rupee(value: number | undefined) {
  const amount = Math.round(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new BadRequestException('Salary amounts cannot be negative.');
  }
  return amount;
}

function bankData(dto: PayInput, required: boolean) {
  const bankName = (dto.bankName ?? '').trim();
  const ifscCode = (dto.ifscCode ?? '').trim().toUpperCase();
  const bankAccountNumber = (dto.bankAccountNumber ?? '').replace(/\s/g, '');
  if (!required && !bankName && !ifscCode && !bankAccountNumber) {
    return { bankName: '', ifscCode: '', bankAccountNumber: '' };
  }
  if (!bankName) throw new BadRequestException('Enter the bank name.');
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
    throw new BadRequestException('Enter a valid 11-character IFSC code.');
  }
  if (!/^\d{9,18}$/.test(bankAccountNumber)) {
    throw new BadRequestException('Enter the bank account number, 9 to 18 digits.');
  }
  return { bankName, ifscCode, bankAccountNumber };
}

function payAmounts(dto: PayInput, required: boolean) {
  const basic = rupee(dto.basic);
  const hra = rupee(dto.hra);
  const special = rupee(dto.specialAllowance);
  const statutoryBonus = rupee(dto.statutoryBonus);
  const dailyAllowance = rupee(dto.dailyAllowance);
  const gratuityMonthly = rupee(dto.gratuity);
  const leaveEncashment = rupee(dto.leaveEncashment);
  if (required && basic <= 0) throw new BadRequestException('Enter basic salary.');
  return { basic, hra, special, statutoryBonus, dailyAllowance, gratuityMonthly, leaveEncashment };
}

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
  ) {}

  async org(tenantId: string) {
    const [departments, locations, teams] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
      this.prisma.location.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
      this.prisma.team.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
        include: {
          department: true,
          manager: true,
        },
      }),
    ]);
    return {
      departments,
      locations,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        departmentId: team.departmentId,
        departmentName: team.department.name,
        managerId: team.managerId,
        managerName: team.manager
          ? `${team.manager.firstName} ${team.manager.lastName}`.trim()
          : null,
      })),
    };
  }

  async createDepartment(tenantId: string, dto: NameDto) {
    return this.createNamed(tenantId, 'department', dto.name);
  }

  async renameDepartment(tenantId: string, id: string, dto: NameDto) {
    await this.requireDepartment(tenantId, id);
    return this.renameNamed('department', id, dto.name);
  }

  async deleteDepartment(tenantId: string, id: string) {
    await this.requireDepartment(tenantId, id);
    const [teams, employees] = await Promise.all([
      this.prisma.team.count({ where: { departmentId: id } }),
      this.prisma.employee.count({ where: { departmentId: id } }),
    ]);
    if (teams || employees) {
      throw new ConflictException(
        'Move teams and employees out of this department before removing it.',
      );
    }
    await this.prisma.department.delete({ where: { id } });
    return { ok: true };
  }

  async createLocation(tenantId: string, dto: NameDto) {
    return this.createNamed(tenantId, 'location', dto.name);
  }

  async renameLocation(tenantId: string, id: string, dto: NameDto) {
    await this.requireLocation(tenantId, id);
    return this.renameNamed('location', id, dto.name);
  }

  async deleteLocation(tenantId: string, id: string) {
    await this.requireLocation(tenantId, id);
    const employees = await this.prisma.employee.count({ where: { locationId: id } });
    if (employees) {
      throw new ConflictException('Move employees out of this location before removing it.');
    }
    await this.prisma.location.delete({ where: { id } });
    return { ok: true };
  }

  async createTeam(tenantId: string, dto: CreateTeamDto) {
    await this.requireDepartment(tenantId, dto.departmentId);
    if (dto.managerId) await this.requireEmployee(tenantId, dto.managerId);
    try {
      const team = await this.prisma.team.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          departmentId: dto.departmentId,
          managerId: blankToNull(dto.managerId),
        },
      });
      return this.org(tenantId).then((org) => org.teams.find((item) => item.id === team.id));
    } catch (error) {
      this.rethrowUnique(error, 'A team with that name already exists in this department.');
    }
  }

  async updateTeam(tenantId: string, id: string, dto: UpdateTeamDto) {
    const team = await this.prisma.team.findFirst({ where: { id, tenantId } });
    if (!team) throw new NotFoundException('Team not found');
    const departmentId = dto.departmentId ?? team.departmentId;
    if (dto.departmentId) await this.requireDepartment(tenantId, dto.departmentId);
    const managerId =
      dto.managerId === undefined ? team.managerId : blankToNull(dto.managerId);
    if (managerId) await this.requireEmployee(tenantId, managerId);
    try {
      await this.prisma.team.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? team.name,
          departmentId,
          managerId,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'A team with that name already exists in this department.');
    }
    if (departmentId !== team.departmentId) {
      await this.prisma.employee.updateMany({
        where: { teamId: id, departmentId: { not: departmentId } },
        data: { teamId: null },
      });
    }
    const org = await this.org(tenantId);
    return org.teams.find((item) => item.id === id);
  }

  async deleteTeam(tenantId: string, id: string) {
    const team = await this.prisma.team.findFirst({ where: { id, tenantId } });
    if (!team) throw new NotFoundException('Team not found');
    const members = await this.prisma.employee.count({ where: { teamId: id } });
    if (members) {
      throw new ConflictException('Move employees off this team before removing it.');
    }
    await this.prisma.team.delete({ where: { id } });
    return { ok: true };
  }

  listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }

  async listEmployees(tenantId: string) {
    const rows = await this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      include: employeeInclude,
    });
    return rows.map((row) => this.serialize(row, false));
  }

  async directory(tenantId: string) {
    const rows = await this.listEmployees(tenantId);
    return rows.map((row) => ({
      id: row.id,
      employeeCode: row.employeeCode,
      firstName: row.firstName,
      lastName: row.lastName,
      designation: row.designation,
      photo: row.photo,
      email: row.email,
      status: row.status,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      locationId: row.locationId,
      locationName: row.locationName,
      teamId: row.teamId,
      teamName: row.teamName,
      managerId: row.managerId,
      managerName: row.managerName,
    }));
  }

  async getEmployee(tenantId: string, id: string) {
    const row = await this.requireEmployee(tenantId, id);
    return this.serialize(row, true);
  }

  async createEmployee(tenantId: string, actorUserId: string, dto: CreateEmployeeDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email },
    });
    if (existing) throw new ConflictException('An account with that email already exists.');

    const departmentId = blankToNull(dto.departmentId);
    const locationId = blankToNull(dto.locationId);
    const teamId = blankToNull(dto.teamId);
    const managerId = blankToNull(dto.managerId);
    await this.assertPlacement(tenantId, departmentId, locationId, teamId, managerId, null);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const employeeCode = await this.nextEmployeeCode(tenantId);
    const roles = await this.resolveRoles(tenantId, dto.roleCodes);
    await this.assertActorMayAssignRoles(
      actorUserId,
      roles.map((role) => role.code),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          email,
          passwordHash,
          status: dto.status ?? 'ACTIVE',
        },
      });
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
      });
      const bank = bankData(dto, true);
      const pay = payAmounts(dto, true);
      const employee = await tx.employee.create({
        data: {
          tenantId,
          userId: user.id,
          employeeCode,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          designation: dto.designation.trim(),
          ...bank,
          departmentId,
          locationId,
          teamId,
          managerId,
          leaveBalances: {
            create: LEAVE_CATALOG.map((item) => ({
              code: item.code,
              type: item.type,
            })),
          },
        },
      });
      await tx.salaryStructure.create({
        data: {
          tenantId,
          employeeId: employee.id,
          monthlyGross: pay.basic + pay.hra + pay.special + pay.statutoryBonus + pay.dailyAllowance,
          basic: pay.basic,
          hra: pay.hra,
          statutoryBonus: pay.statutoryBonus,
          dailyAllowance: pay.dailyAllowance,
          gratuityMonthly: pay.gratuityMonthly,
          leaveEncashment: pay.leaveEncashment,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorUserId,
          action: 'hr.employee.create',
          entityType: 'Employee',
          entityId: employee.id,
          metadata: { email, roles: roles.map((role) => role.code) },
        },
      });
      return employee.id;
    });

    await this.attendance.ensureDefaultAssignment(tenantId, created);
    return this.getEmployee(tenantId, created);
  }

  async updateEmployee(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateEmployeeDto,
  ) {
    const current = await this.requireEmployee(tenantId, id);
    const departmentId =
      dto.departmentId === undefined ? current.departmentId : blankToNull(dto.departmentId);
    const locationId =
      dto.locationId === undefined ? current.locationId : blankToNull(dto.locationId);
    let teamId = dto.teamId === undefined ? current.teamId : blankToNull(dto.teamId);
    const managerId =
      dto.managerId === undefined ? current.managerId : blankToNull(dto.managerId);

    if (teamId) {
      const team = await this.prisma.team.findFirst({ where: { id: teamId, tenantId } });
      if (!team) throw new BadRequestException('Team not found');
      if (departmentId && team.departmentId !== departmentId) {
        if (dto.teamId === undefined) teamId = null;
        else throw new BadRequestException('That team belongs to a different department.');
      }
    }

    await this.assertPlacement(tenantId, departmentId, locationId, teamId, managerId, id);

    if (dto.roleCodes) {
      await this.replaceRoles(tenantId, actorUserId, current.userId, dto.roleCodes);
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    const touchesBank =
      dto.bankName !== undefined || dto.ifscCode !== undefined || dto.bankAccountNumber !== undefined;
    const touchesPay =
      dto.basic !== undefined ||
      dto.hra !== undefined ||
      dto.specialAllowance !== undefined ||
      dto.statutoryBonus !== undefined ||
      dto.dailyAllowance !== undefined ||
      dto.gratuity !== undefined ||
      dto.leaveEncashment !== undefined;
    const bank = touchesBank ? bankData(dto, false) : null;
    const pay = touchesPay ? payAmounts(dto, false) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: current.userId },
        data: {
          status: dto.status,
          passwordHash,
        },
      });
      await tx.employee.update({
        where: { id },
        data: {
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          designation: dto.designation?.trim(),
          ...(bank ?? {}),
          departmentId,
          locationId,
          teamId,
          managerId,
        },
      });
      if (pay) {
        const existing = await tx.salaryStructure.findUnique({ where: { employeeId: id } });
        const anyPay =
          pay.basic + pay.hra + pay.special + pay.statutoryBonus + pay.dailyAllowance + pay.gratuityMonthly + pay.leaveEncashment > 0;
        if (anyPay || existing) {
          const monthlyGross =
            pay.basic +
            pay.hra +
            pay.special +
            pay.statutoryBonus +
            pay.dailyAllowance +
            (existing?.da ?? 0) +
            (existing?.otherAllowances ?? 0);
          await tx.salaryStructure.upsert({
            where: { employeeId: id },
            create: {
              tenantId,
              employeeId: id,
              monthlyGross,
              basic: pay.basic,
              hra: pay.hra,
              statutoryBonus: pay.statutoryBonus,
              dailyAllowance: pay.dailyAllowance,
              gratuityMonthly: pay.gratuityMonthly,
              leaveEncashment: pay.leaveEncashment,
            },
            update: {
              monthlyGross,
              basic: pay.basic,
              hra: pay.hra,
              statutoryBonus: pay.statutoryBonus,
              dailyAllowance: pay.dailyAllowance,
              gratuityMonthly: pay.gratuityMonthly,
              leaveEncashment: pay.leaveEncashment,
            },
          });
        }
      }
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorUserId,
          action: 'hr.employee.update',
          entityType: 'Employee',
          entityId: id,
          metadata: {
            status: dto.status ?? current.user.status,
            passwordReset: Boolean(dto.password),
          },
        },
      });
    });

    return this.getEmployee(tenantId, id);
  }

  async updateLeaveBalances(tenantId: string, id: string, dto: UpdateLeaveBalancesDto) {
    const employee = await this.requireEmployee(tenantId, id);
    const known = new Map(employee.leaveBalances.map((row) => [row.code, row]));
    for (const item of dto.balances) {
      if (!known.has(item.code)) {
        throw new BadRequestException(`Unknown leave code: ${item.code}`);
      }
    }
    await this.prisma.$transaction(
      dto.balances.map((item) =>
        this.prisma.leaveBalance.update({
          where: { employeeId_code: { employeeId: id, code: item.code } },
          data: {
            entitled: item.entitled,
            used: item.used,
            pending: item.pending,
          },
        }),
      ),
    );
    return this.getEmployee(tenantId, id);
  }

  async me(userId: string) {
    const row = await this.prisma.employee.findUnique({
      where: { userId },
      include: employeeInclude,
    });
    if (!row) throw new NotFoundException('No employee record');
    return this.serialize(row, true);
  }

  async adjustMyLeave(userId: string, dto: AdjustLeaveDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { leaveBalances: true },
    });
    if (!employee) throw new NotFoundException('No employee record');
    const balance = employee.leaveBalances.find((item) => item.code === dto.code);
    if (!balance) throw new BadRequestException('Unknown leave type.');
    const delta = dto.direction === 'apply' ? dto.days : -dto.days;
    const nextPending = balance.pending + delta;
    if (nextPending < 0) {
      throw new BadRequestException('Pending leave cannot go below zero.');
    }
    if (dto.direction === 'apply' && dto.code !== 'LOP') {
      const left = available(balance.entitled, balance.used, balance.pending);
      if (dto.days > left) {
        throw new BadRequestException(
          `Only ${left} day(s) available for ${balance.type}.`,
        );
      }
    }
    await this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { pending: nextPending },
    });
    return this.me(userId);
  }

  async addDocument(
    tenantId: string,
    employeeId: string,
    file: { originalname: string; buffer: Buffer; size: number },
    category: string,
  ) {
    await this.requireEmployee(tenantId, employeeId);
    if (!file?.buffer?.length) throw new BadRequestException('Choose a file to upload.');
    const safeName = path.basename(file.originalname).replace(/[^\w.\- ()]+/g, '_');
    const ext = safeName.includes('.') ? safeName.split('.').pop()!.toLowerCase() : '';
    if (!ALLOWED_EXT.has(ext)) {
      throw new BadRequestException('Use a PDF, PNG, JPG, DOC, or DOCX file.');
    }
    if (!file.buffer?.length) throw new BadRequestException('Choose a file to upload.');
    const label = category.trim();
    if (!label) throw new BadRequestException('Category is required.');

    const id = randomUUID();
    await this.ensureDocumentContentColumn();
    let storagePath = 'inline';
    const relative = path.join(tenantId, employeeId, `${id}-${safeName}`);
    const absolute = path.join(UPLOAD_ROOT, relative);
    try {
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, file.buffer);
      storagePath = relative;
    } catch {
      storagePath = 'inline';
    }
    await this.prisma.employeeDocument.create({
      data: {
        id,
        employeeId,
        fileName: safeName,
        category: label,
        storagePath,
      },
    });
    await this.prisma.$executeRawUnsafe(
      `UPDATE "EmployeeDocument" SET "content" = decode($1, 'base64') WHERE "id" = $2`,
      file.buffer.toString('base64'),
      id,
    );
    return this.getEmployee(tenantId, employeeId);
  }

  async deleteDocument(tenantId: string, employeeId: string, documentId: string) {
    const document = await this.requireDocument(tenantId, employeeId, documentId);
    await this.prisma.employeeDocument.delete({ where: { id: document.id } });
    if (document.storagePath !== 'inline') {
      await fs.unlink(path.join(UPLOAD_ROOT, document.storagePath)).catch(() => undefined);
    }
    return this.getEmployee(tenantId, employeeId);
  }

  async openDocument(tenantId: string, employeeId: string, documentId: string) {
    const document = await this.requireDocument(tenantId, employeeId, documentId);
    const stored = await this.readStoredDocument(document.id);
    if (stored?.length) {
      return { stream: Readable.from(stored), fileName: document.fileName };
    }
    const absolute = path.join(UPLOAD_ROOT, document.storagePath);
    return {
      stream: createReadStream(absolute),
      fileName: document.fileName,
    };
  }

  private ensureDocumentContentColumn() {
    return this.prisma.$executeRawUnsafe(
      `ALTER TABLE "EmployeeDocument" ADD COLUMN IF NOT EXISTS "content" BYTEA`,
    );
  }

  private async readStoredDocument(documentId: string) {
    const rows = await this.prisma.$queryRawUnsafe<{ content: string | null }[]>(
      `SELECT encode("content", 'base64') AS "content" FROM "EmployeeDocument" WHERE "id" = $1`,
      documentId,
    );
    const encoded = rows[0]?.content;
    if (!encoded) return null;
    return Buffer.from(encoded, 'base64');
  }

  async openMyDocument(userId: string, documentId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee record');
    return this.openDocument(employee.tenantId, employee.id, documentId);
  }

  private serialize(row: EmployeeRow, withDetails: boolean) {
    const managerName = row.manager
      ? `${row.manager.firstName} ${row.manager.lastName}`.trim()
      : null;
    const base = {
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      status: row.user.status,
      roles: row.user.roles.map((link) => link.role.code),
      employeeCode: row.employeeCode,
      firstName: row.firstName,
      lastName: row.lastName,
      designation: row.designation,
      photo: row.photo,
      departmentId: row.departmentId,
      departmentName: row.department?.name ?? null,
      locationId: row.locationId,
      locationName: row.location?.name ?? null,
      teamId: row.teamId,
      teamName: row.team?.name ?? null,
      managerId: row.managerId,
      managerName,
      bankName: row.bankName,
      ifscCode: row.ifscCode,
      bankAccountNumber: row.bankAccountNumber,
      salary: row.salaryStructure
        ? {
            basic: row.salaryStructure.basic,
            hra: row.salaryStructure.hra,
            special:
              row.salaryStructure.monthlyGross -
              row.salaryStructure.basic -
              row.salaryStructure.hra -
              row.salaryStructure.da -
              row.salaryStructure.otherAllowances -
              row.salaryStructure.statutoryBonus -
              row.salaryStructure.dailyAllowance,
            statutoryBonus: row.salaryStructure.statutoryBonus,
            dailyAllowance: row.salaryStructure.dailyAllowance,
            gratuity: row.salaryStructure.gratuityMonthly,
            leaveEncashment: row.salaryStructure.leaveEncashment,
          }
        : null,
    };
    if (!withDetails) return base;
    return {
      ...base,
      leaveBalances: row.leaveBalances.map((item) => ({
        id: item.id,
        code: item.code,
        type: leaveTypeName(item.code, item.type),
        entitled: item.entitled,
        used: item.used,
        pending: item.pending,
        available: available(item.entitled, item.used, item.pending),
      })),
      documents: row.documents.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        category: item.category,
        uploadedAt: item.uploadedAt.toISOString().slice(0, 10),
      })),
    };
  }

  private async createNamed(
    tenantId: string,
    kind: 'department' | 'location',
    name: string,
  ) {
    const data = { tenantId, name: name.trim() };
    try {
      if (kind === 'department') return await this.prisma.department.create({ data });
      return await this.prisma.location.create({ data });
    } catch (error) {
      this.rethrowUnique(error, `A ${kind} with that name already exists.`);
    }
  }

  private async renameNamed(kind: 'department' | 'location', id: string, name: string) {
    try {
      if (kind === 'department') {
        return await this.prisma.department.update({
          where: { id },
          data: { name: name.trim() },
        });
      }
      return await this.prisma.location.update({
        where: { id },
        data: { name: name.trim() },
      });
    } catch (error) {
      this.rethrowUnique(error, `A ${kind} with that name already exists.`);
    }
  }

  private async requireDepartment(tenantId: string, id: string) {
    const row = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!row) throw new BadRequestException('Department not found');
    return row;
  }

  private async requireLocation(tenantId: string, id: string) {
    const row = await this.prisma.location.findFirst({ where: { id, tenantId } });
    if (!row) throw new BadRequestException('Location not found');
    return row;
  }

  private async requireEmployee(tenantId: string, id: string) {
    const row = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: employeeInclude,
    });
    if (!row) throw new NotFoundException('Employee not found');
    return row;
  }

  private async requireDocument(tenantId: string, employeeId: string, documentId: string) {
    const document = await this.prisma.employeeDocument.findFirst({
      where: { id: documentId, employeeId, employee: { tenantId } },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  private async assertPlacement(
    tenantId: string,
    departmentId: string | null,
    locationId: string | null,
    teamId: string | null,
    managerId: string | null,
    employeeId: string | null,
  ) {
    if (departmentId) await this.requireDepartment(tenantId, departmentId);
    if (locationId) await this.requireLocation(tenantId, locationId);
    if (managerId) {
      if (managerId === employeeId) {
        throw new BadRequestException('An employee cannot be their own manager.');
      }
      await this.requireEmployee(tenantId, managerId);
    }
    if (teamId) {
      const team = await this.prisma.team.findFirst({ where: { id: teamId, tenantId } });
      if (!team) throw new BadRequestException('Team not found');
      if (departmentId && team.departmentId !== departmentId) {
        throw new BadRequestException('That team belongs to a different department.');
      }
    }
  }

  private async resolveRoles(tenantId: string, roleCodes: string[]) {
    const unique = [...new Set(roleCodes.map((code) => code.trim()).filter(Boolean))];
    if (!unique.length) throw new BadRequestException('At least one role is required');
    const roles = await this.prisma.role.findMany({
      where: { tenantId, code: { in: unique } },
    });
    if (roles.length !== unique.length) {
      const found = new Set(roles.map((role) => role.code));
      const missing = unique.filter((code) => !found.has(code));
      throw new BadRequestException(`Unknown role codes: ${missing.join(', ')}`);
    }
    return roles;
  }

  private async actorRoleCodes(userId: string): Promise<string[]> {
    const links = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { code: true } } },
    });
    return links.map((link) => link.role.code);
  }

  /** HRMS RACI: nobody creates or promotes a person above their own level. */
  private async assertActorMayAssignRoles(actorUserId: string, targetRoleCodes: string[]) {
    const actorRoles = await this.actorRoleCodes(actorUserId);
    const blocked = rolesSeniorToActor(actorRoles, targetRoleCodes);
    if (blocked.length === 0) return;
    throw new ForbiddenException(
      `You cannot assign senior roles (${blocked.join(', ')}). Create or promote only at your level or below.`,
    );
  }

  private async replaceRoles(
    tenantId: string,
    actorUserId: string,
    targetUserId: string,
    roleCodes: string[],
  ) {
    const roles = await this.resolveRoles(tenantId, roleCodes);
    const unique = roles.map((role) => role.code);
    await this.assertActorMayAssignRoles(actorUserId, unique);
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      include: { roles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException('User not found');
    const previous = target.roles.map((link) => link.role.code);
    const isSystemAdmin = (codes: string[]) =>
      codes.some((code) => (SYSTEM_ADMIN_CODES as readonly string[]).includes(code));
    const nextHas = isSystemAdmin(unique);
    const had = isSystemAdmin(previous);
    if (had && !nextHas) {
      const otherAdmins = await this.prisma.userRole.count({
        where: {
          role: { tenantId, code: { in: [...SYSTEM_ADMIN_CODES] } },
          userId: { not: targetUserId },
          user: { status: UserStatus.ACTIVE },
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
        data: roles.map((role) => ({ userId: targetUserId, roleId: role.id })),
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorUserId,
          action: 'hr.roles.update',
          entityType: 'User',
          entityId: targetUserId,
          metadata: { previousRoles: previous.sort(), nextRoles: [...unique].sort() },
        },
      });
    });
  }

  private async nextEmployeeCode(tenantId: string) {
    const rows = await this.prisma.employee.findMany({
      where: { tenantId },
      select: { employeeCode: true },
    });
    let serial = 100;
    for (const row of rows) {
      const match = /^BR(\d+)$/.exec(row.employeeCode);
      if (match) serial = Math.max(serial, Number(match[1]));
    }
    return `BR${serial + 1}`;
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
