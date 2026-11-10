import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AssetCategoriesService } from './asset-categories.service';
import { CreateAssetCategoryDto, UpdateAssetCategoryDto } from './dto/assets.dto';

/** Registered before AssetsController so `assets/categories` is not read as an asset id. */
@Controller('assets/categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetCategoriesController {
  constructor(private readonly categories: AssetCategoriesService) {}

  @Get()
  @Permissions('assets.self')
  active(@CurrentUser() user: AuthUser) {
    return this.categories.listActive(user.tenantId);
  }

  @Get('all')
  @Permissions('assets.manage')
  all(@CurrentUser() user: AuthUser) {
    return this.categories.listAll(user.tenantId);
  }

  @Post()
  @Permissions('assets.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetCategoryDto) {
    return this.categories.create(user.tenantId, user.userId, dto);
  }

  @Patch(':id')
  @Permissions('assets.manage')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAssetCategoryDto,
  ) {
    return this.categories.update(user.tenantId, user.userId, id, dto);
  }
}
