import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AlumniCareersService } from './alumni-careers.service';
import { AlumniEngagementService } from './alumni-engagement.service';
import { attachment } from './alumni-support.service';
import {
  AnnouncementDto,
  ApplicationListQueryDto,
  ApplicationStatusDto,
  CancelDto,
  CompleteRehireDto,
  EventDto,
  JobDto,
  JobStatusDto,
  ReferralListQueryDto,
  StartRehireDto,
  UpdateAnnouncementDto,
  UpdateEventDto,
  UpdateJobDto,
  UpdateReferralDto,
} from './dto/alumni-admin.dto';

/** HR: announcements, events, job board, rehire and referrals. Reuses hr.manage. */
@Controller('alumni/admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('hr.manage')
export class AlumniProgramsController {
  constructor(
    private readonly engagement: AlumniEngagementService,
    private readonly careers: AlumniCareersService,
  ) {}

  @Get('announcements')
  announcements(@CurrentUser() user: AuthUser) {
    return this.engagement.listAnnouncements(user.tenantId);
  }

  @Post('announcements')
  createAnnouncement(
    @CurrentUser() user: AuthUser,
    @Body() dto: AnnouncementDto,
  ) {
    return this.engagement.createAnnouncement(user.tenantId, user.userId, dto);
  }

  @Patch('announcements/:id')
  updateAnnouncement(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.engagement.updateAnnouncement(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  @Post('announcements/:id/publish')
  @HttpCode(200)
  publishAnnouncement(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.engagement.publishAnnouncement(user.tenantId, user.userId, id);
  }

  @Post('announcements/:id/archive')
  @HttpCode(200)
  archiveAnnouncement(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.engagement.archiveAnnouncement(user.tenantId, user.userId, id);
  }

  @Get('events')
  events(@CurrentUser() user: AuthUser) {
    return this.engagement.listEvents(user.tenantId);
  }

  @Post('events')
  createEvent(@CurrentUser() user: AuthUser, @Body() dto: EventDto) {
    return this.engagement.createEvent(user.tenantId, user.userId, dto);
  }

  @Patch('events/:id')
  updateEvent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.engagement.updateEvent(user.tenantId, user.userId, id, dto);
  }

  @Post('events/:id/publish')
  @HttpCode(200)
  publishEvent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.engagement.publishEvent(user.tenantId, user.userId, id);
  }

  @Post('events/:id/cancel')
  @HttpCode(200)
  cancelEvent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.engagement.cancelEvent(user.tenantId, user.userId, id);
  }

  @Get('events/:id/rsvps')
  rsvps(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.engagement.eventRsvps(user.tenantId, id);
  }

  @Get('jobs')
  jobs(@CurrentUser() user: AuthUser) {
    return this.careers.listJobs(user.tenantId);
  }

  @Post('jobs')
  createJob(@CurrentUser() user: AuthUser, @Body() dto: JobDto) {
    return this.careers.createJob(user.tenantId, user.userId, dto);
  }

  @Patch('jobs/:id')
  updateJob(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.careers.updateJob(user.tenantId, user.userId, id, dto);
  }

  @Post('jobs/:id/status')
  @HttpCode(200)
  jobStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: JobStatusDto,
  ) {
    return this.careers.setJobStatus(
      user.tenantId,
      user.userId,
      id,
      dto.status,
    );
  }

  @Get('applications')
  applications(
    @CurrentUser() user: AuthUser,
    @Query() query: ApplicationListQueryDto,
  ) {
    return this.careers.listApplications(user.tenantId, query);
  }

  @Patch('applications/:id/status')
  applicationStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApplicationStatusDto,
  ) {
    return this.careers.setApplicationStatus(
      user.tenantId,
      user.userId,
      id,
      dto,
    );
  }

  @Post('applications/:id/rehire')
  startRehire(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: StartRehireDto,
  ) {
    return this.careers.startRehire(user.tenantId, user.userId, id, dto);
  }

  @Get('rehires')
  rehires(@CurrentUser() user: AuthUser) {
    return this.careers.listRehires(user.tenantId);
  }

  @Post('rehires/:id/complete')
  @HttpCode(200)
  completeRehire(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompleteRehireDto,
  ) {
    return this.careers.completeRehire(user.tenantId, user.userId, id, dto);
  }

  @Post('rehires/:id/cancel')
  @HttpCode(200)
  cancelRehire(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelDto,
  ) {
    return this.careers.cancelRehire(
      user.tenantId,
      user.userId,
      id,
      dto.note?.trim() ?? '',
    );
  }

  @Get('referrals')
  referrals(
    @CurrentUser() user: AuthUser,
    @Query() query: ReferralListQueryDto,
  ) {
    return this.careers.listReferrals(user.tenantId, query.status);
  }

  @Patch('referrals/:id')
  updateReferral(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReferralDto,
  ) {
    return this.careers.updateReferral(user.tenantId, user.userId, id, dto);
  }

  @Get('referrals/:id/resume')
  @Header('X-Content-Type-Options', 'nosniff')
  async resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const file = await this.careers.openResumeForHr(user.tenantId, id);
    return new StreamableFile(file.stream, {
      type: 'application/octet-stream',
      disposition: attachment(file.fileName),
    });
  }
}
