import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AttendanceService } from './attendance.service';
import { DecisionDto } from './dto/attendance.dto';

function monthQuery(year?: string, month?: string) {
  const now = new Date();
  return {
    year: Number(year) || now.getFullYear(),
    month: Number(month) || now.getMonth() + 1,
  };
}

@Controller('attendance/team')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('attendance.team.read')
export class AttendanceTeamController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  month(
    @CurrentUser() user: AuthUser,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const query = monthQuery(year, month);
    return this.attendance.teamMonth(user.userId, query.year, query.month);
  }

  @Post('corrections/:id/decision')
  @Permissions('attendance.approve')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.attendance.decide(user.userId, id, dto);
  }
}
