import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { inflateRawSync } from 'node:zlib';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  CreateCycleDto,
  AssignmentPreviewDto,
  DecisionDto,
  HrReviewDto,
  ManagerReviewDto,
  RevisionDto,
  SaveSelfAppraisalDto,
  CycleKpiDto,
  SetCycleKpisDto,
} from './dto/appraisal.dto';

type AppraisalImportRow = Record<string, string> & { __row: number };
type ParsedAppraisalImport = { rows: AppraisalImportRow[]; errors: Array<{ row: number; message: string }> };

type Status =
  | 'Draft'
  | 'Self_Appraisal_Pending'
  | 'Submitted'
  | 'Manager_Review_Pending'
  | 'Manager_Approved'
  | 'HR_Review_Pending'
  | 'HR_Approved'
  | 'Management_Approval_Pending'
  | 'Completed'
  | 'Rejected'
  | 'Revision_Requested';

@Injectable()
export class AppraisalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createCycle(tenantId: string, userId: string, dto: CreateCycleDto) {
    if (dto.periodEnd < dto.periodStart || dto.selfDeadline < dto.selfStart || dto.reviewDeadline < dto.selfDeadline) {
      throw new BadRequestException('Cycle dates must be in chronological order.');
    }
    if (dto.kpis) this.validateKpis(dto.kpis);
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.appraisalCycle.create({
        data: {
          tenantId,
          createdById: userId,
          name: dto.name.trim(),
          periodStart: this.date(dto.periodStart),
          periodEnd: this.date(dto.periodEnd),
          selfStart: this.date(dto.selfStart),
          selfDeadline: this.date(dto.selfDeadline),
          reviewDeadline: this.date(dto.reviewDeadline),
        },
      });
      if (dto.kpis?.length) await tx.cycleKpi.createMany({ data: dto.kpis.map((kpi, index) => ({
        cycleId: cycle.id, title: kpi.title.trim(), subKpiName: kpi.subKpiName?.trim() ?? '',
        description: kpi.description ?? '', category: kpi.category ?? 'Performance', weight: kpi.weight,
        subWeight: kpi.subWeight ?? 100, required: kpi.required ?? true, sortOrder: kpi.sortOrder ?? index,
      })) });
      return tx.appraisalCycle.findUniqueOrThrow({ where: { id: cycle.id }, include: { kpis: { orderBy: { sortOrder: 'asc' } } } });
    });
  }

  async listCycles(tenantId: string) {
    return this.prisma.appraisalCycle.findMany({
      where: { tenantId },
      include: { _count: { select: { appraisals: true } }, kpis: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCycle(tenantId: string, cycleId: string, dto: CreateCycleDto) {
    const cycle = await this.prisma.appraisalCycle.findFirst({ where: { id: cycleId, tenantId } });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found.');
    if (cycle.status !== 'Draft') throw new ConflictException('Only draft appraisal cycles can be edited.');
    const assignedCount = await this.prisma.employeeAppraisal.count({ where: { cycleId } });
    if (assignedCount) throw new ConflictException('KPI criteria are locked after employee assignments are created.');
    if (dto.periodEnd < dto.periodStart || dto.selfDeadline < dto.selfStart || dto.reviewDeadline < dto.selfDeadline) throw new BadRequestException('Cycle dates must be in chronological order.');
    if (!dto.kpis) throw new BadRequestException('KPI configuration is required when updating a cycle.');
    this.validateKpis(dto.kpis);
    return this.prisma.$transaction(async (tx) => {
      await tx.appraisalCycle.update({ where: { id: cycleId }, data: {
        name: dto.name.trim(), periodStart: this.date(dto.periodStart), periodEnd: this.date(dto.periodEnd),
        selfStart: this.date(dto.selfStart), selfDeadline: this.date(dto.selfDeadline), reviewDeadline: this.date(dto.reviewDeadline),
      } });
      await tx.cycleKpi.deleteMany({ where: { cycleId } });
      await tx.cycleKpi.createMany({ data: dto.kpis!.map((kpi, index) => ({
        cycleId, title: kpi.title.trim(), subKpiName: kpi.subKpiName?.trim() ?? '', description: kpi.description ?? '',
        category: kpi.category ?? 'Performance', weight: kpi.weight, subWeight: kpi.subWeight ?? 100,
        required: kpi.required ?? true, sortOrder: kpi.sortOrder ?? index,
      })) });
      return tx.appraisalCycle.findUniqueOrThrow({ where: { id: cycleId }, include: { kpis: { orderBy: { sortOrder: 'asc' } } } });
    });
  }

  async importHistory(tenantId: string) {
    return this.prisma.appraisalImport.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async assignmentDirectory(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, user: { status: 'ACTIVE' } },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true, department: { select: { name: true } }, manager: { select: { employeeCode: true, firstName: true, lastName: true } } },
      orderBy: [{ department: { name: 'asc' } }, { employeeCode: 'asc' }],
    });
    return {
      employees: employees.map((employee) => ({ id: employee.id, employeeCode: employee.employeeCode, employeeName: `${employee.firstName} ${employee.lastName}`.trim(), designation: employee.designation, department: employee.department?.name ?? '', reportingManagerCode: employee.manager?.employeeCode ?? '', reportingManagerName: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim() : '' })),
      departments: [...new Set(employees.map((employee) => employee.department?.name).filter((name): name is string => Boolean(name)))].sort(),
      designations: [...new Set(employees.map((employee) => employee.designation).filter(Boolean))].sort(),
      managers: [...new Map(employees.filter((employee) => employee.manager).map((employee) => [employee.manager!.employeeCode, { employeeCode: employee.manager!.employeeCode, name: `${employee.manager!.firstName} ${employee.manager!.lastName}`.trim() }])).values()],
    };
  }

  async previewAssignments(tenantId: string, cycleId: string, dto: AssignmentPreviewDto) {
    const cycle = await this.prisma.appraisalCycle.findFirst({ where: { id: cycleId, tenantId }, include: { kpis: true } });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found.');
    const errors: Array<{ row: number; message: string }> = [];
    if (cycle.status !== 'Draft') errors.push({ row: 0, message: 'Employees can only be assigned before the cycle is launched.' });
    if (!cycle.kpis.length) errors.push({ row: 0, message: 'Configure and save the cycle KPI template before assigning employees.' });
    const activeEmployees = await this.prisma.employee.findMany({
      where: { tenantId, user: { status: 'ACTIVE' } },
      include: { department: true, manager: { select: { employeeCode: true } }, user: { select: { status: true } } },
      orderBy: { employeeCode: 'asc' },
    });
    const byCode = new Map(activeEmployees.map((employee) => [employee.employeeCode.toLowerCase(), employee]));
    const excludedCodes = new Set((dto.excludedEmployeeCodes ?? []).map((code) => code.toLowerCase()));
    let eligible = activeEmployees;
    const importedExcluded = new Set<string>();
    const importedCodes = new Set<string>();
    if (dto.mode === 'department') {
      eligible = activeEmployees.filter((employee) => employee.department?.name.toLowerCase() === dto.filterValue?.toLowerCase());
      if (!dto.filterValue) errors.push({ row: 0, message: 'Choose a department.' });
    } else if (dto.mode === 'designation') {
      eligible = activeEmployees.filter((employee) => employee.designation.toLowerCase() === dto.filterValue?.toLowerCase());
      if (!dto.filterValue) errors.push({ row: 0, message: 'Choose a designation.' });
    } else if (dto.mode === 'manager') {
      eligible = activeEmployees.filter((employee) => employee.manager?.employeeCode.toLowerCase() === dto.filterValue?.toLowerCase());
      if (!dto.filterValue) errors.push({ row: 0, message: 'Choose a reporting manager.' });
    } else if (dto.mode === 'selected') {
      const selected = new Set((dto.selectedEmployeeCodes ?? []).map((code) => code.toLowerCase()));
      eligible = activeEmployees.filter((employee) => selected.has(employee.employeeCode.toLowerCase()));
      for (const code of selected) if (!byCode.has(code)) errors.push({ row: 0, message: `Employee code ${code} is not an active employee.` });
      if (!selected.size) errors.push({ row: 0, message: 'Select at least one employee.' });
    } else if (dto.mode === 'excel') {
      if (!dto.rows?.length) errors.push({ row: 0, message: 'The employee assignment file has no rows.' });
      const seen = new Set<string>();
      for (const [index, row] of (dto.rows ?? []).entries()) {
        const code = row.employeeCode.trim().toLowerCase(); const employee = byCode.get(code); const line = index + 2;
        if (!code) { errors.push({ row: line, message: 'Employee Code is required.' }); continue; }
        if (seen.has(code)) errors.push({ row: line, message: `Duplicate employee code ${row.employeeCode}.` });
        seen.add(code);
        if (!employee) { errors.push({ row: line, message: `Employee ${row.employeeCode} is not active or does not exist.` }); continue; }
        importedCodes.add(code);
        if (row.employeeName?.trim() && `${employee.firstName} ${employee.lastName}`.trim().toLowerCase() !== row.employeeName.trim().toLowerCase()) errors.push({ row: line, message: `Employee Name does not match code ${row.employeeCode}.` });
        if (row.department?.trim() && (employee.department?.name ?? '').toLowerCase() !== row.department.trim().toLowerCase()) errors.push({ row: line, message: `Department does not match employee ${row.employeeCode}.` });
        if (row.designation?.trim() && employee.designation.toLowerCase() !== row.designation.trim().toLowerCase()) errors.push({ row: line, message: `Designation does not match employee ${row.employeeCode}.` });
        if (row.reportingManagerCode?.trim() && (employee.manager?.employeeCode ?? '').toLowerCase() !== row.reportingManagerCode.trim().toLowerCase()) errors.push({ row: line, message: `Reporting Manager Code does not match employee ${row.employeeCode}.` });
        if (['no', 'false'].includes(row.include.toLowerCase())) importedExcluded.add(code);
      }
      eligible = activeEmployees.filter((employee) => importedCodes.has(employee.employeeCode.toLowerCase()));
    }
    const totalEligible = eligible.length;
    const excluded = eligible.filter((employee) => excludedCodes.has(employee.employeeCode.toLowerCase()) || importedExcluded.has(employee.employeeCode.toLowerCase()));
    const selected = eligible.filter((employee) => !excludedCodes.has(employee.employeeCode.toLowerCase()) && !importedExcluded.has(employee.employeeCode.toLowerCase()));
    const existing = await this.prisma.employeeAppraisal.findMany({ where: { cycleId, employeeId: { in: selected.map((employee) => employee.id) } }, select: { employeeId: true } });
    const alreadyAssigned = new Set(existing.map((row) => row.employeeId));
    return {
      totalEligible,
      selectedCount: selected.length,
      excludedCount: excluded.length,
      alreadyAssignedCount: selected.filter((employee) => alreadyAssigned.has(employee.id)).length,
      toAssignCount: selected.filter((employee) => !alreadyAssigned.has(employee.id)).length,
      employees: selected.map((employee) => ({ employeeCode: employee.employeeCode, name: `${employee.firstName} ${employee.lastName}`.trim(), department: employee.department?.name ?? '', designation: employee.designation, managerCode: employee.manager?.employeeCode ?? '', alreadyAssigned: alreadyAssigned.has(employee.id) })),
      excludedEmployees: excluded.map((employee) => ({ employeeCode: employee.employeeCode, name: `${employee.firstName} ${employee.lastName}`.trim() })),
      errors,
      canConfirm: errors.length === 0,
    };
  }

  async confirmAssignments(tenantId: string, userId: string, cycleId: string, dto: AssignmentPreviewDto) {
    const preview = await this.previewAssignments(tenantId, cycleId, dto);
    if (!preview.canConfirm) throw new BadRequestException({ message: 'Assignment preview has validation errors; no employees were assigned.', errors: preview.errors });
    const employeeCodes = preview.employees.map((employee) => employee.employeeCode);
    const employees = await this.prisma.employee.findMany({ where: { tenantId, user: { status: 'ACTIVE' }, employeeCode: { in: employeeCodes } }, select: { id: true, employeeCode: true, managerId: true } });
    const assigned = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.appraisalCycle.updateMany({ where: { id: cycleId, tenantId, status: 'Draft' }, data: { updatedAt: new Date() } });
      if (!locked.count) throw new ConflictException('The appraisal cycle was launched while you were confirming assignments. Refresh and try again.');
      const cycle = await tx.appraisalCycle.findFirst({ where: { id: cycleId, tenantId }, include: { kpis: true } });
      if (!cycle || cycle.status !== 'Draft') throw new ConflictException('The appraisal cycle changed. Refresh assignments and try again.');
      if (!cycle.kpis.length) throw new ConflictException('The appraisal KPI template is missing.');
      const existing = await tx.employeeAppraisal.findMany({ where: { cycleId, employeeId: { in: employees.map((employee) => employee.id) } }, select: { employeeId: true } });
      const existingIds = new Set(existing.map((row) => row.employeeId));
      const created = await tx.employeeAppraisal.createMany({
        data: employees.map((employee) => ({ tenantId, cycleId, employeeId: employee.id, managerEmployeeId: employee.managerId, status: 'Self_Appraisal_Pending' as const })),
        skipDuplicates: true,
      });
      const appraisals = await tx.employeeAppraisal.findMany({ where: { cycleId, employeeId: { in: employees.map((employee) => employee.id) } }, select: { id: true, employeeId: true } });
      await tx.appraisalKpiResponse.createMany({ data: appraisals.flatMap((appraisal) => cycle.kpis.map((kpi) => ({ appraisalId: appraisal.id, cycleKpiId: kpi.id }))), skipDuplicates: true });
      const newAppraisals = appraisals.filter((appraisal) => !existingIds.has(appraisal.employeeId));
      if (newAppraisals.length && created.count === newAppraisals.length) await tx.appraisalReview.createMany({ data: newAppraisals.map((appraisal) => ({ appraisalId: appraisal.id, actorUserId: userId, stage: 'system', action: 'employee_assigned', fromStatus: 'Draft', toStatus: 'Self_Appraisal_Pending' })) });
      return created.count;
    });
    await this.audit(tenantId, userId, 'appraisal.employee.bulk_assign', cycleId, { selected: employeeCodes.length, assigned });
    return { cycleId, assignedCount: assigned, alreadyAssignedCount: preview.alreadyAssignedCount, excludedCount: preview.excludedCount };
  }

  async previewImport(tenantId: string, dto: { cycleId: string; fileName?: string; csv?: string; workbookBase64?: string }) {
    const cycle = await this.prisma.appraisalCycle.findFirst({ where: { id: dto.cycleId, tenantId } });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found.');
    const errors: Array<{ row: number; message: string }> = [];
    if (!['Draft', 'Active'].includes(cycle.status)) {
      errors.push({ row: 0, message: 'Choose a draft or active appraisal cycle.' });
    }
    const parsed = this.parseImportFile(dto);
    errors.push(...parsed.errors);
    const activeEmployees = await this.prisma.employee.findMany({
      where: { tenantId, user: { status: 'ACTIVE' } },
      include: { department: true },
    });
    const applyToAll = parsed.rows.length > 0 && parsed.rows.every((row) => !row.EmployeeCode.trim());
    const hasBlankEmployeeCodes = parsed.rows.some((row) => !row.EmployeeCode.trim());
    const hasEmployeeCodes = parsed.rows.some((row) => Boolean(row.EmployeeCode.trim()));
    if (hasBlankEmployeeCodes && hasEmployeeCodes) {
      errors.push({ row: 0, message: 'Use either EmployeeCode on every row or leave EmployeeCode blank on every row to apply the data to all active employees.' });
    }
    if (applyToAll && !activeEmployees.length) {
      errors.push({ row: 0, message: 'There are no active employees to receive this appraisal data.' });
    }
    const employeeCodes = applyToAll
      ? activeEmployees.map((employee) => employee.employeeCode)
      : [...new Set(parsed.rows.map((row) => row.EmployeeCode).filter(Boolean))];
    const employees = applyToAll
      ? activeEmployees
      : await this.prisma.employee.findMany({ where: { tenantId, employeeCode: { in: employeeCodes } }, include: { department: true } });
    const byCode = new Map(employees.map((employee) => [employee.employeeCode.toLowerCase(), employee]));
    for (const row of parsed.rows) {
      if (applyToAll) {
        if (!row.AppraisalPeriod || !row.KPICategory || !row.KPIName || !row.SubKPIName) errors.push({ row: row.__row, message: 'AppraisalPeriod, KPICategory, KPIName and SubKPIName are required.' });
      } else {
      const employee = byCode.get(row.EmployeeCode.toLowerCase());
      if (!employee) errors.push({ row: row.__row, message: `Unknown employee code: ${row.EmployeeCode}` });
      else if (row.EmployeeName && `${employee.firstName} ${employee.lastName}`.trim().toLowerCase() !== row.EmployeeName.toLowerCase()) errors.push({ row: row.__row, message: `Employee name does not match ${row.EmployeeCode}` });
      if (employee?.department && row.Department && employee.department.name.toLowerCase() !== row.Department.toLowerCase()) errors.push({ row: row.__row, message: `Department does not match employee ${row.EmployeeCode}.` });
      if (employee && row.Designation && employee.designation.toLowerCase() !== row.Designation.toLowerCase()) errors.push({ row: row.__row, message: `Designation does not match employee ${row.EmployeeCode}.` });
      if (!row.EmployeeCode || !row.AppraisalPeriod || !row.KPICategory || !row.KPIName || !row.SubKPIName) errors.push({ row: row.__row, message: 'EmployeeCode, AppraisalPeriod, KPICategory, KPIName and SubKPIName are required.' });
      }
      if (row.AppraisalPeriod && row.AppraisalPeriod.toLowerCase() !== cycle.name.toLowerCase()) errors.push({ row: row.__row, message: `AppraisalPeriod must match cycle “${cycle.name}”.` });
      if (!/^\d+(?:\.\d{1,3})?$/.test(row.KPIWeightage) || !Number.isFinite(Number(row.KPIWeightage)) || Number(row.KPIWeightage) < 0 || Number(row.KPIWeightage) > 100) {
        errors.push({ row: row.__row, message: `Category weightage for KPI "${row.KPIName}" must be between 0 and 100 with at most 3 decimal places.` });
      }
      if (!/^\d+(?:\.\d{1,3})?$/.test(row.SubKPIWeightage) || !Number.isFinite(Number(row.SubKPIWeightage)) || Number(row.SubKPIWeightage) < 0 || Number(row.SubKPIWeightage) > 100) {
        errors.push({ row: row.__row, message: `Sub-KPI weightage for "${row.KPIName}" / "${row.SubKPIName}" must be between 0 and 100 with at most 3 decimal places.` });
      }
      for (const field of ['SelfRating', 'ManagerRating']) if (row[field] && (!Number.isInteger(Number(row[field])) || Number(row[field]) < 1 || Number(row[field]) > 5)) errors.push({ row: row.__row, message: `${field} must be from 1 to 5.` });
    }
    const employeeGroups = new Map<string, typeof parsed.rows>();
    const sharedWeights = new Map<string, string>();
    if (applyToAll) {
      for (const employee of employees) employeeGroups.set(employee.employeeCode, parsed.rows);
    } else {
      for (const row of parsed.rows) employeeGroups.set(row.EmployeeCode, [...(employeeGroups.get(row.EmployeeCode) ?? []), row]);
    }
    for (const row of parsed.rows) {
      if (row.IsActive && !['true', 'false'].includes(row.IsActive.toLowerCase())) errors.push({ row: row.__row, message: 'IsActive must be true or false.' });
      const key = `${row.KPICategory.trim().toLowerCase()}|${row.KPIName.trim().toLowerCase()}|${row.SubKPIName.trim().toLowerCase()}`;
      const weights = `${Number(row.KPIWeightage)}|${Number(row.SubKPIWeightage)}`;
      if (sharedWeights.has(key) && sharedWeights.get(key) !== weights) errors.push({ row: row.__row, message: 'KPI and Sub-KPI weightages must be consistent for all employees in this import.' });
      sharedWeights.set(key, weights);
    }
    const duplicates = await this.prisma.employeeAppraisal.findMany({ where: { cycleId: dto.cycleId, employee: { employeeCode: { in: employeeCodes } } }, include: { employee: { select: { employeeCode: true } } } });
    for (const appraisal of duplicates) errors.push({ row: 0, message: `${appraisal.employee.employeeCode} already has an appraisal in this cycle.` });
    for (const rows of employeeGroups.values()) {
      const parentWeights = new Map<string, number>(); const subWeights = new Map<string, number>(); const firstSubKpi = new Map<string, AppraisalImportRow>(); const combinations = new Set<string>();
      for (const row of rows) {
        const category = row.KPICategory.trim().toLowerCase();
        const group = `${category}|${row.KPIName.trim().toLowerCase()}`;
        const parentWeight = Number(row.KPIWeightage);
        if (parentWeights.has(group) && Math.abs(parentWeights.get(group)! - parentWeight) >= 0.001) errors.push({ row: row.__row, message: `KPI weightage is inconsistent for ${row.KPIName}.` });
        parentWeights.set(group, parentWeight);
        const combination = `${group}|${row.SubKPIName.trim().toLowerCase()}`;
        if (combinations.has(combination)) errors.push({ row: row.__row, message: 'Duplicate KPI/Sub-KPI row for this employee.' });
        combinations.add(combination); subWeights.set(group, (subWeights.get(group) ?? 0) + Number(row.SubKPIWeightage)); firstSubKpi.set(group, firstSubKpi.get(group) ?? row);
      }
      const parentTotal = Math.round([...parentWeights.values()].reduce((sum, value) => sum + value, 0) * 1000) / 1000;
      if (rows.length && Math.abs(parentTotal - 100) >= 0.001) {
        const last = rows[rows.length - 1];
        errors.push({ row: last.__row, message: `KPI "${last.KPIName}" / Sub-KPI "${last.SubKPIName}" leaves employee category allocations at ${parentTotal}%; expected exactly 100%.` });
      }
      for (const [group, total] of subWeights) {
        const subTotal = Math.round(total * 1000) / 1000;
        if (Math.abs(subTotal - 100) >= 0.001) {
          const first = firstSubKpi.get(group)!;
          errors.push({ row: first.__row, message: `KPI "${first.KPIName}" / Sub-KPI "${first.SubKPIName}" weightages total ${subTotal}%; expected 100% independently of the parent allocation.` });
        }
      }
    }
    return { totalRows: parsed.rows.length, validRows: Math.max(0, parsed.rows.length - new Set(errors.map((error) => error.row)).size), invalidRows: new Set(errors.map((error) => error.row)).size, totalEmployees: employeeGroups.size, totalCategories: new Set(parsed.rows.map((row) => row.KPICategory.toLowerCase())).size, totalCheckpoints: new Set(parsed.rows.map((row) => `${row.KPICategory.toLowerCase()}|${row.KPIName.toLowerCase()}|${row.SubKPIName.toLowerCase()}`)).size, duplicateRows: errors.filter((error) => error.message.includes('Duplicate')).length, errors, employees: [...employeeGroups.keys()], canImport: errors.length === 0, template: 'EmployeeCode,EmployeeName,Department,Designation,AppraisalPeriod,KPICategory,KPIName,KPIWeightage,SubKPIName,SubKPIWeightage,SelfRating,SelfJustification,ManagerRating,ManagerRemarks' };
  }

  async confirmImport(tenantId: string, userId: string, dto: { cycleId: string; fileName: string; csv?: string; workbookBase64?: string }) {
    const preview = await this.previewImport(tenantId, dto);
    const cycle = await this.prisma.appraisalCycle.findFirst({ where: { id: dto.cycleId, tenantId } });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found.');
    if (!preview.canImport) {
      await this.prisma.appraisalImport.create({ data: { tenantId, createdById: userId, cycleId: cycle.id, fileName: dto.fileName || 'appraisal.csv', status: 'Failed', totalRows: preview.totalRows, importedRows: 0, failedRows: preview.invalidRows, errors: preview.errors } });
      throw new BadRequestException({ message: 'Import contains validation errors; no appraisal data was saved. Review the import history errors and retry.', errors: preview.errors });
    }
    if (!['Draft', 'Active'].includes(cycle.status)) {
      throw new ConflictException('Bulk CSV import is only allowed for draft or active appraisal cycles.');
    }
    const rows = this.parseImportFile(dto).rows;
    const applyToAll = rows.length > 0 && rows.every((row) => !row.EmployeeCode.trim());
    const employeeCodes = applyToAll
      ? []
      : [...new Set(rows.map((row) => row.EmployeeCode))];
    const employees = applyToAll
      ? await this.prisma.employee.findMany({ where: { tenantId, user: { status: 'ACTIVE' } }, include: { department: true } })
      : await this.prisma.employee.findMany({ where: { tenantId, employeeCode: { in: employeeCodes } }, include: { department: true } });
    if (applyToAll && !employees.length) throw new BadRequestException('There are no active employees to receive this appraisal data.');
    const byCode = new Map(employees.map((employee) => [employee.employeeCode.toLowerCase(), employee]));
    const categories = new Map<string, Map<string, typeof rows>>();
    for (const row of rows) {
      const key = row.KPICategory.trim().toLowerCase();
      const kpis = categories.get(key) ?? new Map<string, typeof rows>();
      const title = row.KPIName.trim().toLowerCase();
      kpis.set(title, [...(kpis.get(title) ?? []), row]); categories.set(key, kpis);
    }
    const definitions: Array<{ title: string; category: string; description: string; weight: number; subKpiName: string; subWeight: number; sortOrder: number; required: boolean }> = [];
    for (const kpis of categories.values()) for (const items of kpis.values()) for (const row of items) definitions.push({ title: row.KPIName, category: row.KPICategory, description: row.Action ?? '', weight: Number(row.KPIWeightage), subKpiName: row.SubKPIName, subWeight: Number(row.SubKPIWeightage), sortOrder: definitions.length, required: row.IsActive?.toLowerCase() !== 'false' });
    const uniqueDefinitions = [...new Map(definitions.map((item) => [`${item.category.trim().toLowerCase()}|${item.title.trim().toLowerCase()}|${item.subKpiName.trim().toLowerCase()}`, item])).values()];
    const runId = await this.prisma.$transaction(async (tx) => {
      const configured = await tx.cycleKpi.findMany({ where: { cycleId: cycle.id } });
      if (configured.length) {
        const byKey = new Map(configured.map((item) => [`${item.category.trim().toLowerCase()}|${item.title.trim().toLowerCase()}|${item.subKpiName.trim().toLowerCase()}`, item]));
        const mismatch = uniqueDefinitions.some((item) => { const existing = byKey.get(`${item.category.trim().toLowerCase()}|${item.title.trim().toLowerCase()}|${item.subKpiName.trim().toLowerCase()}`); return !existing || Math.abs(Number(existing.weight) - item.weight) >= 0.001 || Math.abs(Number(existing.subWeight) - item.subWeight) >= 0.001; }) || configured.length !== uniqueDefinitions.length;
        if (mismatch) throw new ConflictException('Imported KPI criteria do not match the selected cycle template. No data was imported.');
      } else {
        await tx.cycleKpi.createMany({ data: uniqueDefinitions.map((item) => ({ cycleId: cycle.id, ...item })) });
      }
      const cycleKpis = await tx.cycleKpi.findMany({ where: { cycleId: cycle.id } });
      const employeeIds = employees.map((employee) => employee.id);
      const existing = await tx.employeeAppraisal.findMany({ where: { cycleId: cycle.id, employeeId: { in: employeeIds } }, select: { employeeId: true } });
      if (existing.length) throw new ConflictException('Some employees already have appraisals in this cycle. No data was imported.');
      await tx.appraisalCycle.update({ where: { id: cycle.id }, data: { status: 'Active' } });
      await tx.employeeAppraisal.createMany({ data: employees.map((employee) => ({ tenantId, cycleId: cycle.id, employeeId: employee.id, managerEmployeeId: employee.managerId, status: 'Self_Appraisal_Pending' })) });
      const appraisals = await tx.employeeAppraisal.findMany({ where: { cycleId: cycle.id, employeeId: { in: employeeIds } }, select: { id: true, employeeId: true } });
      const appraisalByEmployee = new Map(appraisals.map((appraisal) => [appraisal.employeeId, appraisal.id]));
      const kpiByName = new Map(cycleKpis.map((kpi) => [`${kpi.category.trim().toLowerCase()}|${kpi.title.trim().toLowerCase()}|${kpi.subKpiName.trim().toLowerCase()}`, kpi.id]));
      const responseRows = applyToAll
        ? appraisals.flatMap((appraisal) => rows.map((row) => ({
            appraisalId: appraisal.id,
            cycleKpiId: kpiByName.get(`${row.KPICategory.trim().toLowerCase()}|${row.KPIName.trim().toLowerCase()}|${row.SubKPIName.trim().toLowerCase()}`)!,
            selfRating: row.SelfRating ? Number(row.SelfRating) : null,
            selfComment: row.SelfJustification,
            managerRating: row.ManagerRating ? Number(row.ManagerRating) : null,
            managerComment: row.ManagerRemarks,
          })))
        : rows.map((row) => ({
            appraisalId: appraisalByEmployee.get(byCode.get(row.EmployeeCode.toLowerCase())!.id)!,
            cycleKpiId: kpiByName.get(`${row.KPICategory.trim().toLowerCase()}|${row.KPIName.trim().toLowerCase()}|${row.SubKPIName.trim().toLowerCase()}`)!,
            selfRating: row.SelfRating ? Number(row.SelfRating) : null,
            selfComment: row.SelfJustification,
            managerRating: row.ManagerRating ? Number(row.ManagerRating) : null,
            managerComment: row.ManagerRemarks,
          }));
      await tx.appraisalKpiResponse.createMany({ data: responseRows });
      const importedResponses = await tx.appraisalKpiResponse.findMany({ where: { appraisalId: { in: appraisals.map((appraisal) => appraisal.id) } }, include: { cycleKpi: true } });
      for (const appraisal of appraisals) {
        const appraisalResponses = importedResponses.filter((response) => response.appraisalId === appraisal.id);
        const hasManagerRatings = appraisalResponses.some((response) => response.managerRating != null);
        await tx.employeeAppraisal.update({ where: { id: appraisal.id }, data: { selfRating: this.weightedRating(appraisalResponses, 'selfRating'), managerRating: hasManagerRatings ? this.weightedRating(appraisalResponses, 'managerRating') : null } });
      }
      await tx.appraisalReview.createMany({ data: appraisals.map((appraisal) => ({ appraisalId: appraisal.id, actorUserId: userId, stage: 'system', action: 'bulk_csv_import', fromStatus: cycle.status, toStatus: 'Self_Appraisal_Pending' })) });
      const saved = await tx.appraisalImport.create({ data: { tenantId, createdById: userId, cycleId: cycle.id, fileName: dto.fileName || 'appraisal.csv', totalRows: rows.length, importedRows: rows.length, failedRows: 0, status: 'Completed' } });
      return saved.id;
    });
    await this.audit(tenantId, userId, 'appraisal.csv.import', cycle.id, { importId: runId, rows: rows.length });
    return { importId: runId, importedRows: rows.length, employeesImported: employees.length, appraisalRecordsCreated: employees.length, skippedCount: 0, failedRows: 0 };
  }

  private parseImportCsv(csv: string): { rows: Array<Record<string, string> & { __row: number }>; errors: Array<{ row: number; message: string }> } {
    if (csv.length > 4_000_000) throw new BadRequestException('CSV file exceeds the 4 MB limit.');
    const lines: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
    for (let i = 0; i < csv.length; i += 1) {
      const char = csv[i];
      if (quoted && char === '"' && csv[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (!quoted && char === ',') { row.push(cell); cell = ''; }
      else if (!quoted && (char === '\n' || char === '\r')) { row.push(cell); lines.push(row); row = []; cell = ''; if (char === '\r' && csv[i + 1] === '\n') i += 1; }
      else cell += char;
    }
    if (cell || row.length) { row.push(cell); lines.push(row); }
    const headers = (lines.shift() ?? []).map((value) => value.trim().replace(/^\uFEFF/, ''));
    const required = ['EmployeeCode','EmployeeName','Department','Designation','AppraisalPeriod','KPICategory','KPIName','KPIWeightage','SubKPIName','SubKPIWeightage','SelfRating','SelfJustification','ManagerRating','ManagerRemarks'];
    const missing = required.filter((header) => !headers.includes(header));
    const errors = missing.length ? [{ row: 1, message: `Missing CSV columns: ${missing.join(', ')}` }] : [];
    const rows = missing.length ? [] : lines.filter((values) => values.some((value) => value.trim())).map((values, index) => Object.assign(Object.fromEntries(headers.map((header, column) => [header, (values[column] ?? '').trim()])), { __row: index + 2 }));
    return { rows, errors };
  }

  private parseImportFile(dto: { fileName?: string; csv?: string; workbookBase64?: string }): ParsedAppraisalImport {
    if (dto.fileName?.toLowerCase().endsWith('.xlsx')) {
      if (!dto.workbookBase64) throw new BadRequestException('The Excel workbook data is missing.');
      if (dto.workbookBase64.length > 5_600_000) throw new BadRequestException('Excel workbook exceeds the 4 MB limit.');
      return this.parseImportWorkbook(dto.workbookBase64);
    }
    if (!dto.csv) throw new BadRequestException('CSV data is missing.');
    return this.parseImportCsv(dto.csv);
  }

  private parseImportWorkbook(encoded: string): ParsedAppraisalImport {
    let archive: Buffer;
    try { archive = Buffer.from(encoded, 'base64'); } catch { throw new BadRequestException('Invalid Excel workbook encoding.'); }
    if (archive.length > 4_000_000 || archive.readUInt32LE(0) !== 0x04034b50) throw new BadRequestException('Invalid .xlsx workbook or file exceeds the 4 MB limit.');
    const files = new Map<string, string>();
    let eocd = -1;
    for (let i = Math.max(0, archive.length - 65_557); i <= archive.length - 22; i += 1) if (archive.readUInt32LE(i) === 0x06054b50) eocd = i;
    if (eocd < 0) throw new BadRequestException('Excel workbook directory is invalid.');
    const count = archive.readUInt16LE(eocd + 10); let cursor = archive.readUInt32LE(eocd + 16);
    for (let i = 0; i < count; i += 1) {
      if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new BadRequestException('Excel workbook directory is invalid.');
      const method = archive.readUInt16LE(cursor + 10); const compressed = archive.readUInt32LE(cursor + 20); const nameLength = archive.readUInt16LE(cursor + 28); const extraLength = archive.readUInt16LE(cursor + 30); const commentLength = archive.readUInt16LE(cursor + 32); const local = archive.readUInt32LE(cursor + 42); const name = archive.toString('utf8', cursor + 46, cursor + 46 + nameLength);
      if (['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml'].includes(name)) {
        const localName = archive.readUInt16LE(local + 26); const localExtra = archive.readUInt16LE(local + 28); const start = local + 30 + localName + localExtra; const data = archive.subarray(start, start + compressed);
        try { files.set(name, (method === 8 ? inflateRawSync(data) : data).toString('utf8')); } catch { throw new BadRequestException('Could not decompress the Excel workbook.'); }
      }
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    const sheet = files.get('xl/worksheets/sheet1.xml'); if (!sheet) throw new BadRequestException('Excel workbook has no first worksheet.');
    const unescape = (value: string) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    const shared = [...(files.get('xl/sharedStrings.xml') ?? '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((text) => unescape(text[1])).join(''));
    const percentFormats = new Set<string>();
    const styleXml = files.get('xl/styles.xml') ?? '';
    const customFormatIds = new Set([...styleXml.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]+)"/g)].filter((match) => match[2].includes('%')).map((match) => match[1]));
    const xfs = styleXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
    for (const [index, xf] of [...xfs.matchAll(/<xf\b([^>]*)\/?\s*>/g)].entries()) { const id = xf[1].match(/numFmtId="(\d+)"/)?.[1]; if (id && (Number(id) === 9 || Number(id) === 10 || customFormatIds.has(id))) percentFormats.add(String(index)); }
    const rows: string[][] = []; const address = (ref: string) => { const match = ref.match(/^([A-Z]+)(\d+)$/i); if (!match) return null; let col = 0; for (const c of match[1].toUpperCase()) col = col * 26 + c.charCodeAt(0) - 64; return { row: Number(match[2]) - 1, col: col - 1 }; };
    const cellValues = new Map<string, string>();
    for (const match of sheet.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const rowNumber = Number(match[1]) - 1; rows[rowNumber] ??= [];
      for (const cell of match[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const ref = cell[1].match(/\br="([A-Z]+\d+)"/i)?.[1]; const pos = ref ? address(ref) : null; if (!pos) continue;
        const type = cell[1].match(/\bt="([^"]+)"/)?.[1]; const raw = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? [...cell[2].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => unescape(part[1])).join('');
        let val = type === 's' ? (shared[Number(raw)] ?? '') : unescape(raw);
        const style = cell[1].match(/\bs="(\d+)"/)?.[1];
        if (style && percentFormats.has(style) && Number.isFinite(Number(val))) val = String(Number(val) * 100);
        rows[rowNumber][pos.col] = val;
      }
    }
    for (const merge of sheet.matchAll(/<mergeCell\b[^>]*ref="([A-Z]+\d+):([A-Z]+\d+)"/gi)) {
      const from = address(merge[1]); const to = address(merge[2]); if (!from || !to) continue; const value = rows[from.row]?.[from.col] ?? '';
      for (let row = from.row; row <= to.row; row += 1) for (let col = from.col; col <= to.col; col += 1) { rows[row] ??= []; if (!rows[row][col]) rows[row][col] = value; }
    }
    if (!rows.length) throw new BadRequestException('Excel worksheet is empty.');
    const csv = rows.map((row) => row.map((value) => `"${(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const parsed = this.parseImportCsv(csv);
    if (!parsed.rows.length && !parsed.errors.length) parsed.errors.push({ row: 1, message: 'Excel worksheet contains no appraisal rows.' });
    return parsed;
  }

  async setCycleKpis(tenantId: string, cycleId: string, dto: SetCycleKpisDto) {
    const cycle = await this.prisma.appraisalCycle.findFirst({ where: { id: cycleId, tenantId } });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found.');
    if (cycle.status !== 'Draft') throw new ConflictException('KPIs can only be changed before a cycle is launched.');
    this.validateKpis(dto.kpis);
    await this.prisma.$transaction(async (tx) => {
      await tx.cycleKpi.deleteMany({ where: { cycleId } });
      await tx.cycleKpi.createMany({
        data: dto.kpis.map((kpi, index) => ({
          cycleId,
          title: kpi.title.trim(),
          subKpiName: kpi.subKpiName?.trim() ?? '',
          description: kpi.description ?? '',
          category: kpi.category ?? 'Performance',
          weight: kpi.weight,
          subWeight: kpi.subWeight ?? 100,
          required: kpi.required ?? true,
          sortOrder: kpi.sortOrder ?? index,
        })),
      });
    });
    return this.prisma.cycleKpi.findMany({ where: { cycleId }, orderBy: { sortOrder: 'asc' } });
  }

  private validateKpis(kpis: CycleKpiDto[]) {
    if (!kpis.length) throw new BadRequestException('Add at least one KPI before saving.');
    const hierarchical = kpis.some((kpi) => Boolean(kpi.subKpiName));
    if (hierarchical) {
      const parents = new Map<string, number>(); const subWeights = new Map<string, number>();
      const duplicateRows = new Set<string>();
      for (const kpi of kpis) {
        if (!kpi.title.trim() || !kpi.category?.trim()) throw new BadRequestException('KPI name and category are required.');
        if (!Number.isFinite(kpi.weight) || kpi.weight < 0 || kpi.weight > 100 || Math.abs(kpi.weight * 1000 - Math.round(kpi.weight * 1000)) > 0.000001) throw new BadRequestException('Category weightages must be between 0 and 100 with at most 3 decimal places.');
        const subWeight = kpi.subWeight ?? 100;
        if (!Number.isFinite(subWeight) || subWeight < 0 || subWeight > 100 || Math.abs(subWeight * 1000 - Math.round(subWeight * 1000)) > 0.000001) {
          throw new BadRequestException(`Sub-KPI weightage for ${kpi.title} / ${kpi.subKpiName} must be between 0 and 100 with at most 3 decimal places.`);
        }
        const category = (kpi.category ?? 'Performance').trim().toLowerCase();
        const group = `${category}|${kpi.title.trim().toLowerCase()}`;
        const existingWeight = parents.get(group);
        if (existingWeight !== undefined && Math.abs(existingWeight - kpi.weight) >= 0.001) throw new BadRequestException(`Category ${kpi.category} has inconsistent weightages.`);
        parents.set(group, kpi.weight);
        if (!kpi.subKpiName?.trim()) throw new BadRequestException(`Add a Sub-KPI name for ${kpi.title}.`);
        const duplicate = `${group}|${kpi.subKpiName.trim().toLowerCase()}`;
        if (duplicateRows.has(duplicate)) throw new BadRequestException(`Duplicate Sub-KPI ${kpi.subKpiName} under ${kpi.title}.`);
        duplicateRows.add(duplicate);
        subWeights.set(group, (subWeights.get(group) ?? 0) + subWeight);
      }
      const parentTotal = Math.round([...parents.values()].reduce((total, value) => total + value, 0) * 1000) / 1000;
      if (Math.abs(parentTotal - 100) >= 0.001) throw new BadRequestException(`KPI category weights must total exactly 100% (currently ${parentTotal}%).`);
      for (const [group, value] of subWeights) {
        const subTotal = Math.round(value * 1000) / 1000;
        if (Math.abs(subTotal - 100) >= 0.001) throw new BadRequestException(`Sub-KPI weights within ${group.split('|')[1]} must total exactly 100% independently of the parent allocation (currently ${subTotal}%).`);
      }
    } else {
      if (kpis.some((kpi) => !kpi.title.trim() || !kpi.category?.trim() || !Number.isFinite(kpi.weight) || kpi.weight < 0 || kpi.weight > 100 || Math.abs(kpi.weight * 1000 - Math.round(kpi.weight * 1000)) > 0.000001)) throw new BadRequestException('KPI name, category, and weightages between 0 and 100 with at most 3 decimal places are required.');
      const parentTotal = Math.round(kpis.reduce((total, kpi) => total + kpi.weight, 0) * 1000) / 1000;
      if (Math.abs(parentTotal - 100) >= 0.001) throw new BadRequestException(`KPI category weights must total exactly 100% (currently ${parentTotal}%).`);
    }
  }

  async launchCycle(tenantId: string, userId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
      include: { kpis: true, _count: { select: { appraisals: true } } },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found.');
    if (cycle.status !== 'Draft') throw new ConflictException('This cycle has already been launched.');
    if (!cycle.kpis.length) throw new BadRequestException('Add at least one KPI before launching the cycle.');
    this.validateKpis(cycle.kpis.map((kpi) => ({ title: kpi.title, category: kpi.category, weight: Number(kpi.weight), subKpiName: kpi.subKpiName, subWeight: Number(kpi.subWeight), required: kpi.required, sortOrder: kpi.sortOrder })));
    const employees = await this.prisma.$transaction(async (tx) => {
      const activated = await tx.appraisalCycle.updateMany({ where: { id: cycleId, tenantId, status: 'Draft' }, data: { status: 'Active' } });
      if (!activated.count) throw new ConflictException('This cycle was launched by another administrator. Refresh and try again.');
      const preassigned = await tx.employeeAppraisal.findMany({ where: { cycleId }, select: { employeeId: true } });
      const preassignedIds = [...new Set(preassigned.map((row) => row.employeeId))];
      const selectedEmployees = await tx.employee.findMany({
        where: { tenantId, user: { status: 'ACTIVE' }, ...(preassignedIds.length ? { id: { in: preassignedIds } } : {}) },
        include: { user: { select: { id: true } } },
        orderBy: { employeeCode: 'asc' },
      });
      if (!selectedEmployees.length) throw new BadRequestException(preassignedIds.length ? 'None of the assigned employees has an active HRMS account.' : 'There are no active employees to include in this cycle.');
      await tx.employeeAppraisal.createMany({
        data: selectedEmployees.map((employee) => ({
          tenantId,
          cycleId,
          employeeId: employee.id,
          managerEmployeeId: employee.managerId,
          status: 'Self_Appraisal_Pending' as const,
        })),
        skipDuplicates: true,
      });
      const appraisals = await tx.employeeAppraisal.findMany({ where: { cycleId, employeeId: { in: selectedEmployees.map((employee) => employee.id) } }, select: { id: true, employeeId: true } });
      await tx.appraisalKpiResponse.createMany({ data: appraisals.flatMap((appraisal) => cycle.kpis.map((kpi) => ({ appraisalId: appraisal.id, cycleKpiId: kpi.id }))), skipDuplicates: true });
      const reviews = await tx.appraisalReview.findMany({ where: { appraisalId: { in: appraisals.map((appraisal) => appraisal.id) }, action: { in: ['employee_assigned', 'cycle_initiated'] } }, select: { appraisalId: true } });
      const reviewed = new Set(reviews.map((review) => review.appraisalId));
      const newAppraisals = appraisals.filter((appraisal) => !reviewed.has(appraisal.id));
      if (newAppraisals.length) await tx.appraisalReview.createMany({ data: newAppraisals.map((appraisal) => ({ appraisalId: appraisal.id, actorUserId: userId, stage: 'system', action: 'cycle_initiated', fromStatus: 'Draft', toStatus: 'Self_Appraisal_Pending' })) });
      return selectedEmployees;
    });
    for (const employee of employees) {
      await this.notify(tenantId, employee.userId, 'Self-appraisal pending', `${cycle.name} is open. Please submit your self-appraisal by ${cycle.selfDeadline.toISOString().slice(0, 10)}.`, '/ess/appraisals');
    }
    await this.audit(tenantId, userId, 'appraisal.cycle.launch', cycleId, { employeeCount: employees.length });
    return { cycleId, status: 'Active', employeeCount: employees.length };
  }

  async closeCycle(tenantId: string, userId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({ where: { id: cycleId, tenantId } });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found.');
    if (cycle.status !== 'Active') throw new ConflictException('Only active cycles can be closed.');
    const pending = await this.prisma.employeeAppraisal.count({
      where: { cycleId, status: { notIn: ['Completed', 'Rejected'] } },
    });
    if (pending) throw new ConflictException(`${pending} appraisal(s) still need review before this cycle can be closed.`);
    await this.prisma.appraisalCycle.update({ where: { id: cycleId }, data: { status: 'Closed' } });
    await this.audit(tenantId, userId, 'appraisal.cycle.close', cycleId, {});
    return { cycleId, status: 'Closed' };
  }

  async mine(userId: string, tenantId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { userId, tenantId } });
    if (!employee) return { current: [], previous: [] };
    const rows = await this.prisma.employeeAppraisal.findMany({
      where: { tenantId, employeeId: employee.id },
      include: { cycle: { include: { kpis: { orderBy: { sortOrder: 'asc' } } } }, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      current: rows.filter((row) => row.cycle.status === 'Active').map((row) => this.employeeView(row)),
      previous: rows.filter((row) => row.cycle.status !== 'Active').map((row) => this.employeeView(row)),
    };
  }

  async getMine(userId: string, tenantId: string, id: string) {
    const row = await this.prisma.employeeAppraisal.findFirst({
      where: { id, tenantId, employee: { userId } },
      include: { cycle: { include: { kpis: { orderBy: { sortOrder: 'asc' } } } }, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Appraisal not found.');
    return this.employeeView(row);
  }

  async saveSelf(userId: string, tenantId: string, id: string, dto: SaveSelfAppraisalDto) {
    const row = await this.ownedAppraisal(userId, tenantId, id);
    if (!['Self_Appraisal_Pending', 'Revision_Requested'].includes(row.status)) {
      throw new ConflictException('Submitted appraisals can only be changed after a revision request.');
    }
    const cycle = await this.prisma.appraisalCycle.findUniqueOrThrow({ where: { id: row.cycleId } });
    if (cycle.status !== 'Active') throw new ConflictException('This appraisal cycle is not active.');
    if (row.status !== 'Revision_Requested') {
      const today = this.todayIndia();
      const start = cycle.selfStart.toISOString().slice(0, 10);
      const deadline = cycle.selfDeadline.toISOString().slice(0, 10);
      if (today < start || today > deadline) throw new ConflictException('Self-appraisal is outside the submission window.');
    }
    const responses = dto.kpis ?? [];
    const allowed = new Set((await this.prisma.cycleKpi.findMany({ where: { cycleId: row.cycleId }, select: { id: true } })).map((item) => item.id));
    if (responses.some((item) => !allowed.has(item.cycleKpiId))) throw new BadRequestException('An appraisal response contains a KPI outside this cycle.');
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeAppraisal.update({
        where: { id },
        data: {
          ...(dto.goals !== undefined ? { goals: dto.goals as object[] } : {}),
          ...(dto.achievements !== undefined ? { achievements: dto.achievements as object[] } : {}),
          ...(dto.selfFeedback !== undefined ? { selfFeedback: dto.selfFeedback } : {}),
        },
      });
      for (const item of responses) {
        await tx.appraisalKpiResponse.upsert({
          where: { appraisalId_cycleKpiId: { appraisalId: id, cycleKpiId: item.cycleKpiId } },
          create: { appraisalId: id, cycleKpiId: item.cycleKpiId, selfRating: item.selfRating, selfComment: item.selfComment ?? '' },
          update: { selfRating: item.selfRating, selfComment: item.selfComment ?? '' },
        });
      }
      const allResponses = await tx.appraisalKpiResponse.findMany({ where: { appraisalId: id }, include: { cycleKpi: true } });
      await tx.employeeAppraisal.update({ where: { id }, data: { selfRating: this.weightedRating(allResponses, 'selfRating') } });
      await tx.appraisalReview.create({
        data: {
          appraisalId: id,
          actorUserId: userId,
          stage: 'employee',
          action: 'self_saved',
          fromStatus: row.status,
          toStatus: row.status,
          comment: dto.selfFeedback ?? '',
          changes: { ratings: responses.map((item) => ({ cycleKpiId: item.cycleKpiId, rating: item.selfRating, comment: item.selfComment ?? '' })) },
        },
      });
    });
    return this.getMine(userId, tenantId, id);
  }

  async submitSelf(userId: string, tenantId: string, id: string) {
    const row = await this.ownedAppraisal(userId, tenantId, id);
    if (!['Self_Appraisal_Pending', 'Revision_Requested'].includes(row.status)) throw new ConflictException('This appraisal cannot be submitted in its current status.');
    if (row.status !== 'Revision_Requested') {
      const cycle = await this.prisma.appraisalCycle.findUniqueOrThrow({ where: { id: row.cycleId } });
      const today = this.todayIndia();
      if (today < cycle.selfStart.toISOString().slice(0, 10) || today > cycle.selfDeadline.toISOString().slice(0, 10)) {
        throw new ConflictException('Self-appraisal is outside the submission window.');
      }
    }
    const responses = await this.prisma.appraisalKpiResponse.findMany({ where: { appraisalId: id }, include: { cycleKpi: true } });
    if (responses.some((response) => response.cycleKpi.required && response.selfRating == null)) {
      throw new BadRequestException('Complete every required KPI rating before submitting.');
    }
    if (row.status === 'Revision_Requested' && row.revisionReturnStage === 'hr') {
      const result = await this.move(tenantId, userId, row, 'HR_Review_Pending', 'employee', 'revision_resubmitted', 'HR review resumed after employee revision.', { revisionReturnStage: '' });
      await this.notifyRole(tenantId, ['HR_EXEC', 'HR_HEAD'], 'HR review pending', 'An employee resubmitted an appraisal after HR requested clarification.', '/hr/appraisals');
      return result;
    }
    const oldStatus = row.status;
    const nextStatus: Status = row.managerEmployeeId ? 'Manager_Review_Pending' : 'HR_Review_Pending';
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employeeAppraisal.updateMany({
        where: { id, status: oldStatus },
        data: { status: nextStatus as never, submittedAt: new Date(), revisionReturnStage: '' },
      });
      if (!result.count) throw new ConflictException('This appraisal was updated by another reviewer. Refresh and try again.');
      await tx.appraisalReview.create({ data: { appraisalId: id, actorUserId: userId, stage: 'employee', action: 'submitted', fromStatus: oldStatus, toStatus: 'Submitted' } });
      await tx.appraisalReview.create({
        data: {
          appraisalId: id,
          actorUserId: userId,
          stage: 'system',
          action: row.managerEmployeeId ? 'routed_to_manager' : 'routed_to_hr_no_reporting_manager',
          fromStatus: 'Submitted',
          toStatus: nextStatus,
        },
      });
      return tx.employeeAppraisal.findUniqueOrThrow({ where: { id }, include: { employee: true, manager: true, cycle: true } });
    });
    const manager = updated.managerEmployeeId ? await this.prisma.employee.findUnique({ where: { id: updated.managerEmployeeId }, select: { userId: true } }) : null;
    if (manager?.userId) {
      await this.notify(tenantId, manager.userId, 'Manager review pending', `${updated.employee.firstName} ${updated.employee.lastName} submitted a self-appraisal for ${updated.cycle.name}.`, '/manager/appraisals');
    } else {
      await this.notifyRole(tenantId, ['HR_EXEC', 'HR_HEAD'], 'HR review pending', `${updated.employee.firstName} ${updated.employee.lastName} submitted an appraisal without an assigned reporting manager.`, '/hr/appraisals');
    }
    await this.audit(tenantId, userId, 'appraisal.self.submit', id, {});
    return { id, status: updated.status };
  }

  async managerQueue(userId: string, tenantId: string) {
    const manager = await this.employeeByUser(userId, tenantId);
    const rows = await this.prisma.employeeAppraisal.findMany({
      where: { tenantId, managerEmployeeId: manager.id },
      include: { employee: { include: { department: true } }, cycle: true, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.managerView(row));
  }

  async managerReview(userId: string, tenantId: string, id: string, dto: ManagerReviewDto) {
    const manager = await this.employeeByUser(userId, tenantId);
    const row = await this.prisma.employeeAppraisal.findFirst({ where: { id, tenantId }, include: { kpiResponses: { include: { cycleKpi: true } } } });
    if (!row) throw new NotFoundException('Appraisal not found.');
    if (row.employeeId === manager.id) throw new ForbiddenException('You cannot review your own appraisal.');
    if (row.managerEmployeeId !== manager.id) throw new ForbiddenException('This appraisal is not assigned to you.');
    if (row.status !== 'Manager_Review_Pending') throw new ConflictException('This appraisal is not awaiting manager review.');
    const kpiIds = new Set(row.kpiResponses.map((response) => response.cycleKpiId));
    if (dto.kpis.some((response) => !kpiIds.has(response.cycleKpiId))) throw new BadRequestException('A rating references a KPI outside this appraisal.');
    const submittedRatings = new Set(dto.kpis.map((response) => response.cycleKpiId));
    const required = await this.prisma.cycleKpi.findMany({ where: { cycleId: row.cycleId, required: true }, select: { id: true } });
    if (required.some((kpi) => !submittedRatings.has(kpi.id))) throw new BadRequestException('Rate every required KPI before saving the manager review.');
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.employeeAppraisal.updateMany({ where: { id, status: 'Manager_Review_Pending' }, data: { managerFeedback: dto.feedback, managerStrengths: dto.strengths, managerImprovementAreas: dto.improvementAreas } });
      if (!current.count) throw new ConflictException('This appraisal was updated by another reviewer.');
      for (const response of dto.kpis) {
        await tx.appraisalKpiResponse.update({
          where: { appraisalId_cycleKpiId: { appraisalId: id, cycleKpiId: response.cycleKpiId } },
          data: { managerRating: response.managerRating, managerComment: response.managerComment ?? '' },
        });
      }
      const allResponses = await tx.appraisalKpiResponse.findMany({ where: { appraisalId: id }, include: { cycleKpi: true } });
      await tx.employeeAppraisal.update({ where: { id }, data: { managerRating: this.weightedRating(allResponses, 'managerRating') } });
      await tx.appraisalReview.create({
        data: { appraisalId: id, actorUserId: userId, stage: 'manager', action: 'review_saved', fromStatus: row.status, toStatus: row.status, comment: dto.comment ?? dto.feedback, changes: { rating: dto.rating, kpiRatings: dto.kpis.map((item) => ({ cycleKpiId: item.cycleKpiId, rating: item.managerRating, comment: item.managerComment ?? '' })), strengths: dto.strengths, improvementAreas: dto.improvementAreas } },
      });
    });
    return { id, status: row.status };
  }

  async managerApprove(userId: string, tenantId: string, id: string, dto: DecisionDto) {
    const row = await this.requireManagerPending(userId, tenantId, id);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeAppraisal.updateMany({ where: { id, tenantId, status: 'Manager_Review_Pending' }, data: { status: 'HR_Review_Pending' } });
      if (!changed.count) throw new ConflictException('This appraisal was updated by another reviewer. Refresh and try again.');
      await tx.appraisalReview.create({ data: { appraisalId: id, actorUserId: userId, stage: 'manager', action: 'approved', fromStatus: 'Manager_Review_Pending', toStatus: 'Manager_Approved', comment: dto.comment ?? '' } });
      await tx.appraisalReview.create({ data: { appraisalId: id, actorUserId: userId, stage: 'system', action: 'routed_to_hr', fromStatus: 'Manager_Approved', toStatus: 'HR_Review_Pending' } });
      await tx.auditEvent.create({ data: { tenantId, actorUserId: userId, action: 'appraisal.manager.approve', entityType: 'EmployeeAppraisal', entityId: id, metadata: { fromStatus: 'Manager_Review_Pending', toStatus: 'HR_Review_Pending' } } });
    });
    const result = { id, status: 'HR_Review_Pending' };
    const employee = await this.prisma.employee.findUnique({ where: { id: row.employeeId }, select: { firstName: true, lastName: true } });
    await this.notifyEmployee(tenantId, row.employeeId, 'Manager approved your appraisal', 'Your self-appraisal has been sent to HR for review.', `/ess/appraisals/${id}`);
    await this.notifyRole(tenantId, ['HR_EXEC', 'HR_HEAD'], 'HR review pending', `${employee?.firstName ?? 'An employee'} ${employee?.lastName ?? ''} has manager-approved appraisal awaiting HR review.`, '/hr/appraisals');
    return result;
  }

  async managerReturn(userId: string, tenantId: string, id: string, dto: RevisionDto) {
    const row = await this.requireManagerPending(userId, tenantId, id);
    const result = await this.returnForRevision(tenantId, userId, row, 'manager', 'manager', dto.comment);
    const employee = await this.prisma.employee.findUnique({ where: { id: row.employeeId }, select: { userId: true } });
    await this.notify(tenantId, employee?.userId, 'Appraisal revision requested', dto.comment, `/ess/appraisals/${id}`);
    return result;
  }

  async hrQueue(tenantId: string, canSeeSensitive: boolean) {
    const rows = await this.prisma.employeeAppraisal.findMany({
      where: { tenantId, status: { in: ['HR_Review_Pending', 'HR_Approved', 'Management_Approval_Pending', 'Completed', 'Rejected'] } },
      include: { employee: { include: { department: true } }, cycle: true, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.hrView(row, canSeeSensitive));
  }

  async adminQueue(tenantId: string) {
    const rows = await this.prisma.employeeAppraisal.findMany({
      where: { tenantId },
      include: { employee: { include: { department: true, manager: true } }, cycle: true, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => {
      const view = this.hrView(row, false);
      const { finalRating: _finalRating, ...publicView } = view;
      return {
        ...publicView,
        history: row.reviews.map((review) => ({
          stage: review.stage,
          action: review.action,
          fromStatus: review.fromStatus,
          status: review.toStatus,
          createdAt: review.createdAt,
        })),
      };
    });
  }

  async adminDetail(tenantId: string, id: string) {
    const row: any = await this.findAppraisal(tenantId, id, {
      employee: { include: { department: true, manager: true } },
      cycle: true,
      kpiResponses: { include: { cycleKpi: true } },
      reviews: { include: { actor: { select: { email: true } } }, orderBy: { createdAt: 'asc' } },
    });
    const view = this.hrView(row, false);
    const { finalRating: _finalRating, ...publicView } = view;
    return {
      ...publicView,
      history: row.reviews.map((review: any) => ({ stage: review.stage, action: review.action, fromStatus: review.fromStatus, status: review.toStatus, comment: review.comment, actor: review.actor?.email, createdAt: review.createdAt })),
    };
  }

  async hrApprove(userId: string, tenantId: string, id: string, dto: HrReviewDto) {
    const row = await this.findAppraisal(tenantId, id);
    await this.assertNotSubject(userId, tenantId, row.employeeId);
    if (row.status !== 'HR_Review_Pending') throw new ConflictException('This appraisal is not awaiting HR review.');
    const fromStatus = row.status;
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeAppraisal.updateMany({
        where: { id, status: fromStatus },
        data: {
          status: 'Management_Approval_Pending',
          hrFeedback: dto.feedback,
          hrRating: dto.rating,
          promotionRecommendation: dto.promotionRecommendation ?? '',
          salaryIncreasePercent: dto.salaryIncreasePercent,
          salaryIncreaseAmount: dto.salaryIncreaseAmount,
          revisionReturnStage: '',
        },
      });
      if (!changed.count) throw new ConflictException('This appraisal was updated by another reviewer.');
      await tx.appraisalReview.create({ data: { appraisalId: id, actorUserId: userId, stage: 'hr', action: 'approved', fromStatus, toStatus: 'HR_Approved', comment: dto.comment ?? dto.feedback, changes: { rating: dto.rating, feedback: dto.feedback, promotionRecommendation: dto.promotionRecommendation ?? '', salaryIncreasePercent: dto.salaryIncreasePercent ?? null, salaryIncreaseAmount: dto.salaryIncreaseAmount ?? null } } });
      await tx.appraisalReview.create({ data: { appraisalId: id, actorUserId: userId, stage: 'system', action: 'routed_to_management', fromStatus: 'HR_Approved', toStatus: 'Management_Approval_Pending' } });
      await tx.auditEvent.create({ data: { tenantId, actorUserId: userId, action: 'appraisal.hr.approve', entityType: 'EmployeeAppraisal', entityId: id, metadata: { fromStatus, toStatus: 'Management_Approval_Pending' } } });
    });
    await this.notifyRole(tenantId, ['MANAGEMENT_APPROVER'], 'Final appraisal approval pending', 'An HR-approved appraisal is awaiting management review.', '/management/appraisals');
    await this.notifyEmployee(tenantId, row.employeeId, 'HR approved your appraisal', 'Your appraisal has moved to final management approval.', `/ess/appraisals/${id}`);
    return { id, status: 'Management_Approval_Pending' };
  }

  async hrReturn(userId: string, tenantId: string, id: string, dto: RevisionDto) {
    const row = await this.findAppraisal(tenantId, id);
    await this.assertNotSubject(userId, tenantId, row.employeeId);
    if (row.status !== 'HR_Review_Pending') throw new ConflictException('This appraisal is not awaiting HR review.');
    const result = await this.returnForRevision(tenantId, userId, row, 'hr', 'hr', dto.comment);
    const employee = await this.prisma.employee.findUnique({ where: { id: row.employeeId }, select: { userId: true } });
    await this.notify(tenantId, employee?.userId, 'Appraisal clarification requested', dto.comment, `/ess/appraisals/${id}`);
    return result;
  }

  async hrReject(userId: string, tenantId: string, id: string, dto: DecisionDto) {
    const row = await this.findAppraisal(tenantId, id);
    await this.assertNotSubject(userId, tenantId, row.employeeId);
    if (row.status !== 'HR_Review_Pending') throw new ConflictException('This appraisal is not awaiting HR review.');
    const result = await this.move(tenantId, userId, row, 'Rejected', 'hr', 'rejected', dto.comment ?? '');
    await this.notifyEmployee(tenantId, row.employeeId, 'Appraisal rejected', dto.comment ?? 'Your appraisal was rejected during HR review.', `/ess/appraisals/${id}`);
    return result;
  }

  async managementQueue(tenantId: string, canSeeSensitive: boolean) {
    const rows = await this.prisma.employeeAppraisal.findMany({
      where: { tenantId, status: 'Management_Approval_Pending' },
      include: { employee: { include: { department: true } }, cycle: true, kpiResponses: { include: { cycleKpi: true } }, reviews: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'asc' },
    });
    return rows.map((row) => this.hrView(row, canSeeSensitive));
  }

  async managementDecision(userId: string, tenantId: string, id: string, approve: boolean, dto: DecisionDto) {
    const row = await this.findAppraisal(tenantId, id);
    await this.assertNotSubject(userId, tenantId, row.employeeId);
    if (row.status !== 'Management_Approval_Pending') throw new ConflictException('This appraisal is not awaiting management approval.');
    const status: Status = approve ? 'Completed' : 'Rejected';
    const result = await this.move(tenantId, userId, row, status, 'management', approve ? 'approved' : 'rejected', dto.comment ?? '', approve ? { completedAt: new Date(), managementFeedback: dto.comment ?? '', finalRating: row.hrRating } : { managementFeedback: dto.comment ?? '' });
    await this.notifyEmployee(tenantId, row.employeeId, approve ? 'Final appraisal completed' : 'Appraisal recommendation rejected', dto.comment ?? (approve ? 'Your appraisal has been finalized.' : 'Management rejected the final recommendation.'), `/ess/appraisals/${id}`);
    return result;
  }

  async summary(tenantId: string, scope: 'employee' | 'manager' | 'hr' | 'management', userId: string) {
    const manager = scope === 'manager' ? await this.employeeByUser(userId, tenantId) : null;
    const employee = scope === 'employee' ? await this.employeeByUser(userId, tenantId, true) : null;
    if (scope === 'employee' && !employee) return { counts: {}, total: 0 };
    const where = {
      tenantId,
      ...(manager ? { managerEmployeeId: manager.id } : {}),
      ...(employee ? { employeeId: employee.id } : {}),
    };
    const groups = await this.prisma.employeeAppraisal.groupBy({ by: ['status'], where, _count: { _all: true } });
    const counts: Record<string, number> = {};
    for (const group of groups) counts[group.status] = group._count._all;
    if (scope === 'hr' || scope === 'management') {
      const rows = await this.prisma.employeeAppraisal.findMany({ where, include: { employee: { include: { department: true } } } });
      const byDepartment = new Map<string, { department: string; count: number; ratingTotal: number; ratingCount: number }>();
      for (const row of rows) {
        const department = row.employee.department?.name ?? 'Unassigned';
        const item = byDepartment.get(department) ?? { department, count: 0, ratingTotal: 0, ratingCount: 0 };
        item.count += 1;
        if (row.finalRating != null) { item.ratingTotal += Number(row.finalRating); item.ratingCount += 1; }
        byDepartment.set(department, item);
      }
      return {
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        departments: [...byDepartment.values()].map((item) => ({ department: item.department, count: item.count, averageFinalRating: item.ratingCount ? Number((item.ratingTotal / item.ratingCount).toFixed(2)) : null })),
        ...(scope === 'management' ? {
          promotionRecommendations: rows.filter((row) => Boolean(row.promotionRecommendation)).length,
          salaryRevisionSummary: {
            recommendations: rows.filter((row) => row.salaryIncreasePercent != null || row.salaryIncreaseAmount != null).length,
            proposedIncreaseAmount: rows.reduce((total, row) => total + Number(row.salaryIncreaseAmount ?? 0), 0),
            averageIncreasePercent: (() => {
              const values = rows.filter((row) => row.salaryIncreasePercent != null).map((row) => Number(row.salaryIncreasePercent));
              return values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null;
            })(),
          },
        } : {}),
      };
    }
    return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  }

  async detailForHr(tenantId: string, id: string, canSeeSensitive: boolean) {
    const row = await this.findAppraisal(tenantId, id, {
      employee: { include: { department: true } },
      cycle: true,
      kpiResponses: { include: { cycleKpi: true } },
      reviews: { include: { actor: { select: { email: true } } }, orderBy: { createdAt: 'asc' } },
    });
    return this.hrView(row, canSeeSensitive);
  }

  async rejectManager(userId: string, tenantId: string, id: string, dto: DecisionDto) {
    const row = await this.requireManagerPending(userId, tenantId, id);
    const result = await this.move(tenantId, userId, row, 'Rejected', 'manager', 'rejected', dto.comment ?? '');
    await this.notifyEmployee(tenantId, row.employeeId, 'Appraisal rejected', dto.comment ?? 'Your appraisal was rejected during manager review.', `/ess/appraisals/${id}`);
    return result;
  }

  private async ownedAppraisal(userId: string, tenantId: string, id: string) {
    const employee = await this.employeeByUser(userId, tenantId);
    const row = await this.prisma.employeeAppraisal.findFirst({ where: { id, tenantId, employeeId: employee.id } });
    if (!row) throw new NotFoundException('Appraisal not found.');
    return row;
  }

  private async employeeByUser(userId: string, tenantId: string, allowMissing = false) {
    const employee = await this.prisma.employee.findFirst({ where: { userId, tenantId } });
    if (!employee && !allowMissing) throw new ForbiddenException('No employee profile is linked to this account.');
    return employee!;
  }

  private async findAppraisal(tenantId: string, id: string, include: object = {}) {
    const row = await this.prisma.employeeAppraisal.findFirst({ where: { id, tenantId }, include: include as never });
    if (!row) throw new NotFoundException('Appraisal not found.');
    return row;
  }

  private async requireManagerPending(userId: string, tenantId: string, id: string) {
    const manager = await this.employeeByUser(userId, tenantId);
    const row = await this.findAppraisal(tenantId, id);
    if (row.employeeId === manager.id) throw new ForbiddenException('You cannot review your own appraisal.');
    if (row.managerEmployeeId !== manager.id) throw new ForbiddenException('This appraisal is not assigned to you.');
    if (row.status !== 'Manager_Review_Pending') throw new ConflictException('This appraisal is not awaiting manager review.');
    return row;
  }

  private async assertNotSubject(userId: string, tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { userId, tenantId }, select: { id: true } });
    if (employee?.id === employeeId) throw new ForbiddenException('You cannot take an approval action on your own appraisal.');
  }

  private async move(tenantId: string, userId: string, row: { id: string; status: string; employeeId: string }, toStatus: Status, stage: string, action: string, comment: string, extra: object = {}) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeAppraisal.updateMany({ where: { id: row.id, tenantId, status: row.status as never }, data: { status: toStatus as never, ...extra } as never });
      if (!changed.count) throw new ConflictException('This appraisal was updated by another reviewer. Refresh and try again.');
      await tx.appraisalReview.create({ data: { appraisalId: row.id, actorUserId: userId, stage, action, fromStatus: row.status, toStatus, comment } });
      await tx.auditEvent.create({ data: { tenantId, actorUserId: userId, action: `appraisal.${stage}.${action}`, entityType: 'EmployeeAppraisal', entityId: row.id, metadata: { fromStatus: row.status, toStatus } } });
    });
    return { id: row.id, status: toStatus };
  }

  private async returnForRevision(tenantId: string, userId: string, row: { id: string; status: string; employeeId: string }, stage: string, returnStage: string, comment: string) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeAppraisal.updateMany({
        where: { id: row.id, tenantId, status: row.status as never },
        data: { status: 'Revision_Requested', revisionReturnStage: returnStage },
      });
      if (!changed.count) throw new ConflictException('This appraisal was updated by another reviewer.');
      await tx.appraisalReview.create({ data: { appraisalId: row.id, actorUserId: userId, stage, action: 'revision_requested', fromStatus: row.status, toStatus: 'Revision_Requested', comment } });
      await tx.auditEvent.create({ data: { tenantId, actorUserId: userId, action: `appraisal.${stage}.revision_requested`, entityType: 'EmployeeAppraisal', entityId: row.id, metadata: { fromStatus: row.status, toStatus: 'Revision_Requested', returnStage } } });
    });
    return { id: row.id, status: 'Revision_Requested' };
  }

  private async notifyEmployee(tenantId: string, employeeId: string, title: string, body: string, href: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
    return this.notify(tenantId, employee?.userId, title, body, href);
  }

  private async notifyRole(tenantId: string, roles: string[], title: string, body: string, href: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'ACTIVE', roles: { some: { role: { code: { in: roles }, tenantId } } } },
      select: { id: true },
    });
    for (const user of users) await this.notify(tenantId, user.id, title, body, href);
  }

  private async notify(tenantId: string, userId: string | undefined | null, title: string, body: string, href: string) {
    if (!userId) return;
    await this.notifications.notify({ tenantId, userId, title, body, href, kind: 'appraisal' });
  }

  private async audit(tenantId: string, actorUserId: string, action: string, entityId: string, metadata: object) {
    await this.prisma.auditEvent.create({ data: { tenantId, actorUserId, action, entityType: 'AppraisalCycle', entityId, metadata } });
  }

  private employeeView(row: any) {
    const released = row.status === 'Completed';
    return {
      id: row.id, cycle: row.cycle, status: row.status, goals: row.goals, achievements: row.achievements,
      selfFeedback: row.selfFeedback, selfRating: row.selfRating,
      ...(released ? {
        managerFeedback: row.managerFeedback, managerStrengths: row.managerStrengths,
        managerImprovementAreas: row.managerImprovementAreas, managerRating: row.managerRating,
        hrFeedback: row.hrFeedback, hrRating: row.hrRating,
      } : {}),
      submittedAt: row.submittedAt, completedAt: row.completedAt,
      kpiResponses: row.kpiResponses.map((response: any) => released ? response : ({
        cycleKpiId: response.cycleKpiId, cycleKpi: response.cycleKpi,
        selfRating: response.selfRating, selfComment: response.selfComment,
      })),
      history: row.reviews.map((review: any) => ({
        stage: review.stage, action: review.action, status: review.toStatus, createdAt: review.createdAt,
        ...(review.action === 'revision_requested' ? { comment: review.comment } : {}),
      })),
    };
  }

  private managerView(row: any) {
    return {
      id: row.id, status: row.status, employee: row.employee, cycle: row.cycle, goals: row.goals,
      achievements: row.achievements, selfFeedback: row.selfFeedback, managerFeedback: row.managerFeedback,
      managerStrengths: row.managerStrengths, managerImprovementAreas: row.managerImprovementAreas,
      selfRating: row.selfRating, managerRating: row.managerRating, kpiResponses: row.kpiResponses,
      history: row.reviews.map((review: any) => ({ stage: review.stage, action: review.action, status: review.toStatus, createdAt: review.createdAt })),
    };
  }

  private hrView(row: any, canSeeSensitive: boolean) {
    const result = {
      id: row.id, status: row.status, updatedAt: row.updatedAt, submittedAt: row.submittedAt, completedAt: row.completedAt, employee: row.employee, cycle: row.cycle, goals: row.goals,
      achievements: row.achievements, selfFeedback: row.selfFeedback, managerFeedback: row.managerFeedback,
      managerStrengths: row.managerStrengths, managerImprovementAreas: row.managerImprovementAreas,
      managerRating: row.managerRating, hrFeedback: row.hrFeedback, hrRating: row.hrRating,
      managementFeedback: row.managementFeedback, finalRating: row.finalRating,
      kpiResponses: row.kpiResponses,
      history: canSeeSensitive ? row.reviews : row.reviews.map((review: any) => ({ stage: review.stage, action: review.action, fromStatus: review.fromStatus, toStatus: review.toStatus, createdAt: review.createdAt })),
    };
    return canSeeSensitive ? {
      ...result,
      promotionRecommendation: row.promotionRecommendation,
      salaryIncreasePercent: row.salaryIncreasePercent,
      salaryIncreaseAmount: row.salaryIncreaseAmount,
    } : result;
  }

  private date(value: string) {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private weightedRating(responses: Array<{ selfRating?: number | null; managerRating?: number | null; cycleKpi: { weight: unknown; subWeight: unknown; subKpiName?: string } }>, field: 'selfRating' | 'managerRating') {
    return Number(responses.reduce((sum, response) => {
      const rating = response[field];
      const parentWeight = Number(response.cycleKpi.weight);
      const effectiveWeight = response.cycleKpi.subKpiName?.trim() ? parentWeight * Number(response.cycleKpi.subWeight ?? 100) / 100 : parentWeight;
      return sum + (rating == null ? 0 : Number(rating) * effectiveWeight / 100);
    }, 0).toFixed(2));
  }

  private todayIndia() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  }
}
