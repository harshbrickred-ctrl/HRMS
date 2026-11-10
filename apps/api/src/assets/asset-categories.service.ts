import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { categoryCode, parseFieldDefs, validateFieldDefs } from './asset-rules';
import type { CreateAssetCategoryDto, UpdateAssetCategoryDto } from './dto/assets.dto';

type CategoryRow = Prisma.AssetCategoryGetPayload<object> & { _count?: { assets: number } };

@Injectable()
export class AssetCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** What the asset form and employee requests can pick from. */
  async listActive(tenantId: string) {
    const rows = await this.prisma.assetCategory.findMany({
      where: { tenantId, active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.view(row));
  }

  async listAll(tenantId: string) {
    const rows = await this.prisma.assetCategory.findMany({
      where: { tenantId },
      include: { _count: { select: { assets: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.view(row));
  }

  async create(tenantId: string, actorUserId: string, dto: CreateAssetCategoryDto) {
    const name = dto.name.trim();
    const code = categoryCode(name);
    if (!code) throw new BadRequestException('Category name needs letters or digits.');
    const fields = validateFieldDefs(dto.fields ?? []);
    try {
      const row = await this.prisma.assetCategory.create({
        data: {
          tenantId,
          code,
          name,
          tagPrefix: dto.tagPrefix,
          fields,
          usefulLifeMonths: dto.usefulLifeMonths,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      });
      await this.audit(tenantId, actorUserId, 'assets.category.create', row.id, { code });
      return this.view(row);
    } catch (error) {
      throw this.conflict(error);
    }
  }

  async update(tenantId: string, actorUserId: string, id: string, dto: UpdateAssetCategoryDto) {
    const category = await this.prisma.assetCategory.findFirst({ where: { id, tenantId } });
    if (!category) throw new NotFoundException('Category not found.');
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) throw new BadRequestException('Category name is required.');
    const fields = dto.fields ? validateFieldDefs(dto.fields) : undefined;
    try {
      const row = await this.prisma.assetCategory.update({
        where: { id },
        data: {
          name,
          tagPrefix: dto.tagPrefix,
          fields,
          usefulLifeMonths: dto.usefulLifeMonths,
          active: dto.active,
          updatedById: actorUserId,
        },
      });
      await this.audit(tenantId, actorUserId, 'assets.category.update', id, {
        fields: Object.keys(dto),
      });
      return this.view(row);
    } catch (error) {
      throw this.conflict(error);
    }
  }

  private conflict(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('A category with that name or tag prefix already exists.');
    }
    return error;
  }

  private async audit(
    tenantId: string,
    actorUserId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.auditEvent.create({
      data: { tenantId, actorUserId, action, entityType: 'asset', entityId, metadata: metadata as object },
    });
  }

  private view(row: CategoryRow) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      tagPrefix: row.tagPrefix,
      fields: parseFieldDefs(row.fields),
      usefulLifeMonths: row.usefulLifeMonths,
      active: row.active,
      ...(row._count ? { assetCount: row._count.assets } : {}),
    };
  }
}
