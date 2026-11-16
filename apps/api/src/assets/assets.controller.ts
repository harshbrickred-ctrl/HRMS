import {
  Body,
  Controller,
  Delete,
  Get,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AssetSheetService } from './asset-sheet.service';
import { UPLOAD_LIMITS, type AssetUpload } from './asset-support.service';
import { AssetsService } from './assets.service';
import {
  CreateAssetDto,
  ImportAssetSheetDto,
  UpdateAssetDto,
  UpdateAssetTicketDto,
} from './dto/assets.dto';

@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly sheets: AssetSheetService,
  ) {}

  @Get('tickets')
  @Permissions('assets.tickets.manage')
  tickets(@CurrentUser() user: AuthUser) {
    return this.assets.tickets(user.tenantId);
  }

  @Patch('tickets/:id/status')
  @Permissions('assets.tickets.manage')
  ticketStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAssetTicketDto,
  ) {
    return this.assets.updateTicket(user.tenantId, user.userId, id, dto);
  }

  @Get('tickets/:id/files/:fileId')
  @Permissions('assets.tickets.manage')
  async ticketFile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('fileId') fileId: string) {
    const file = await this.assets.openTicketFile(user.tenantId, id, fileId);
    return new StreamableFile(file.stream, {
      type: file.contentType,
      disposition: `inline; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }

  @Get('people')
  @Permissions('assets.manage')
  people(@CurrentUser() user: AuthUser) {
    return this.assets.people(user.tenantId);
  }

  @Get('locations')
  @Permissions('assets.manage')
  locations(@CurrentUser() user: AuthUser) {
    return this.assets.locations(user.tenantId);
  }

  @Get()
  @Permissions('assets.manage')
  list(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('locationId') locationId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('view') view?: string,
  ) {
    return this.assets.list(user.tenantId, user.userId, { q, status, categoryId, locationId, departmentId, view });
  }

  @Get('summary')
  @Permissions('assets.manage')
  summary(@CurrentUser() user: AuthUser) {
    return this.assets.summary(user.tenantId, user.userId);
  }

  /** The register in the IT team's Excel sheet layout, with the same filters as the list. */
  @Get('sheet')
  @Permissions('assets.manage')
  sheet(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('locationId') locationId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('view') view?: string,
  ) {
    return this.sheets.exportRows(user.tenantId, user.userId, { q, status, categoryId, locationId, departmentId, view });
  }

  @Post('sheet')
  @Permissions('assets.manage')
  importSheet(@CurrentUser() user: AuthUser, @Body() dto: ImportAssetSheetDto) {
    return this.sheets.importRows(user.tenantId, user.userId, dto);
  }

  @Post()
  @Permissions('assets.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetDto) {
    return this.assets.create(user.tenantId, user.userId, dto);
  }

  @Get(':id')
  @Permissions('assets.manage')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assets.detail(user.tenantId, id);
  }

  @Patch(':id')
  @Permissions('assets.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assets.update(user.tenantId, user.userId, id, dto);
  }

  @Delete(':id')
  @Permissions('assets.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assets.remove(user.tenantId, user.userId, id);
  }

  @Post(':id/photo')
  @Permissions('assets.manage')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  uploadPhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: AssetUpload,
  ) {
    return this.assets.setPhoto(user.tenantId, user.userId, id, file);
  }

  @Get(':id/photo')
  @Permissions('assets.manage')
  async photo(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const file = await this.assets.openPhoto(user.tenantId, id);
    return new StreamableFile(file.stream, {
      type: file.contentType,
      disposition: `inline; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }
}
