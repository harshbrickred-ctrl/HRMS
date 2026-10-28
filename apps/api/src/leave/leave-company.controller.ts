import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { LeaveService } from './leave.service';

@Controller('leave/company')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('leave.approve')
export class LeaveCompanyController {
  constructor(private readonly leave: LeaveService) {}

  @Get()
  queue(@CurrentUser() user: AuthUser) {
    return this.leave.companyLeave(user.userId);
  }
}
