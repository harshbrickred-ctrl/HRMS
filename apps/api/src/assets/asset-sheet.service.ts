import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type AssetCategory, type AssetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssetMaintenanceService } from './asset-maintenance.service';
import {
  SHEET_ACCESSORIES,
  SHEET_STATUS_LABELS,
  cleanCustomFields,
  isSheetFlagWord,
  normaliseSerial,
  parseFieldDefs,
  parseSheetDate,
  sheetFlag,
  sheetIssueCondition,
  sheetStatus,
  type CategoryField,
} from './asset-rules';
import {
  AssetSupport,
  day,
  dayOrNull,
  fullName,
  isPrismaError,
  toDay,
  today,
} from './asset-support.service';
import { AssetsService, type AssetListFilters } from './assets.service';
import type { AssetSheetRowDto, ImportAssetSheetDto } from './dto/assets.dto';

const EXPORT_LIMIT = 5000;

/** Sheet spec columns, and the category field keys or labels each one fills. */
const SPEC_COLUMNS = {
  processor: ['processor', 'cpu'],
  ram: ['ram', 'ramgb', 'memory'],
  storage: ['storage', 'ssd', 'hdd', 'ssdhdd', 'disk'],
  os: ['os', 'operatingsystem'],
} as const;
type SpecColumn = keyof typeof SPEC_COLUMNS;
const SPEC_KEYS = Object.keys(SPEC_COLUMNS) as SpecColumn[];

/** Words people put in "Assign To" for a device nobody holds. */
const NOBODY =
  /^(spare|stock|in stock|it|it stock|it team|office|common|na|n\/a|nil|none|-)$/i;

const sheetInclude = {
  category: true,
  assignments: {
    orderBy: [{ assignedOn: 'desc' as const }, { createdAt: 'desc' as const }],
    take: 1,
    include: {
      employee: {
        include: { user: { select: { email: true } }, manager: true },
      },
    },
  },
} satisfies Prisma.AssetInclude;

type Person = Prisma.EmployeeGetPayload<{
  include: { user: { select: { email: true; status: true } } };
}>;

function squash(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function words(text: string | null | undefined) {
  return text
    ? text.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase())
    : '';
}

/** The category field a spec column fills, matched on the field's key or label. */
function specField(defs: CategoryField[], column: SpecColumn) {
  const names: readonly string[] = SPEC_COLUMNS[column];
  return defs.find(
    (def) =>
      names.includes(squash(def.key)) || names.includes(squash(def.label)),
  );
}

/**
 * The asset register in the layout of the IT team's Excel sheet: export, and import of new devices
 * with who holds them. Imported holdings are history the employee never confirmed, so nobody is notified.
 */
@Injectable()
export class AssetSheetService {
  private readonly logger = new Logger(AssetSheetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AssetSupport,
    private readonly assets: AssetsService,
    private readonly maintenance: AssetMaintenanceService,
  ) {}

  async exportRows(
    tenantId: string,
    actorUserId: string,
    filters: AssetListFilters,
  ) {
    const rows = await this.prisma.asset.findMany({
      where: await this.assets.registerWhere(tenantId, actorUserId, filters),
      include: sheetInclude,
      orderBy: { assetTag: 'asc' },
      take: EXPORT_LIMIT,
    });
    return rows.map((asset, index) => {
      const last = asset.assignments[0];
      const held = last && !last.returnedOn ? last : null;
      const holder = last?.employee;
      const defs = parseFieldDefs(asset.category.fields);
      const custom = asset.customFields as Record<string, string | number>;
      const spec = (column: SpecColumn) => {
        const def = specField(defs, column);
        return def && custom[def.key] !== undefined
          ? String(custom[def.key])
          : '';
      };
      const tick = (match: RegExp) =>
        last ? (match.test(last.accessories) ? 'Yes' : 'No') : '';
      return {
        sno: String(index + 1),
        vendor: asset.vendor,
        purchasedOn: dayOrNull(asset.purchasedOn) ?? '',
        owner: asset.owner,
        assignTo: holder ? fullName(holder) : '',
        manager: holder?.manager ? fullName(holder.manager) : '',
        project: last?.project ?? '',
        name: asset.name,
        processor: spec('processor'),
        make: asset.make,
        model: asset.model,
        serialNo: asset.serialNo ?? '',
        workingStatus: SHEET_STATUS_LABELS[asset.status],
        assignedToEmployee: held ? 'Yes' : 'No',
        assignedOn: last ? day(last.assignedOn) : '',
        employeeCode: holder?.employeeCode ?? '',
        email: holder?.user.email ?? '',
        mobile: last?.contactMobile ?? '',
        assignedReceived: held
          ? 'Assigned'
          : last?.endReason === 'returned'
            ? 'Received'
            : '',
        employmentType: last?.employmentType ?? '',
        ...Object.fromEntries(
          SHEET_ACCESSORIES.map((item) => [item.key, tick(item.match)]),
        ),
        os: spec('os'),
        ram: spec('ram'),
        storage: spec('storage'),
        condition: words(
          held?.issueCondition || last?.returnCondition || asset.condition,
        ),
        remarks: asset.description,
      };
    });
  }

