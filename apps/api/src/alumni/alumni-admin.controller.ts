import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AlumniDocumentsService } from './alumni-documents.service';
import { AlumniInvitationsService } from './alumni-invitations.service';
import { AlumniRecordsService } from './alumni-records.service';
import {
  type AlumniUpload,
  DOCUMENT_UPLOAD,
  attachment,
} from './alumni-support.service';
import {
  AlumniListQueryDto,
  CreateExitClosureDto,
  EligibilityDto,
  InviteManyDto,
  IssueRequestDto,
  RequestDecisionDto,
  RequestListQueryDto,
  UpdateAlumniRecordDto,
  UpdateExitClosureDto,
  UploadAlumniDocumentDto,
} from './dto/alumni-admin.dto';

/** HR: exit closures, alumni records, eligibility, invitations and documents. Reuses hr.manage. */
@Controller('alumni/admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('hr.manage')
export class AlumniAdminController {
  constructor(
    private readonly records: AlumniRecordsService,
    private readonly invitations: AlumniInvitationsService,
    private readonly documents: AlumniDocumentsService,
  ) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.records.overview(user.tenantId);
  }

  @Get('exit-closures')
  closures(@CurrentUser() user: AuthUser) {
    return this.records.listClosures(user.tenantId);
  }

  @Post('exit-closures')
  createClosure(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateExitClosureDto,
  ) {
    return this.records.createClosure(user.tenantId, user.userId, dto);
  }

  @Patch('exit-closures/:id')
  updateClosure(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateExitClosureDto,
  ) {
    return this.records.updateClosure(user.tenantId, user.userId, id, dto);
  }

  @Get('records')
  list(@CurrentUser() user: AuthUser, @Query() query: AlumniListQueryDto) {
    return this.records.list(user.tenantId, query);
  }

  @Get('records/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.records.detail(user.tenantId, id);
  }

  @Patch('records/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAlumniRecordDto,
  ) {
    return this.records.updateRecord(user.tenantId, user.userId, id, dto);
  }

  @Patch('records/:id/eligibility')
  eligibility(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: EligibilityDto,
  ) {
    return this.records.updateEligibility(user.tenantId, user.userId, id, dto);
  }

  @Post('records/:id/invitation')
  @HttpCode(200)
  invite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitations.send(user.tenantId, user.userId, id);
  }

  @Delete('records/:id/invitation')
  revokeInvite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitations.revoke(user.tenantId, user.userId, id);
  }

  @Post('invitations')
  @HttpCode(200)
  inviteMany(@CurrentUser() user: AuthUser, @Body() dto: InviteManyDto) {
    return this.invitations.sendMany(user.tenantId, user.userId, dto.alumniIds);
  }

  @Get('records/:id/documents')
  documentsFor(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documents.listForAlumni(user.tenantId, id);
  }

  @Post('records/:id/documents')
  @UseInterceptors(FileInterceptor('file', DOCUMENT_UPLOAD))
  uploadDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UploadAlumniDocumentDto,
    @UploadedFile() file: AlumniUpload,
  ) {
    return this.documents.upload(user.tenantId, user.userId, id, dto, file);
  }

  @Delete('records/:id/documents/:documentId')
  revokeDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.revoke(user.tenantId, user.userId, id, documentId);
  }

  @Get('records/:id/documents/:documentId/download')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    const file = await this.documents.openForHr(user.tenantId, id, documentId);
    return new StreamableFile(file.stream, {
      type: 'application/octet-stream',
      disposition: attachment(file.fileName),
    });
  }

  @Get('document-requests')
  requests(@CurrentUser() user: AuthUser, @Query() query: RequestListQueryDto) {
    return this.documents.listRequests(user.tenantId, query.status);
  }

  @Post('document-requests/:id/review')
  @HttpCode(200)
  review(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documents.review(user.tenantId, user.userId, id);
  }

  @Post('document-requests/:id/decision')
  @HttpCode(200)
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RequestDecisionDto,
  ) {
    return this.documents.decide(user.tenantId, user.userId, id, dto);
  }

  @Post('document-requests/:id/issue')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', DOCUMENT_UPLOAD))
  issue(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: IssueRequestDto,
    @UploadedFile() file: AlumniUpload,
  ) {
    return this.documents.issue(user.tenantId, user.userId, id, dto, file);
  }
}
