import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AttendanceService } from './attendance.service';
import { CorrectionDto, PunchDto } from './dto/attendance.dto';

function monthQuery(year?: string, month?: string) {
  const now = new Date();
  return {
    year: Number(year) || now.getFullYear(),
    month: Number(month) || now.getMonth() + 1,
  };
}

@Controller('attendance/me')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('attendance.self')
export class AttendanceSelfController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  month(
    @CurrentUser() user: AuthUser,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const query = monthQuery(year, month);
    return this.attendance.myMonth(user.userId, query.year, query.month);
  }

  @Post('punches')
  punch(@CurrentUser() user: AuthUser, @Body() dto: PunchDto) {
    return this.attendance.punchWeb(user.userId, dto.direction);
  }

  @Post('corrections')
  correct(@CurrentUser() user: AuthUser, @Body() dto: CorrectionDto) {
    return this.attendance.requestCorrection(user.userId, dto);
  }
}
