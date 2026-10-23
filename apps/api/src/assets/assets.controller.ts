import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AssetsService } from './assets.service';
import {
  AssignAssetDto,
  CreateAssetDto,
  CreateAssetTicketDto,
  ReturnAssetDto,
  UpdateAssetDto,
  UpdateAssetTicketDto,
} from './dto/assets.dto';

@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('me')
  @Permissions('assets.self')
  mine(@CurrentUser() user: AuthUser) {
    return this.assets.myAssets(user.userId);
  }

  @Get('me/tickets')
  @Permissions('assets.self')
  myTickets(@CurrentUser() user: AuthUser) {
    return this.assets.myTickets(user.userId);
  }

  @Post('me/tickets')
  @Permissions('assets.self')
  createTicket(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetTicketDto) {
    return this.assets.createTicket(user.userId, dto);
  }

  @Get('tickets')
  @Permissions('assets.tickets.manage')
  tickets(@CurrentUser() user: AuthUser) {
    return this.assets.tickets(user.tenantId);
  }

  @Patch('tickets/:id/status')
  @Permissions('assets.tickets.manage')
  ticketStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAssetTicketDto,
  ) {
    return this.assets.updateTicket(user.tenantId, user.userId, id, dto);
  }

  @Get('people')
  @Permissions('assets.manage')
  people(@CurrentUser() user: AuthUser) {
    return this.assets.people(user.tenantId);
  }

  @Get()
  @Permissions('assets.manage')
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.assets.list(user.tenantId, status);
  }

  @Post()
  @Permissions('assets.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetDto) {
    return this.assets.create(user.tenantId, user.userId, dto);
  }

  @Get(':id/history')
  @Permissions('assets.manage')
  history(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assets.history(user.tenantId, id);
  }

  @Patch(':id')
  @Permissions('assets.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assets.update(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/assign')
  @Permissions('assets.manage')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignAssetDto) {
    return this.assets.assign(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/return')
  @Permissions('assets.manage')
  returnAsset(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReturnAssetDto,
  ) {
    return this.assets.returnAsset(user.tenantId, user.userId, id, dto);
  }
}
