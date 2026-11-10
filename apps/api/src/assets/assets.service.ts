import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssetStatus, Prisma } from '@prisma/client';
import path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  NEXT_STATUSES,
  WARRANTY_WINDOW_DAYS,
  cleanCustomFields,
  depreciation,
  formatTag,
  normaliseSerial,
  parseFieldDefs,
  ticketReference,
} from './asset-rules';
import {
  AssetSupport,
  PHOTO_EXT,
  assetInclude,
  day,
  dayOrNull,
  fullName,
  isPrismaError,
  person,
  toDay,
  today,
  type AssetRow,
  type AssetUpload,
} from './asset-support.service';
import type { CreateAssetDto, UpdateAssetDto, UpdateAssetTicketDto } from './dto/assets.dto';

const LIST_LIMIT = 500;
const DAY_MS = 86_400_000;

const ASSET_VIEWS = ['region', 'warranty', 'unassigned', 'overdue', 'unacknowledged'] as const;
type AssetView = (typeof ASSET_VIEWS)[number];

export type AssetListFilters = {
  q?: string;
  status?: string;
  categoryId?: string;
  locationId?: string;
  departmentId?: string;
  view?: string;
};

export const ticketInclude = {
  comments: { orderBy: { createdAt: 'asc' as const } },
  files: { orderBy: { uploadedAt: 'asc' as const } },
  asset: { include: { category: true } },
} satisfies Prisma.AssetTicketInclude;

/** Shape every admin asset endpoint returns. Employees get a narrower one in AssetSelfService. */
export function assetView(row: AssetRow) {
  const current = row.assignments[0];
  const value = depreciation(row.cost?.toNumber() ?? null, row.purchasedOn, row.category.usefulLifeMonths, today());
  return {
    id: row.id,
    assetTag: row.assetTag,
    category: { id: row.category.id, code: row.category.code, name: row.category.name },
    name: row.name,
    make: row.make,
    model: row.model,
    serialNo: row.serialNo,
    status: row.status,
    purchasedOn: dayOrNull(row.purchasedOn),
    vendor: row.vendor,
    owner: row.owner,
    condition: row.condition,
    cost: row.cost?.toNumber() ?? null,
    bookValue: value?.bookValue ?? null,
    warrantyExpiry: dayOrNull(row.warrantyExpiry),
    location: row.location ? { id: row.location.id, name: row.location.name } : null,
    description: row.description,
    customFields: row.customFields as Record<string, string | number>,
    hasPhoto: Boolean(row.photoPath),
    current: current
      ? {
          allocationId: current.id,
          employeeId: current.employee.id,
          name: `${current.employee.firstName} ${current.employee.lastName}`.trim(),
          employeeCode: current.employee.employeeCode,
          department: current.employee.department?.name ?? null,
          assignedOn: day(current.assignedOn),
          expectedReturnOn: dayOrNull(current.expectedReturnOn),
          ackStatus: current.ackStatus,
        }
      : null,
  };
}

