import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @Permissions('reports.read')
  summary(@CurrentUser() user: AuthUser) {
    return this.reports.summary(user.tenantId);
  }

  @Get('workflows')
  @Permissions('hr.manage')
  workflows(@CurrentUser() user: AuthUser) {
    return this.reports.workflows(user.tenantId);
  }
}
