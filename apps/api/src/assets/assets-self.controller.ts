import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AssetRequestsService } from './asset-requests.service';
import { AssetSelfService } from './asset-self.service';
import { MAX_ATTACHMENTS, UPLOAD_LIMITS, type AssetUpload } from './asset-support.service';
import {
  CreateAssetRequestDto,
  CreateAssetTicketDto,
  FaultReportDto,
  LossReportDto,
  RequestDecisionDto,
  ReturnRequestDto,
  SignedFormDto,
} from './dto/assets.dto';

function inline(file: { stream: NodeJS.ReadableStream; fileName: string; contentType: string }) {
  return new StreamableFile(file.stream as never, {
    type: file.contentType,
    disposition: `inline; filename="${file.fileName.replace(/"/g, '')}"`,
  });
}

/** Employee portal. No route takes an employee id: it always comes from the login. */
@Controller('assets/me')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('assets.self')
export class AssetsSelfController {
  constructor(
    private readonly self: AssetSelfService,
    private readonly requests: AssetRequestsService,
  ) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.self.myAssets(user.userId);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser) {
    return this.self.history(user.userId);
  }

  @Get('allocations/:id')
  asset(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.self.myAsset(user.userId, id);
  }

  @Get('allocations/:id/photo')
  async photo(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return inline(await this.self.myAssetPhoto(user.userId, id));
  }

  @Post('allocations/:id/acknowledge')
  acknowledge(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.self.acknowledge(user.userId, id);
  }

  @Post('allocations/:id/signed-form')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  signedForm(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SignedFormDto,
    @UploadedFile() file: AssetUpload,
  ) {
    return this.self.uploadSignedForm(user.userId, id, dto, file);
  }

  @Post('allocations/:id/return-request')
  requestReturn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReturnRequestDto) {
    return this.self.requestReturn(user.userId, id, dto);
  }

  @Post('handovers/:id/acknowledge')
  acknowledgeHandover(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.self.acknowledgeHandover(user.userId, id);
  }

  @Get('requests')
  myRequests(@CurrentUser() user: AuthUser) {
    return this.requests.mine(user.userId);
  }

  @Post('requests')
  createRequest(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetRequestDto) {
    return this.requests.create(user.userId, dto);
  }

  @Post('requests/:id/cancel')
  cancelRequest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.requests.cancel(user.userId, id);
  }

  @Get('approvals')
  approvals(@CurrentUser() user: AuthUser) {
    return this.requests.toApprove(user.userId);
  }

  @Post('approvals/:id')
  decide(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RequestDecisionDto) {
    return this.requests.decideAsApprover(user.userId, id, dto);
  }

  @Get('tickets')
  tickets(@CurrentUser() user: AuthUser) {
    return this.self.myTickets(user.userId);
  }

  @Post('tickets')
  createTicket(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetTicketDto) {
    return this.self.createTicket(user.userId, dto);
  }

  @Get('tickets/:id')
  ticket(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.self.myTicket(user.userId, id);
  }

  @Get('tickets/:id/files/:fileId')
  async ticketFile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('fileId') fileId: string) {
    return inline(await this.self.openMyTicketFile(user.userId, id, fileId));
  }

  @Post('fault-reports')
  @UseInterceptors(FilesInterceptor('files', MAX_ATTACHMENTS, UPLOAD_LIMITS))
  reportFault(
    @CurrentUser() user: AuthUser,
    @Body() dto: FaultReportDto,
    @UploadedFiles() files?: AssetUpload[],
  ) {
    return this.self.reportFault(user.userId, dto, files);
  }

  @Post('loss-reports')
  @UseInterceptors(FilesInterceptor('files', MAX_ATTACHMENTS, UPLOAD_LIMITS))
  reportLoss(
    @CurrentUser() user: AuthUser,
    @Body() dto: LossReportDto,
    @UploadedFiles() files?: AssetUpload[],
  ) {
    return this.self.reportLoss(user.userId, dto, files);
  }
}