export function ticketView(row: Prisma.AssetTicketGetPayload<{ include: typeof ticketInclude }>) {
  return {
    id: row.id,
    reference: ticketReference(row.number),
    type: row.type,
    category: row.category,
    priority: row.priority,
    subject: row.subject,
    body: row.body,
    status: row.status,
    lostOn: dayOrNull(row.lostOn),
    lostLocation: row.lostLocation,
    asset: row.asset
      ? {
          id: row.asset.id,
          assetTag: row.asset.assetTag,
          name: row.asset.name,
          category: row.asset.category.code,
          status: row.asset.status,
        }
      : null,
    files: row.files.map((file) => ({ id: file.id, fileName: file.fileName })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    comments: row.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AssetSupport,
  ) {}

  async people(tenantId: string) {
    const rows = await this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      include: { department: true, user: { select: { status: true } } },
    });
    return rows.map((row) => ({
      ...person(row),
      department: row.department?.name ?? null,
      active: row.user.status === 'ACTIVE',
    }));
  }

  /** For the asset form: IT admins have no access to the HR org endpoint. */
  locations(tenantId: string) {
    return this.prisma.location.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async list(tenantId: string, actorUserId: string, filters: AssetListFilters) {
    const rows = await this.prisma.asset.findMany({
      where: await this.registerWhere(tenantId, actorUserId, filters),
      include: assetInclude,
      orderBy: { assetTag: 'asc' },
      take: LIST_LIMIT,
    });
    return rows.map((row) => assetView(row));
  }

  /** The register's filters as a query, shared with the sheet export. */
  async registerWhere(tenantId: string, actorUserId: string, filters: AssetListFilters) {
    if (filters.status && !(filters.status in AssetStatus)) {
      throw new BadRequestException('Unknown asset status.');
    }
    if (filters.view && !ASSET_VIEWS.includes(filters.view as AssetView)) {
      throw new BadRequestException('Unknown register view.');
    }
    const region = filters.view === 'region' ? await this.regionOf(actorUserId) : null;
    return this.listWhere(tenantId, filters, region);
  }

  /** Counts behind the register's quick views. Region is the location of the person asking. */
  async summary(tenantId: string, actorUserId: string) {
    const region = await this.regionOf(actorUserId);
    const count = (view?: AssetView) =>
      this.prisma.asset.count({ where: this.listWhere(tenantId, { view }, region) });
    const [all, mine, warranty, unassigned, overdue, unacknowledged] = await Promise.all([
      count(),
      region ? count('region') : Promise.resolve(null),
      count('warranty'),
      count('unassigned'),
      count('overdue'),
      count('unacknowledged'),
    ]);
    return { all, region: mine, regionName: region?.name ?? null, warranty, unassigned, overdue, unacknowledged };
  }

  private async regionOf(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId }, include: { location: true } });
    return employee?.location ? { id: employee.location.id, name: employee.location.name } : null;
  }

  private listWhere(
    tenantId: string,
    filters: AssetListFilters,
    region: { id: string } | null,
  ): Prisma.AssetWhereInput {
    const q = filters.q?.trim();
    const match = { contains: q, mode: 'insensitive' as const };
    const now = today();
    const holder = (where: Prisma.AssetAssignmentWhereInput) => ({
      assignments: { some: { returnedOn: null, ...where } },
    });
    const views: Record<AssetView, Prisma.AssetWhereInput> = {
      region: { locationId: region?.id ?? '__none__' },
      warranty: {
        status: { notIn: ['disposed', 'written_off'] },
        warrantyExpiry: { gte: now, lte: new Date(now.getTime() + WARRANTY_WINDOW_DAYS * DAY_MS) },
      },
      unassigned: { status: 'in_stock' },
      overdue: holder({ expectedReturnOn: { lt: now } }),
      unacknowledged: holder({ ackStatus: 'pending' }),
    };
    return {
      tenantId,
      AND: [
        filters.view ? views[filters.view as AssetView] : {},
        filters.status ? { status: filters.status as AssetStatus } : {},
        filters.categoryId ? { categoryId: filters.categoryId } : {},
        filters.locationId ? { locationId: filters.locationId } : {},
        filters.departmentId ? holder({ employee: { departmentId: filters.departmentId } }) : {},
        q
          ? {
              OR: [
                { assetTag: match },
                { name: match },
                { make: match },
                { model: match },
                { serialNo: match },
                holder({
                  employee: {
                    OR: [{ firstName: match }, { lastName: match }, { employeeCode: match }],
                  },
                }),
              ],
            }
          : {},
      ],
    };
  }

  async detail(tenantId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, tenantId },
      include: {
        ...assetInclude,
        createdBy: { select: { email: true } },
        updatedBy: { select: { email: true } },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    const open = asset.assignments[0];
    const [holder, repairs] = await Promise.all([
      open
        ? this.prisma.employee.findUnique({
            where: { id: open.employeeId },
            include: { department: true, location: true, manager: true },
          })
        : null,
      this.prisma.assetMaintenance.aggregate({ where: { assetId: id }, _sum: { cost: true }, _count: true }),
    ]);
    const cost = asset.cost?.toNumber() ?? null;
    const now = today();
    const value = depreciation(cost, asset.purchasedOn, asset.category.usefulLifeMonths, now);
    return {
      ...assetView(asset),
      fieldDefs: parseFieldDefs(asset.category.fields),
      nextStatuses: NEXT_STATUSES[asset.status],
      holder:
        open && holder
          ? {
              department: holder.department?.name ?? null,
              location: holder.location?.name ?? null,
              manager: holder.manager ? fullName(holder.manager) : null,
              issueCondition: open.issueCondition,
              accessories: open.accessories,
              project: open.project,
              contactMobile: open.contactMobile,
              employmentType: open.employmentType,
              ackDueOn: dayOrNull(open.ackDueOn),
              ackAt: open.ackAt?.toISOString() ?? null,
              ackMethod: open.ackMethod,
            }
          : null,
      financials: {
        method: 'Straight line',
        lifeMonths: asset.category.usefulLifeMonths,
        monthsUsed: value?.monthsUsed ?? null,
        depreciated: value?.depreciated ?? null,
        bookValue: value?.bookValue ?? null,
        repairCost: repairs._sum.cost?.toNumber() ?? 0,
        repairs: repairs._count,
      },
      warranty: asset.warrantyExpiry
        ? {
            startsOn: dayOrNull(asset.purchasedOn),
            endsOn: day(asset.warrantyExpiry),
            daysLeft: Math.round((asset.warrantyExpiry.getTime() - now.getTime()) / DAY_MS),
            elapsedPercent: asset.purchasedOn
              ? Math.min(
                  100,
                  Math.max(
                    0,
                    Math.round(
                      ((now.getTime() - asset.purchasedOn.getTime()) /
                        Math.max(DAY_MS, asset.warrantyExpiry.getTime() - asset.purchasedOn.getTime())) *
                        100,
                    ),
                  ),
                )
              : null,
          }
        : null,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
      createdBy: asset.createdBy?.email ?? null,
      updatedBy: asset.updatedBy?.email ?? null,
    };
  }

  async create(tenantId: string, actorUserId: string, dto: CreateAssetDto) {
    const category = await this.requireCategory(tenantId, dto.categoryId);
    if (!category.active) throw new BadRequestException(`${category.name} is no longer in use.`);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Asset name is required.');
    const customFields = cleanCustomFields(parseFieldDefs(category.fields), dto.customFields);
    const serialNo = normaliseSerial(dto.serialNo);
    await this.assertSerialFree(tenantId, serialNo, null);
    await this.assertLocation(tenantId, dto.locationId);
    const purchasedOn = toDay(dto.purchasedOn);
    const warrantyExpiry = toDay(dto.warrantyExpiry);
    this.assertWarranty(purchasedOn, warrantyExpiry);
    try {
      const asset = await this.prisma.$transaction(async (tx) => {
        const assetTag = await this.nextTag(tx, tenantId, category.id);
        return tx.asset.create({
          data: {
            tenantId,
            assetTag,
            categoryId: category.id,
            name,
            make: dto.make?.trim() ?? '',
            model: dto.model?.trim() ?? '',
            serialNo,
            purchasedOn,
            vendor: dto.vendor?.trim() ?? '',
            owner: dto.owner?.trim() ?? '',
            cost: dto.cost ?? null,
            warrantyExpiry,
            locationId: dto.locationId || null,
            description: dto.description?.trim() ?? '',
            customFields,
            status: 'in_stock',
            createdById: actorUserId,
            updatedById: actorUserId,
          },
          include: assetInclude,
        });
      });
      await this.support.audit(tenantId, actorUserId, 'assets.create', asset.id, {
        assetTag: asset.assetTag,
      });
      return assetView(asset);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('That serial number or asset tag is already registered.');
      }
      throw error;
    }
  }

  /** Status is not editable here: it only changes through validated lifecycle operations. */
  async update(tenantId: string, actorUserId: string, id: string, dto: UpdateAssetDto) {
    const asset = await this.support.requireAsset(tenantId, id);
    const category =
      dto.categoryId && dto.categoryId !== asset.categoryId
        ? await this.requireCategory(tenantId, dto.categoryId)
        : asset.category;
    if (category.id !== asset.categoryId && !category.active) {
      throw new BadRequestException(`${category.name} is no longer in use.`);
    }
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) throw new BadRequestException('Asset name is required.');

    // Fields are only rechecked when they or the category change, so editing an older
    // asset is not blocked by a field added to its category later.
    const customFields =
      dto.customFields || category.id !== asset.categoryId
        ? cleanCustomFields(parseFieldDefs(category.fields), dto.customFields)
        : undefined;

    const serialNo = dto.serialNo === undefined ? undefined : normaliseSerial(dto.serialNo);
    if (serialNo !== undefined) await this.assertSerialFree(tenantId, serialNo, id);
    await this.assertLocation(tenantId, dto.locationId);
    const purchasedOn = dto.purchasedOn === undefined ? undefined : toDay(dto.purchasedOn);
    const warrantyExpiry = dto.warrantyExpiry === undefined ? undefined : toDay(dto.warrantyExpiry);
    this.assertWarranty(
      purchasedOn === undefined ? asset.purchasedOn : purchasedOn,
      warrantyExpiry === undefined ? asset.warrantyExpiry : warrantyExpiry,
    );

    try {
      const updated = await this.prisma.asset.update({
        where: { id },
        data: {
          categoryId: category.id,
          name,
          make: dto.make?.trim(),
          model: dto.model?.trim(),
          serialNo,
          purchasedOn,
          vendor: dto.vendor?.trim(),
          owner: dto.owner?.trim(),
          cost: dto.cost,
          warrantyExpiry,
          locationId: dto.locationId === undefined ? undefined : dto.locationId || null,
          description: dto.description?.trim(),
          customFields,
          updatedById: actorUserId,
        },
        include: assetInclude,
      });
      await this.support.audit(tenantId, actorUserId, 'assets.update', id, {
        fields: Object.keys(dto).filter((key) => dto[key as keyof UpdateAssetDto] !== undefined),
      });
      return assetView(updated);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('That serial number is already registered.');
      }
      throw error;
    }
  }

  /** Asset history is permanent, so only an asset that has never been used can be removed. */
  async remove(tenantId: string, actorUserId: string, id: string) {
    const asset = await this.support.requireAsset(tenantId, id);
    if (asset.status !== 'in_stock') {
      throw new ConflictException('Only an asset in stock can be deleted.');
    }
    const [assignments, tickets, changes, repairs] = await Promise.all([
      this.prisma.assetAssignment.count({ where: { assetId: id } }),
      this.prisma.assetTicket.count({ where: { assetId: id } }),
      this.prisma.assetStatusHistory.count({ where: { assetId: id } }),
      this.prisma.assetMaintenance.count({ where: { assetId: id } }),
    ]);
    if (assignments || tickets || changes || repairs) {
      throw new ConflictException('This asset has history, so it cannot be deleted.');
    }
    try {
      await this.prisma.asset.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, 'P2003')) {
        throw new ConflictException('This asset has history, so it cannot be deleted.');
      }
      throw error;
    }
    if (asset.photoPath) await this.support.removeFile(asset.photoPath);
    await this.support.audit(tenantId, actorUserId, 'assets.delete', id, {
      assetTag: asset.assetTag,
      name: asset.name,
      serialNo: asset.serialNo,
    });
    return { ok: true };
  }

  async setPhoto(tenantId: string, actorUserId: string, id: string, file: AssetUpload | undefined) {
    const asset = await this.support.requireAsset(tenantId, id);
    const saved = await this.support.saveFile(tenantId, id, file, PHOTO_EXT);
    const updated = await this.prisma.asset.update({
      where: { id },
      data: { photoPath: saved.storagePath, updatedById: actorUserId },
      include: assetInclude,
    });
    if (asset.photoPath) await this.support.removeFile(asset.photoPath);
    await this.support.audit(tenantId, actorUserId, 'assets.photo', id);
    return assetView(updated);
  }

  async openPhoto(tenantId: string, id: string) {
    const asset = await this.support.requireAsset(tenantId, id);
    if (!asset.photoPath) throw new NotFoundException('This asset has no photo.');
    return this.support.openFile(asset.photoPath, path.basename(asset.photoPath));
  }

  async tickets(tenantId: string) {
    const rows = await this.prisma.assetTicket.findMany({
      where: { tenantId },
      include: { ...ticketInclude, employee: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({ ...ticketView(row), person: person(row.employee) }));
  }

  /** Admins review employees' reports; nobody can decide their own. */
  async updateTicket(tenantId: string, actorUserId: string, id: string, dto: UpdateAssetTicketDto) {
    const ticket = await this.prisma.assetTicket.findFirst({
      where: { id, tenantId },
      include: { employee: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    if (ticket.employee.userId === actorUserId) {
      throw new ForbiddenException('You cannot process a report you raised yourself.');
    }
    await this.prisma.assetTicket.update({ where: { id }, data: { status: dto.status } });
    if (dto.note?.trim()) {
      await this.prisma.assetTicketComment.create({
        data: { ticketId: id, authorId: actorUserId, body: dto.note.trim() },
      });
    }
    await this.support.audit(tenantId, actorUserId, 'assets.ticket.status', id, { status: dto.status });
    const reference = ticketReference(ticket.number);
    await this.support.notifyUser(tenantId, ticket.employee.userId, {
      title:
        ticket.type === 'Loss'
          ? `Lost asset report ${reference} reviewed: ${dto.status}`
          : `Asset report ${reference}: ${dto.status}`,
      body: ticket.subject,
      href: '/ess/assets/reports',
    });
    return ticketView(
      await this.prisma.assetTicket.findUniqueOrThrow({ where: { id }, include: ticketInclude }),
    );
  }

  async openTicketFile(tenantId: string, ticketId: string, fileId: string) {
    const file = await this.prisma.assetTicketFile.findFirst({
      where: { id: fileId, ticketId, ticket: { tenantId } },
    });
    if (!file) throw new NotFoundException('File not found.');
    return this.support.openFile(file.storagePath, file.fileName);
  }

  /** Next unused tag for a category. The counter's row lock keeps concurrent creates apart. */
  async nextTag(tx: Prisma.TransactionClient, tenantId: string, categoryId: string) {
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const category = await tx.assetCategory.update({
        where: { id: categoryId },
        data: { nextTagNumber: { increment: 1 } },
      });
      const assetTag = formatTag(category.tagPrefix, category.nextTagNumber - 1);
      const taken = await tx.asset.findFirst({ where: { tenantId, assetTag }, select: { id: true } });
      if (!taken) return assetTag;
    }
    throw new ConflictException('Could not generate an asset tag. Check the category tag prefix.');
  }

  private async requireCategory(tenantId: string, id: string) {
    const category = await this.prisma.assetCategory.findFirst({ where: { id, tenantId } });
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }

  private async assertLocation(tenantId: string, locationId: string | null | undefined) {
    if (!locationId) return;
    const location = await this.prisma.location.findFirst({ where: { id: locationId, tenantId } });
    if (!location) throw new NotFoundException('Location not found.');
  }

  private async assertSerialFree(tenantId: string, serialNo: string | null, exceptId: string | null) {
    if (!serialNo) return;
    const clash = await this.prisma.asset.findFirst({ where: { tenantId, serialNo } });
    if (clash && clash.id !== exceptId) {
      throw new ConflictException(`Serial number ${serialNo} is already registered to ${clash.assetTag}.`);
    }
  }

  private assertWarranty(purchasedOn: Date | null, warrantyExpiry: Date | null) {
    if (purchasedOn && warrantyExpiry && warrantyExpiry < purchasedOn) {
      throw new BadRequestException('Warranty expiry cannot be before the purchase date.');
    }
  }
}
