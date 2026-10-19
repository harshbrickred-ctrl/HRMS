import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'payslips');

@Injectable()
export class PayslipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async myPayslips(userId: string) {
    const employee = await this.employeeByUser(userId);
    const rows = await this.prisma.payslip.findMany({
      where: { employeeId: employee.id },
      orderBy: { month: 'desc' },
    });
    return rows.map((row) => this.view(row));
  }

  async listForEmployee(tenantId: string, employeeId: string) {
    await this.requireEmployee(tenantId, employeeId);
    const rows = await this.prisma.payslip.findMany({
      where: { tenantId, employeeId },
      orderBy: { month: 'desc' },
    });
    return rows.map((row) => this.view(row));
  }

  async upload(
    tenantId: string,
    actorUserId: string,
    employeeId: string,
    month: string,
    label: string,
    file: { originalname: string; buffer: Buffer },
  ) {
    const employee = await this.requireEmployee(tenantId, employeeId);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Month must be YYYY-MM.');
    }
    if (!file?.buffer?.length) throw new BadRequestException('Choose a PDF to upload.');
    const safeName = path.basename(file.originalname).replace(/[^\w.\- ()]+/g, '_');
    if (!safeName.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Payslips must be PDF files.');
    }
    const id = randomUUID();
    const relative = path.join(tenantId, employeeId, `${id}-${safeName}`);
    const absolute = path.join(UPLOAD_ROOT, relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, file.buffer);

    const existing = await this.prisma.payslip.findUnique({
      where: { tenantId_employeeId_month: { tenantId, employeeId, month } },
    });
    if (existing) {
      await fs.unlink(path.join(UPLOAD_ROOT, existing.storagePath)).catch(() => undefined);
      await this.prisma.payslip.delete({ where: { id: existing.id } });
    }

    const row = await this.prisma.payslip.create({
      data: {
        id,
        tenantId,
        employeeId,
        month,
        label: label.trim() || `Payslip ${month}`,
        fileName: safeName,
        storagePath: relative,
      },
    });
    if (employee.userId) {
      await this.notifications.notify({
        tenantId,
        userId: employee.userId,
        title: 'Payslip available',
        body: row.label,
        href: '/ess/salary',
        kind: 'payslip',
      });
    }
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorUserId,
        action: 'payslip.upload',
        entityType: 'payslip',
        entityId: row.id,
        metadata: { month, employeeId },
      },
    });
    return this.view(row);
  }

  async openForUser(userId: string, payslipId: string) {
    const employee = await this.employeeByUser(userId);
    const row = await this.prisma.payslip.findFirst({
      where: { id: payslipId, employeeId: employee.id },
    });
    if (!row) throw new NotFoundException('Payslip not found.');
    return this.open(row);
  }

  async openForHr(tenantId: string, employeeId: string, payslipId: string) {
    const row = await this.prisma.payslip.findFirst({
      where: { id: payslipId, tenantId, employeeId },
    });
    if (!row) throw new NotFoundException('Payslip not found.');
    return this.open(row);
  }

  private open(row: { fileName: string; storagePath: string }) {
    const absolute = path.join(UPLOAD_ROOT, row.storagePath);
    return {
      fileName: row.fileName,
      stream: createReadStream(absolute),
    };
  }

  private async employeeByUser(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('No employee profile for this login.');
    return employee;
  }

  private async requireEmployee(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    return employee;
  }

  private view(row: {
    id: string;
    employeeId: string;
    month: string;
    label: string;
    fileName: string;
    uploadedAt: Date;
  }) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      month: row.month,
      label: row.label,
      fileName: row.fileName,
      uploadedAt: row.uploadedAt.toISOString(),
    };
  }
}
