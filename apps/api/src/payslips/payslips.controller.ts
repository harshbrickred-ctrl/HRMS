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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PayslipsService } from './payslips.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { memoryStorage } = require('multer') as {
  memoryStorage: () => unknown;
};

type UploadFile = { originalname: string; buffer: Buffer; size: number };

@Controller('payslips')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PayslipsController {
  constructor(private readonly payslips: PayslipsService) {}

  @Get('me')
  @Permissions('payslip.self')
  mine(@CurrentUser() user: AuthUser) {
    return this.payslips.myPayslips(user.userId);
  }

  @Get('me/:id')
  @Permissions('payslip.self')
  @Header('Content-Type', 'application/pdf')
  async downloadMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const file = await this.payslips.openForUser(user.userId, id);
    return new StreamableFile(file.stream, {
      disposition: `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }

  @Get('employees/:employeeId')
  @Permissions('payslip.manage')
  listEmployee(@CurrentUser() user: AuthUser, @Param('employeeId') employeeId: string) {
    return this.payslips.listForEmployee(user.tenantId, employeeId);
  }

  @Post('employees/:employeeId')
  @Permissions('payslip.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('employeeId') employeeId: string,
    @UploadedFile() file: UploadFile,
    @Body('month') month: string,
    @Body('label') label: string,
  ) {
    return this.payslips.upload(user.tenantId, user.userId, employeeId, month, label ?? '', file);
  }

  @Get('employees/:employeeId/:id')
  @Permissions('payslip.manage')
  @Header('Content-Type', 'application/pdf')
  async downloadHr(
    @CurrentUser() user: AuthUser,
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
  ) {
    const file = await this.payslips.openForHr(user.tenantId, employeeId, id);
    return new StreamableFile(file.stream, {
      disposition: `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    });
  }
}
