import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AssetAllocationsService } from './asset-allocations.service';
import { AssetMaintenanceService } from './asset-maintenance.service';
import { AssetReportsService } from './asset-reports.service';
import { AssetRequestsService } from './asset-requests.service';
import {
  CompleteMaintenanceDto,
  DepartmentHeadDto,
  FulfilAssetRequestDto,
  MaintenanceStageDto,
  OpenMaintenanceDto,
  RequestDecisionDto,
  RequestQuestionDto,
  UpdateMaintenanceDto,
} from './dto/assets.dto';

/** Asset admin work queues: requests, maintenance, dashboard, and reports. */
@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('assets.manage')
export class AssetOperationsController {
  constructor(
    private readonly requests: AssetRequestsService,
    private readonly maintenance: AssetMaintenanceService,
    private readonly reports: AssetReportsService,
    private readonly allocations: AssetAllocationsService,
  ) {}

  @Get('dashboard')
  dashboard(
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.reports.dashboard(user.tenantId, { locationId, categoryId });
  }

  @Get('reports/:kind')
  report(
    @CurrentUser() user: AuthUser,
    @Param('kind') kind: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.report(user.tenantId, kind, { days, from, to });
  }

  @Get('requests')
  listRequests(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.requests.list(user.tenantId, status);
  }

  @Post('requests/:id/decision')
  decideRequest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RequestDecisionDto) {
    return this.requests.decideAsAdmin(user.tenantId, user.userId, id, dto);
  }

  @Post('requests/:id/question')
  ask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RequestQuestionDto) {
    return this.requests.ask(user.tenantId, user.userId, id, dto.question);
  }

  @Get('handovers')
  handovers(@CurrentUser() user: AuthUser) {
    return this.allocations.pendingHandovers(user.tenantId);
  }

  @Post('requests/:id/fulfil')
  fulfil(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FulfilAssetRequestDto) {
    return this.requests.fulfil(user.tenantId, user.userId, id, dto);
  }

  @Get('departments')
  departments(@CurrentUser() user: AuthUser) {
    return this.requests.departments(user.tenantId);
  }

  @Put('departments/:id/head')
  setHead(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DepartmentHeadDto) {
    return this.requests.setDepartmentHead(user.tenantId, user.userId, id, dto);
  }

  @Get('maintenance')
  listMaintenance(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('assetId') assetId?: string,
  ) {
    return this.maintenance.list(user.tenantId, { status, assetId });
  }

  @Patch('maintenance/:id')
  updateMaintenance(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMaintenanceDto) {
    return this.maintenance.update(user.tenantId, user.userId, id, dto);
  }

  @Get('maintenance/overview')
  maintenanceOverview(@CurrentUser() user: AuthUser) {
    return this.maintenance.overview(user.tenantId);
  }

  @Post('maintenance/:id/stage')
  stage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MaintenanceStageDto) {
    return this.maintenance.setStage(user.tenantId, user.userId, id, dto.stage);
  }

  @Post('maintenance/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CompleteMaintenanceDto) {
    return this.maintenance.complete(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/maintenance')
  open(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OpenMaintenanceDto) {
    return this.maintenance.open(user.tenantId, user.userId, id, dto);
  }
}
