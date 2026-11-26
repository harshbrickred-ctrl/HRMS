import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PermissionsService } from '../rbac/permissions.service';
import {
  CreateCycleDto,
  CsvImportDto,
  AssignmentPreviewDto,
  DecisionDto,
  HrReviewDto,
  ManagerReviewDto,
  RevisionDto,
  SaveSelfAppraisalDto,
  SetCycleKpisDto,
} from './dto/appraisal.dto';
import { AppraisalsService } from './appraisals.service';

@Controller('appraisals/me')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('appraisal.self')
export class AppraisalSelfController {
  constructor(private readonly appraisals: AppraisalsService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) { return this.appraisals.mine(user.userId, user.tenantId); }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.appraisals.getMine(user.userId, user.tenantId, id); }

  @Put(':id')
  save(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SaveSelfAppraisalDto) {
    return this.appraisals.saveSelf(user.userId, user.tenantId, id, dto);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.appraisals.submitSelf(user.userId, user.tenantId, id); }
}

@Controller('appraisals/manager')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('appraisal.team.read')
export class AppraisalManagerController {
  constructor(private readonly appraisals: AppraisalsService) {}

  @Get()
  queue(@CurrentUser() user: AuthUser) { return this.appraisals.managerQueue(user.userId, user.tenantId); }

  @Put(':id/review')
  @Permissions('appraisal.manager.review')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ManagerReviewDto) {
    return this.appraisals.managerReview(user.userId, user.tenantId, id, dto);
  }

  @Post(':id/approve')
  @Permissions('appraisal.manager.review')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.appraisals.managerApprove(user.userId, user.tenantId, id, dto);
  }

  @Post(':id/request-revision')
  @Permissions('appraisal.manager.review')
  requestRevision(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RevisionDto) {
    return this.appraisals.managerReturn(user.userId, user.tenantId, id, dto);
  }

  @Post(':id/reject')
  @Permissions('appraisal.manager.review')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.appraisals.rejectManager(user.userId, user.tenantId, id, dto);
  }
}

@Controller('appraisals/hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('appraisal.hr.read')
export class AppraisalHrController {
  constructor(private readonly appraisals: AppraisalsService, private readonly permissions: PermissionsService) {}

  @Get()
  async queue(@CurrentUser() user: AuthUser) {
    const canSeeSensitive = await this.permissions.userHasAllPermissions(user.userId, ['appraisal.compensation.read']);
    return this.appraisals.hrQueue(user.tenantId, canSeeSensitive);
  }

  @Get(':id')
  async detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const canSeeSensitive = await this.permissions.userHasAllPermissions(user.userId, ['appraisal.compensation.read']);
    return this.appraisals.detailForHr(user.tenantId, id, canSeeSensitive);
  }

  @Post(':id/approve')
  @Permissions('appraisal.hr.review')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: HrReviewDto) {
    return this.appraisals.hrApprove(user.userId, user.tenantId, id, dto);
  }

  @Post(':id/request-revision')
  @Permissions('appraisal.hr.review')
  requestRevision(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RevisionDto) {
    return this.appraisals.hrReturn(user.userId, user.tenantId, id, dto);
  }

  @Post(':id/reject')
  @Permissions('appraisal.hr.review')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.appraisals.hrReject(user.userId, user.tenantId, id, dto);
  }
}

@Controller('appraisals/admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('appraisal.admin.read')
export class AppraisalAdminController {
  constructor(private readonly appraisals: AppraisalsService) {}

  @Get()
  queue(@CurrentUser() user: AuthUser) { return this.appraisals.adminQueue(user.tenantId); }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.appraisals.adminDetail(user.tenantId, id); }
}

@Controller('appraisal-cycles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('appraisal.cycle.manage')
export class AppraisalCycleController {
  constructor(private readonly appraisals: AppraisalsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) { return this.appraisals.listCycles(user.tenantId); }

  @Get('assignment-directory')
  assignmentDirectory(@CurrentUser() user: AuthUser) { return this.appraisals.assignmentDirectory(user.tenantId); }

  @Post(':id/assignments/preview')
  previewAssignments(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignmentPreviewDto) { return this.appraisals.previewAssignments(user.tenantId, id, dto); }

  @Post(':id/assignments/confirm')
  confirmAssignments(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignmentPreviewDto) { return this.appraisals.confirmAssignments(user.tenantId, user.userId, id, dto); }

  @Get('imports')
  history(@CurrentUser() user: AuthUser) { return this.appraisals.importHistory(user.tenantId); }

  @Post('imports/preview')
  previewImport(@CurrentUser() user: AuthUser, @Body() dto: CsvImportDto) { return this.appraisals.previewImport(user.tenantId, dto); }

  @Post('imports/confirm')
  confirmImport(@CurrentUser() user: AuthUser, @Body() dto: CsvImportDto) { return this.appraisals.confirmImport(user.tenantId, user.userId, dto); }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCycleDto) {
    return this.appraisals.createCycle(user.tenantId, user.userId, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateCycleDto) {
    return this.appraisals.updateCycle(user.tenantId, id, dto);
  }

  @Put(':id/kpis')
  setKpis(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetCycleKpisDto) {
    return this.appraisals.setCycleKpis(user.tenantId, id, dto);
  }

  @Post(':id/launch')
  launch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.appraisals.launchCycle(user.tenantId, user.userId, id);
  }

  @Post(':id/close')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.appraisals.closeCycle(user.tenantId, user.userId, id);
  }
}

@Controller('appraisals/management')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('appraisal.management.review')
export class AppraisalManagementController {
  constructor(private readonly appraisals: AppraisalsService, private readonly permissions: PermissionsService) {}

  @Get()
  async queue(@CurrentUser() user: AuthUser) {
    const canSeeSensitive = await this.permissions.userHasAllPermissions(user.userId, ['appraisal.compensation.read']);
    return this.appraisals.managementQueue(user.tenantId, canSeeSensitive);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.appraisals.managementDecision(user.userId, user.tenantId, id, true, dto);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.appraisals.managementDecision(user.userId, user.tenantId, id, false, dto);
  }
}

@Controller('appraisal-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AppraisalReportsController {
  constructor(private readonly appraisals: AppraisalsService) {}

  @Get('me')
  @Permissions('appraisal.self')
  me(@CurrentUser() user: AuthUser) { return this.appraisals.summary(user.tenantId, 'employee', user.userId); }

  @Get('manager')
  @Permissions('appraisal.team.read')
  manager(@CurrentUser() user: AuthUser) { return this.appraisals.summary(user.tenantId, 'manager', user.userId); }

  @Get('hr')
  @Permissions('appraisal.hr.read')
  hr(@CurrentUser() user: AuthUser) { return this.appraisals.summary(user.tenantId, 'hr', user.userId); }

  @Get('management')
  @Permissions('appraisal.management.review', 'appraisal.compensation.read')
  management(@CurrentUser() user: AuthUser) { return this.appraisals.summary(user.tenantId, 'management', user.userId); }
}
