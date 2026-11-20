import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
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
import {
  SaveTaxDeclarationDto,
  SubmitTaxDeclarationDto,
  TaxDecisionDto,
  TaxRegimeChangeDto,
} from './tax.dto';
import { TaxService } from './tax.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { memoryStorage } = require('multer') as { memoryStorage: () => unknown };

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Controller('tax')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Get('me/summary')
  @Permissions('tax.self')
  summary(@CurrentUser() user: AuthUser, @Query('fy') fy?: string) {
    return this.tax.summary(user, fy);
  }

  @Get('me/declaration')
  @Permissions('tax.self')
  getDeclaration(@CurrentUser() user: AuthUser, @Query('fy') fy?: string) {
    return this.tax.getMyDeclaration(user, fy);
  }

  @Put('me/declaration')
  @Permissions('tax.self')
  saveDeclaration(@CurrentUser() user: AuthUser, @Body() dto: SaveTaxDeclarationDto) {
    return this.tax.saveDeclaration(user, dto);
  }

  @Post('me/declaration/submit')
  @Permissions('tax.self')
  submitDeclaration(@CurrentUser() user: AuthUser, @Body() dto: SubmitTaxDeclarationDto) {
    return this.tax.submitDeclaration(user, dto.fy);
  }

  @Get('me/proofs')
  @Permissions('tax.self')
  listProofs(@CurrentUser() user: AuthUser, @Query('fy') fy?: string) {
    return this.tax.listMyProofs(user, fy);
  }

  @Post('me/proofs')
  @Permissions('tax.self')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadProof(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadFile,
    @Body() body: { fy: string; section: string; label: string; amount: string },
  ) {
    return this.tax.uploadProof(user, body, file);
  }

  @Delete('me/proofs/:id')
  @Permissions('tax.self')
  deleteProof(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tax.deleteProof(user, id);
  }

  @Get('me/proofs/:id/file')
  @Permissions('tax.self')
  @Header('Content-Type', 'application/octet-stream')
  async proofFileSelf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const file = await this.tax.proofFile(user, id);
    return new StreamableFile(file.bytes, {
      type: file.type,
      disposition: `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }

  @Post('me/regime-change')
  @Permissions('tax.self')
  requestRegime(@CurrentUser() user: AuthUser, @Body() dto: TaxRegimeChangeDto) {
    return this.tax.requestRegimeChange(user, dto);
  }

  @Post('me/regime-change/:id/withdraw')
  @Permissions('tax.self')
  withdrawRegime(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tax.withdrawRegimeChange(user, id);
  }

  @Get('company')
  @Permissions('tax.manage')
  company(@CurrentUser() user: AuthUser) {
    return this.tax.companyQueue(user);
  }

  @Post('company/declarations/:id/decision')
  @Permissions('tax.manage')
  decideDeclaration(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TaxDecisionDto) {
    return this.tax.decideDeclaration(user, id, dto);
  }

  @Post('company/proofs/:id/decision')
  @Permissions('tax.manage')
  decideProof(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TaxDecisionDto) {
    return this.tax.decideProof(user, id, dto);
  }

  @Get('company/proofs/:id/file')
  @Permissions('tax.manage')
  @Header('Content-Type', 'application/octet-stream')
  async proofFileHr(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const file = await this.tax.proofFile(user, id);
    return new StreamableFile(file.bytes, {
      type: file.type,
      disposition: `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }

  @Post('company/regime-change/:id/decision')
  @Permissions('tax.manage')
  decideRegime(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TaxDecisionDto) {
    return this.tax.decideRegime(user, id, dto);
  }
}
