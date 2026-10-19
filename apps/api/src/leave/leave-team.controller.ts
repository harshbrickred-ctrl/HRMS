import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { LeaveDecisionDto } from './dto/leave.dto';
import { LeaveService } from './leave.service';

@Controller('leave/team')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('leave.team.read')
export class LeaveTeamController {
  constructor(private readonly leave: LeaveService) {}

  @Get()
  team(@CurrentUser() user: AuthUser) {
    return this.leave.teamLeave(user.userId);
  }

  @Post('requests/:id/decision')
  @Permissions('leave.approve')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.leave.decide(user.userId, id, dto);
  }
}
