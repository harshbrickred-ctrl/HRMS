import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { ApplyLeaveDto } from './dto/leave.dto';
import { LeaveService } from './leave.service';

@Controller('leave/me')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('leave.self')
export class LeaveSelfController {
  constructor(private readonly leave: LeaveService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.leave.myLeave(user.userId);
  }

  @Post('requests')
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyLeaveDto) {
    return this.leave.apply(user.userId, dto);
  }

  @Post('requests/:id/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leave.withdraw(user.userId, id);
  }
}
