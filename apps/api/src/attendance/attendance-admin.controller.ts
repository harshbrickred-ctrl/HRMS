import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AttendanceService } from './attendance.service';
import {
  AssignmentDto,
  CommKeyDto,
  DeviceDto,
  EnrollmentDto,
  HolidayDto,
  MapPunchDto,
  OverrideDto,
  PolicyDto,
  ShiftDto,
} from './dto/attendance.dto';

function monthQuery(year?: string, month?: string) {
  const now = new Date();
  return {
    year: Number(year) || now.getFullYear(),
    month: Number(month) || now.getMonth() + 1,
  };
}

@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceAdminController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('shifts')
  @Permissions('attendance.manage')
  shifts(@CurrentUser() user: AuthUser) {
    return this.attendance.listShifts(user.tenantId);
  }

  @Post('shifts')
  @Permissions('attendance.manage')
  createShift(@CurrentUser() user: AuthUser, @Body() dto: ShiftDto) {
    return this.attendance.createShift(user.tenantId, user.userId, dto);
  }

  @Post('assignments')
  @Permissions('attendance.manage')
  assign(@CurrentUser() user: AuthUser, @Body() dto: AssignmentDto) {
    return this.attendance.assignShift(user.tenantId, user.userId, dto);
  }

  @Get('holidays')
  @Permissions('attendance.manage')
  holidays(@CurrentUser() user: AuthUser) {
    return this.attendance.listHolidays(user.tenantId);
  }

  @Post('holidays')
  @Permissions('attendance.manage')
  createHoliday(@CurrentUser() user: AuthUser, @Body() dto: HolidayDto) {
    return this.attendance.createHoliday(user.tenantId, user.userId, dto);
  }

  @Delete('holidays/:id')
  @Permissions('attendance.manage')
  deleteHoliday(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attendance.deleteHoliday(user.tenantId, user.userId, id);
  }

  @Get('policy')
  @Permissions('attendance.manage')
  policy(@CurrentUser() user: AuthUser) {
    return this.attendance.getPolicy(user.tenantId);
  }

  @Patch('policy')
  @Permissions('attendance.manage')
  updatePolicy(@CurrentUser() user: AuthUser, @Body() dto: PolicyDto) {
    return this.attendance.updatePolicy(user.tenantId, user.userId, dto);
  }

  @Get('exceptions')
  @Permissions('attendance.manage')
  exceptions(
    @CurrentUser() user: AuthUser,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const query = monthQuery(year, month);
    return this.attendance.companyExceptions(user.tenantId, query.year, query.month);
  }

  @Get('unmatched')
  @Permissions('attendance.manage')
  unmatched(@CurrentUser() user: AuthUser) {
    return this.attendance.unmatched(user.tenantId);
  }

  @Post('unmatched/:id/map')
  @Permissions('attendance.manage')
  map(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MapPunchDto,
  ) {
    return this.attendance.mapUnmatched(user.tenantId, user.userId, id, dto.employeeId);
  }

  @Post('days/:employeeId/:date/override')
  @Permissions('attendance.override')
  override(
    @CurrentUser() user: AuthUser,
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
    @Body() dto: OverrideDto,
  ) {
    return this.attendance.override(user.tenantId, user.userId, employeeId, date, dto);
  }

  @Get('periods/:year/:month')
  @Permissions('attendance.manage')
  period(
    @CurrentUser() user: AuthUser,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.attendance.period(user.tenantId, Number(year), Number(month));
  }

  @Post('periods/:year/:month/lock')
  @Permissions('attendance.period.lock')
  lock(
    @CurrentUser() user: AuthUser,
    @Param('year') year: string,
    @Param('month') month: string,
  ) {
    return this.attendance.lockPeriod(user.tenantId, user.userId, Number(year), Number(month));
  }

  @Get('register/:year/:month')
  @Permissions('attendance.manage')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async register(
    @CurrentUser() user: AuthUser,
    @Param('year') year: string,
    @Param('month') month: string,
    @Res() res: Response,
  ) {
    const y = Number(year);
    const m = Number(month);
    const csv = await this.attendance.registerCsv(user.tenantId, y, m);
    const file = `attendance-${y}-${String(m).padStart(2, '0')}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.send(csv);
  }

  @Get('devices')
  @Permissions('attendance.device.manage')
  devices(@CurrentUser() user: AuthUser) {
    return this.attendance.listDevices(user.tenantId);
  }

  @Post('devices')
  @Permissions('attendance.device.manage')
  createDevice(@CurrentUser() user: AuthUser, @Body() dto: DeviceDto) {
    return this.attendance.createDevice(user.tenantId, user.userId, dto);
  }

  @Post('devices/:id/comm-key')
  @Permissions('attendance.device.manage')
  commKey(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CommKeyDto,
  ) {
    return this.attendance.rotateCommKey(user.tenantId, user.userId, id, dto);
  }

  @Post('devices/:id/enrollments')
  @Permissions('attendance.device.manage')
  enroll(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: EnrollmentDto,
  ) {
    return this.attendance.enroll(user.tenantId, user.userId, id, dto);
  }

  @Delete('devices/:id/enrollments/:enrollmentId')
  @Permissions('attendance.device.manage')
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.attendance.revokeEnrollment(user.tenantId, user.userId, id, enrollmentId);
  }
}