  async importRows(
    tenantId: string,
    actorUserId: string,
    dto: ImportAssetSheetDto,
  ) {
    const category = await this.prisma.assetCategory.findFirst({
      where: { id: dto.categoryId, tenantId },
    });
    if (!category) throw new NotFoundException('Category not found.');
    if (!category.active)
      throw new BadRequestException(`${category.name} is no longer in use.`);
    const locationId = dto.locationId || null;
    if (
      locationId &&
      !(await this.prisma.location.findFirst({
        where: { id: locationId, tenantId },
      }))
    ) {
      throw new NotFoundException('Location not found.');
    }
    const people = await this.prisma.employee.findMany({
      where: { tenantId },
      include: { user: { select: { email: true, status: true } } },
    });
    const created: Array<{ line: number; assetTag: string }> = [];
    const failed: Array<{ line: number; message: string }> = [];
    for (const row of dto.rows) {
      try {
        const assetTag = await this.importRow(
          tenantId,
          actorUserId,
          category,
          locationId,
          people,
          row,
        );
        created.push({ line: row.line, assetTag });
      } catch (error) {
        if (error instanceof HttpException) {
          failed.push({ line: row.line, message: error.message });
        } else if (isPrismaError(error, 'P2002')) {
          failed.push({
            line: row.line,
            message: 'That serial number is already registered.',
          });
        } else {
          this.logger.error(
            `Asset sheet line ${row.line} failed`,
            error instanceof Error ? error.stack : error,
          );
          failed.push({
            line: row.line,
            message: 'This row could not be saved.',
          });
        }
      }
    }
    if (created.length) {
      await this.support.audit(
        tenantId,
        actorUserId,
        'assets.import',
        category.id,
        {
          created: created.map((row) => row.assetTag),
          failed: failed.length,
        },
      );
    }
    return { created, failed };
  }

