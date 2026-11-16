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
import { AssetAllocationsService } from './asset-allocations.service';
import { MAX_ATTACHMENTS, UPLOAD_LIMITS, type AssetUpload } from './asset-support.service';
import {
  AllocateAssetDto,
  ChangeAssetStatusDto,
  ReturnAssetDto,
  SignedFormDto,
  TransferAssetDto,
} from './dto/assets.dto';

/** Allocation, return, transfer, and lifecycle. All of it is asset-admin only. */
@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('assets.manage')
export class AssetAllocationsController {
  constructor(private readonly allocations: AssetAllocationsService) {}

  @Get('employees/:employeeId/allocations')
  employeeAllocations(@CurrentUser() user: AuthUser, @Param('employeeId') employeeId: string) {
    return this.allocations.employeeAllocations(user.tenantId, employeeId);
  }

  @Post('allocations/:id/files')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  uploadForm(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SignedFormDto,
    @UploadedFile() file: AssetUpload,
  ) {
    return this.allocations.recordSignedForm(user.tenantId, user.userId, id, dto, file);
  }

  @Get('allocations/:id/files/:fileId')
  async file(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('fileId') fileId: string) {
    const file = await this.allocations.openFile(user.tenantId, id, fileId);
    return new StreamableFile(file.stream, {
      type: file.contentType,
      disposition: `inline; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }

  @Post(':id/assign')
  allocate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AllocateAssetDto) {
    return this.allocations.allocate(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/return')
  @UseInterceptors(FilesInterceptor('photos', MAX_ATTACHMENTS, UPLOAD_LIMITS))
  returnAsset(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReturnAssetDto,
    @UploadedFiles() photos?: AssetUpload[],
  ) {
    return this.allocations.returnAsset(user.tenantId, user.userId, id, dto, photos);
  }

  @Post(':id/transfer')
  transfer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TransferAssetDto) {
    return this.allocations.transfer(user.tenantId, user.userId, id, dto);
  }

  @Post(':id/status')
  changeStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ChangeAssetStatusDto) {
    return this.allocations.changeStatus(user.tenantId, user.userId, id, dto);
  }

  @Get(':id/allocations')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.allocations.allocations(user.tenantId, id);
  }

  @Get(':id/history')
  history(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.allocations.history(user.tenantId, id);
  }

  @Get(':id/status-history')
  statusHistory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.allocations.statusHistory(user.tenantId, id);
  }
}
