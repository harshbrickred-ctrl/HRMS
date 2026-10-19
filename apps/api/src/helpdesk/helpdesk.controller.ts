import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CreateTicketDto, UpdateTicketStatusDto } from './dto/helpdesk.dto';
import { HelpdeskService } from './helpdesk.service';

@Controller('helpdesk')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HelpdeskController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  @Get('me')
  @Permissions('helpdesk.self')
  mine(@CurrentUser() user: AuthUser) {
    return this.helpdesk.myTickets(user.userId);
  }

  @Post('me')
  @Permissions('helpdesk.self')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.helpdesk.create(user.userId, dto);
  }

  @Get()
  @Permissions('helpdesk.manage')
  company(@CurrentUser() user: AuthUser) {
    return this.helpdesk.companyTickets(user.tenantId);
  }

  @Patch(':id/status')
  @Permissions('helpdesk.manage')
  status(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.helpdesk.updateStatus(user.tenantId, user.userId, id, dto);
  }
}
