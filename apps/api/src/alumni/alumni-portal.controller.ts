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
import { Throttle } from '@nestjs/throttler';
import {
  AlumniAuthGuard,
  ClientMeta,
  CurrentAlumni,
} from './alumni-auth.guard';
import {
  AlumniAuthService,
  type AlumniPrincipal,
  type RequestMeta,
} from './alumni-auth.service';
import { AlumniCareersService } from './alumni-careers.service';
import { AlumniDocumentsService } from './alumni-documents.service';
import { AlumniEngagementService } from './alumni-engagement.service';
import { AlumniProfileService } from './alumni-profile.service';
import {
  type AlumniUpload,
  PHOTO_UPLOAD,
  RESUME_UPLOAD,
  attachment,
} from './alumni-support.service';
import {
  AlumniChangePasswordDto,
  AlumniProfileDto,
  ApplyDto,
  ConsentDto,
  DirectoryQueryDto,
  DocumentRequestDto,
  EmailChangeConfirmDto,
  EmailChangeRequestDto,
  ReferralDto,
  RsvpDto,
} from './dto/alumni-portal.dto';

/**
 * Everything a signed-in alumnus can do. Only AlumniAuthGuard protects these
 * routes and every query is scoped to the alumnus in the token; employee,
 * salary, payroll and asset APIs stay behind JwtAuthGuard, which rejects
 * alumni tokens.
 */
@Controller('alumni/portal')
@UseGuards(AlumniAuthGuard)
export class AlumniPortalController {
  constructor(
    private readonly auth: AlumniAuthService,
    private readonly profile: AlumniProfileService,
    private readonly documents: AlumniDocumentsService,
    private readonly engagement: AlumniEngagementService,
    private readonly careers: AlumniCareersService,
  ) {}

  @Get('me')
  me(@CurrentAlumni() alumni: AlumniPrincipal) {
    return this.profile.me(alumni);
  }

  @Patch('profile')
  updateProfile(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Body() dto: AlumniProfileDto,
  ) {
    return this.profile.updateProfile(alumni, dto);
  }

  @Post('profile/photo')
  @UseInterceptors(FileInterceptor('file', PHOTO_UPLOAD))
  uploadPhoto(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @UploadedFile() file: AlumniUpload,
  ) {
    return this.profile.savePhoto(alumni, file);
  }

  @Delete('profile/photo')
  removePhoto(@CurrentAlumni() alumni: AlumniPrincipal) {
    return this.profile.removePhoto(alumni);
  }

  @Get('photos/:alumniId')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, max-age=300')
  async photo(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Param('alumniId') alumniId: string,
  ) {
    const file = await this.profile.openPhoto(alumni, alumniId);
    return new StreamableFile(file.stream, { type: file.contentType });
  }

  @Get('consents')
  consents(@CurrentAlumni() alumni: AlumniPrincipal) {
    return this.profile.consents(alumni);
  }

  @Post('consents')
  @HttpCode(200)
  setConsent(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Body() dto: ConsentDto,
    @ClientMeta() meta: RequestMeta,
  ) {
    return this.profile.setConsent(alumni, dto, meta);
  }

  @Post('password/change')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Body() dto: AlumniChangePasswordDto,
  ) {
    return this.auth.changePassword(alumni, dto);
  }

  @Post('email-change/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  requestEmailChange(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Body() dto: EmailChangeRequestDto,
  ) {
    return this.auth.requestEmailChange(alumni, dto);
  }

  @Post('email-change/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  confirmEmailChange(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Body() dto: EmailChangeConfirmDto,
  ) {
    return this.auth.confirmEmailChange(alumni, dto);
  }

  @Get('directory')
  directory(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Query() query: DirectoryQueryDto,
  ) {
    return this.profile.directory(alumni, query);
  }

  @Get('documents')
  myDocuments(@CurrentAlumni() alumni: AlumniPrincipal) {
    return this.documents.mine(alumni);
  }

  @Get('documents/:id/download')
  @Header('X-Content-Type-Options', 'nosniff')
  async download(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Param('id') id: string,
  ) {
    const file = await this.documents.openMine(alumni, id);
    return new StreamableFile(file.stream, {
      type: 'application/octet-stream',
      disposition: attachment(file.fileName),
    });
  }

  @Get('document-requests')
  myRequests(@CurrentAlumni() alumni: AlumniPrincipal) {
    return this.documents.myRequests(alumni);
  }

  @Post('document-requests')
  createRequest(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Body() dto: DocumentRequestDto,
  ) {
    return this.documents.createRequest(alumni, dto);
  }

  @Post('document-requests/:id/cancel')
  @HttpCode(200)
  cancelRequest(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Param('id') id: string,
  ) {
    return this.documents.cancelRequest(alumni, id);
  }

  @Get('announcements')
  announcements(@CurrentAlumni() alumni: AlumniPrincipal) {
    return this.engagement.announcementsFor(alumni);
  }

  @Get('events')
  events(@CurrentAlumni() alumni: AlumniPrincipal) {
    return this.engagement.eventsFor(alumni);
  }

  @Post('events/:id/rsvp')
  @HttpCode(200)
  rsvp(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Param('id') id: string,
    @Body() dto: RsvpDto,
  ) {
    return this.engagement.rsvp(alumni, id, dto);
  }

  @Get('jobs')
  jobs(@CurrentAlumni() alumni: AlumniPrincipal) {
    return this.careers.openJobs(alumni);
  }

  @Post('jobs/:id/apply')
  apply(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Param('id') id: string,
    @Body() dto: ApplyDto,
  ) {
    return this.careers.apply(alumni, id, dto);
  }

  @Get('applications')
  applications(@CurrentAlumni() alumni: AlumniPrincipal) {
    return this.careers.myApplications(alumni);
  }

  @Post('applications/:id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentAlumni() alumni: AlumniPrincipal, @Param('id') id: string) {
    return this.careers.withdraw(alumni, id);
  }

  @Get('referrals')
  referrals(@CurrentAlumni() alumni: AlumniPrincipal) {
    return this.careers.myReferrals(alumni);
  }

  @Post('referrals')
  @UseInterceptors(FileInterceptor('file', RESUME_UPLOAD))
  refer(
    @CurrentAlumni() alumni: AlumniPrincipal,
    @Body() dto: ReferralDto,
    @UploadedFile() file?: AlumniUpload,
  ) {
    return this.careers.refer(alumni, dto, file);
  }
}
