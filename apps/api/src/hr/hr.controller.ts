import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import {
  AdjustLeaveDto,
  CreateEmployeeDto,
  CreateTeamDto,
  NameDto,
  UpdateEmployeeDto,
  UpdateLeaveBalancesDto,
  UpdateTeamDto,
} from './dto/hr.dto';
import { HrService } from './hr.service';

type UploadFile = {
  originalname: string;
  buffer: Buffer;
  size: number;
};

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('hr.manage')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('org')
  org(@CurrentUser() user: AuthUser) {
    return this.hr.org(user.tenantId);
  }

  @Get('roles')
  roles(@CurrentUser() user: AuthUser) {
    return this.hr.listRoles(user.tenantId);
  }

  @Post('departments')
  createDepartment(@CurrentUser() user: AuthUser, @Body() dto: NameDto) {
    return this.hr.createDepartment(user.tenantId, dto);
  }

  @Patch('departments/:id')
  renameDepartment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: NameDto,
  ) {
    return this.hr.renameDepartment(user.tenantId, id, dto);
  }

  @Delete('departments/:id')
  deleteDepartment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hr.deleteDepartment(user.tenantId, id);
  }

  @Post('locations')
  createLocation(@CurrentUser() user: AuthUser, @Body() dto: NameDto) {
    return this.hr.createLocation(user.tenantId, dto);
  }

  @Patch('locations/:id')
  renameLocation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: NameDto,
  ) {
    return this.hr.renameLocation(user.tenantId, id, dto);
  }

  @Delete('locations/:id')
  deleteLocation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hr.deleteLocation(user.tenantId, id);
  }

  @Post('teams')
  createTeam(@CurrentUser() user: AuthUser, @Body() dto: CreateTeamDto) {
    return this.hr.createTeam(user.tenantId, dto);
  }

  @Patch('teams/:id')
  updateTeam(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.hr.updateTeam(user.tenantId, id, dto);
  }

  @Delete('teams/:id')
  deleteTeam(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hr.deleteTeam(user.tenantId, id);
  }

  @Get('employees')
  employees(@CurrentUser() user: AuthUser) {
    return this.hr.listEmployees(user.tenantId);
  }

  @Get('employees/:id')
  employee(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hr.getEmployee(user.tenantId, id);
  }

  @Post('employees')
  createEmployee(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.hr.createEmployee(user.tenantId, user.userId, dto);
  }

  @Patch('employees/:id')
  updateEmployee(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.hr.updateEmployee(user.tenantId, user.userId, id, dto);
  }

  @Put('employees/:id/leave-balances')
  updateLeave(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveBalancesDto,
  ) {
    return this.hr.updateLeaveBalances(user.tenantId, id, dto);
  }

  @Post('employees/:id/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: UploadFile,
    @Body('category') category: string,
  ) {
    return this.hr.addDocument(user.tenantId, id, file, category ?? '');
  }

  @Delete('employees/:id/documents/:documentId')
  removeDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.hr.deleteDocument(user.tenantId, id, documentId);
  }

  @Get('employees/:id/documents/:documentId')
  @Header('Content-Type', 'application/octet-stream')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    const file = await this.hr.openDocument(user.tenantId, id, documentId);
    return new StreamableFile(file.stream, {
      disposition: `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }
}

@Controller('hr/me')
@UseGuards(JwtAuthGuard)
export class HrSelfController {
  constructor(private readonly hr: HrService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.hr.me(user.userId);
  }

  @Get('directory')
  directory(@CurrentUser() user: AuthUser) {
    return this.hr.directory(user.tenantId);
  }

  @Post('leave')
  leave(@CurrentUser() user: AuthUser, @Body() dto: AdjustLeaveDto) {
    return this.hr.adjustMyLeave(user.userId, dto);
  }

  @Get('documents/:documentId')
  @Header('Content-Type', 'application/octet-stream')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
  ) {
    const file = await this.hr.openMyDocument(user.userId, documentId);
    return new StreamableFile(file.stream, {
      disposition: `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }
}
