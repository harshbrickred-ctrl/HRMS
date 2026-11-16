import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { ApplyLeaveForEmployeeDto } from './dto/leave.dto';
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

  @Post('requests')
  applyForEmployee(@CurrentUser() user: AuthUser, @Body() dto: ApplyLeaveForEmployeeDto) {
    return this.leave.applyForEmployee(user.userId, dto);
  }
}
