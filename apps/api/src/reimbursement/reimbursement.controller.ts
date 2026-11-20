import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { ReimbursementService } from './reimbursement.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { memoryStorage } = require('multer') as { memoryStorage: () => unknown };

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

class CreateReimbursementDto {
  @IsString()
  expenseDate!: string;

  @IsString()
  days!: string;

  @IsString()
  amount!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class DecideReimbursementDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}

@Controller('reimbursements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReimbursementController {
  constructor(private readonly reimbursements: ReimbursementService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.reimbursements.list(user);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  create(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadFile,
    @Body() body: CreateReimbursementDto,
  ) {
    return this.reimbursements.create(user, body, file);
  }

  @Post(':id/decision')
  decide(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecideReimbursementDto) {
    return this.reimbursements.decide(user, id, dto.status);
  }

  @Get(':id/receipt')
  @Header('Content-Type', 'application/octet-stream')
  async receipt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const file = await this.reimbursements.receipt(user, id);
    return new StreamableFile(file.bytes, {
      type: file.type,
      disposition: `inline; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }
}