  private async importRow(
    tenantId: string,
    actorUserId: string,
    category: AssetCategory,
    locationId: string | null,
    people: Person[],
    row: AssetSheetRowDto,
  ) {
    const cell = (value: string | undefined) => (value ?? '').trim();
    const name =
      cell(row.name) ||
      [cell(row.make), cell(row.model)].filter(Boolean).join(' ') ||
      category.name;
    if (name.length > 160)
      throw new BadRequestException(
        'Device Name is longer than 160 characters.',
      );

    const defs = parseFieldDefs(category.fields);
    const specs: Record<string, string> = {};
    for (const column of SPEC_KEYS) {
      const def = specField(defs, column);
      if (def && cell(row[column])) specs[def.key] = cell(row[column]);
    }
    const customFields = cleanCustomFields(defs, specs);

    const serialNo = normaliseSerial(row.serialNo);
    if (serialNo) {
      const clash = await this.prisma.asset.findFirst({
        where: { tenantId, serialNo },
        select: { assetTag: true },
      });
      if (clash)
        throw new ConflictException(
          `Serial number ${serialNo} is already registered to ${clash.assetTag}.`,
        );
    }
    const purchasedOn = toDay(parseSheetDate(row.purchasedOn));
    const assignedOn = toDay(parseSheetDate(row.assignedOn)) ?? today();
    if (assignedOn > today())
      throw new BadRequestException('Assigned Date cannot be in the future.');
    if (purchasedOn && assignedOn < purchasedOn && cell(row.assignedOn)) {
      throw new BadRequestException(
        'Assigned Date cannot be before the Purchase Date.',
      );
    }

    const target = sheetStatus(row.workingStatus);
    const employee = this.findEmployee(people, row);
    const received = /^(receiv|return)/i.test(cell(row.assignedReceived));
    const flagged = isSheetFlagWord(row.assignedToEmployee)
      ? sheetFlag(row.assignedToEmployee)
      : null;
    // A working device with a named holder is with them now; anything else only records who had it.
    const holder =
      employee && !target && !received && flagged !== false ? employee : null;
    if (holder && holder.user.status !== 'ACTIVE') {
      throw new BadRequestException(
        `${fullName(holder)} is not an active employee, so cannot hold this device.`,
      );
    }
    const status: AssetStatus = holder ? 'allocated' : (target ?? 'in_stock');

    const condition = cell(row.condition);
    const accessories = SHEET_ACCESSORIES.filter(
      (item) => sheetFlag(row[item.key]) === true,
    )
      .map((item) => item.label)
      .join(', ');
    const remarks = cell(row.remarks).slice(0, 1000);

    return this.prisma.$transaction(async (tx) => {
      const assetTag = await this.assets.nextTag(tx, tenantId, category.id);
      const asset = await tx.asset.create({
        data: {
          tenantId,
          assetTag,
          categoryId: category.id,
          name,
          make: cell(row.make).slice(0, 120),
          model: cell(row.model).slice(0, 160),
          serialNo,
          purchasedOn,
          vendor: cell(row.vendor).slice(0, 160),
          owner: cell(row.owner).slice(0, 160),
          locationId,
          description: remarks,
          condition: condition.slice(0, 160),
          customFields,
          status,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });
      if (employee) {
        await tx.assetAssignment.create({
          data: {
            tenantId,
            assetId: asset.id,
            employeeId: employee.id,
            assignedOn,
            issueCondition:
              sheetIssueCondition(condition) ??
              condition.toLowerCase().slice(0, 60),
            accessories,
            conditionNotes: 'Imported from the asset sheet',
            project: cell(row.project).slice(0, 300),
            contactMobile: cell(row.mobile).slice(0, 30),
            employmentType: cell(row.employmentType).slice(0, 60),
            issuedById: actorUserId,
            ackStatus: 'not_recorded',
            ...(holder
              ? {}
              : {
                  returnedOn: today(),
                  returnedById: actorUserId,
                  endReason:
                    status === 'lost'
                      ? ('lost' as const)
                      : ('returned' as const),
                }),
          },
        });
      }
      if (status !== 'in_stock') {
        await this.support.recordStatus(tx, {
          tenantId,
          assetId: asset.id,
          from: 'in_stock',
          to: status,
          reason: holder
            ? `Imported as allocated to ${fullName(holder)}`
            : 'Imported from the asset sheet',
          source: 'import',
          changedById: actorUserId,
        });
      }
      if (status === 'under_maintenance') {
        await this.maintenance.openFromLifecycle(tx, {
          tenantId,
          assetId: asset.id,
          issue: remarks || 'Marked not working in the imported asset sheet',
          actorUserId,
          startedOn: today(),
        });
      }
      return assetTag;
    });
  }

  /** Employee ID first, then email, then the name in "Assign To" or "Assigned to Employee". */
  private findEmployee(people: Person[], row: AssetSheetRowDto) {
    const code = (row.employeeCode ?? '').trim();
    if (code) {
      const match = people.find(
        (person) => person.employeeCode.toLowerCase() === code.toLowerCase(),
      );
      if (!match)
        throw new BadRequestException(`No employee has the ID ${code}.`);
      return match;
    }
    const email = (row.email ?? '').trim().toLowerCase();
    if (email) {
      const match = people.find(
        (person) => person.user.email.toLowerCase() === email,
      );
      if (!match)
        throw new BadRequestException(`No employee has the email ${email}.`);
      return match;
    }
    const names = [
      row.assignTo,
      isSheetFlagWord(row.assignedToEmployee) ? '' : row.assignedToEmployee,
    ]
      .map((value) => (value ?? '').trim())
      .filter((value) => value && !NOBODY.test(value));
    for (const name of names) {
      const matches = people.filter(
        (person) => squash(fullName(person)) === squash(name),
      );
      if (matches.length === 1) return matches[0];
      if (matches.length > 1)
        throw new BadRequestException(
          `More than one employee is called ${name}. Add their Employee ID.`,
        );
      throw new BadRequestException(
        `No employee is called ${name}. Add their Employee ID.`,
      );
    }
    return null;
  }
}
