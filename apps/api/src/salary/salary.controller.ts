import { Body, Controller, Get, Header, Param, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { BankTransferService } from './bank-transfer.service';
import { AuthoriseTransferDto, BankFileDto, CreateTransferBatchDto, LockMonthDto, MonthDto, ReconcilePayoutDto, RetryPayoutDto, SaveMonthDto, SaveStructureDto, TransferOtpDto, UploadSalaryDto } from './dto/salary.dto';
import { SalaryService } from './salary.service';

@Controller('salary')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalaryController {
  constructor(
    private readonly salary: SalaryService,
    private readonly transfers: BankTransferService,
  ) {}

  @Get('me')
  @Permissions('payslip.self')
  mine(@CurrentUser() user: AuthUser) {
    return this.salary.mine(user.userId);
  }

  @Get('me/payslip/:month')
  @Permissions('payslip.self')
  @Header('Content-Type', 'application/pdf')
  async downloadMine(@CurrentUser() user: AuthUser, @Param('month') month: string) {
    const file = await this.salary.payslipPdf(user.userId, month);
    return new StreamableFile(file.bytes, {
      type: 'application/pdf',
      disposition: `attachment; filename="${file.fileName}"`,
    });
  }

  @Get('month')
  @Permissions('salary.manage')
  list(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '')) {
      month = currentMonth();
    }
    return this.salary.list(user.tenantId, month);
  }

  @Put('structures/:employeeId')
  @Permissions('salary.manage')
  saveStructure(
    @CurrentUser() user: AuthUser,
    @Param('employeeId') employeeId: string,
    @Body() dto: SaveStructureDto,
  ) {
    return this.salary.saveStructure(user.tenantId, employeeId, dto);
  }

  @Put('employees/:employeeId/month')
  @Permissions('salary.manage')
  saveMonth(
    @CurrentUser() user: AuthUser,
    @Param('employeeId') employeeId: string,
    @Body() dto: SaveMonthDto,
  ) {
    return this.salary.saveMonth(user.tenantId, employeeId, dto);
  }

  @Post('generate')
  @Permissions('salary.manage')
  generate(@CurrentUser() user: AuthUser, @Body() dto: MonthDto) {
    return this.salary.generate(user.tenantId, dto.month);
  }

  @Post('approve')
  @Permissions('salary.manage')
  approve(@CurrentUser() user: AuthUser, @Body() dto: MonthDto) {
    return this.salary.approvePayroll(user.tenantId, user, dto.month);
  }

  @Get('payout')
  @Permissions('salary.manage')
  payout(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '')) {
      month = currentMonth();
    }
    return this.salary.payout(user.tenantId, month);
  }

  @Post('payout/file')
  @Permissions('salary.manage')
  bankFile(@CurrentUser() user: AuthUser, @Body() dto: BankFileDto) {
    return this.salary.bankFile(user.tenantId, dto);
  }

  @Post('payout/reconcile')
  @Permissions('salary.manage')
  reconcile(@CurrentUser() user: AuthUser, @Body() dto: ReconcilePayoutDto) {
    return this.salary.reconcile(user.tenantId, dto);
  }

  @Post('payout/retry')
  @Permissions('salary.manage')
  retry(@CurrentUser() user: AuthUser, @Body() dto: RetryPayoutDto) {
    return this.salary.retryPayout(user.tenantId, dto);
  }

  @Get('payout/direct')
  @Permissions('salary.manage')
  direct(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    return this.transfers.overview(user, payrollMonth(month));
  }

  @Post('payout/direct/register')
  @Permissions('salary.manage')
  registerBank(@CurrentUser() user: AuthUser) {
    return this.transfers.register(user);
  }

  @Post('payout/direct/batches')
  @Permissions('salary.manage')
  createTransfer(@CurrentUser() user: AuthUser, @Body() dto: CreateTransferBatchDto) {
    return this.transfers.createBatch(user, dto.month, dto.employeeIds);
  }

  @Post('payout/direct/batches/:id/cancel')
  @Permissions('salary.manage')
  cancelTransfer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.transfers.cancel(user, id);
  }

  @Post('payout/direct/batches/:id/otp')
  @Permissions('salary.manage')
  transferOtp(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.transfers.issueOtp(user, id);
  }

  @Post('payout/direct/batches/:id/verify')
  @Permissions('salary.manage')
  verifyTransfer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TransferOtpDto) {
    return this.transfers.verifyOtp(user, id, dto.otp);
  }

  @Post('payout/direct/batches/:id/authorise')
  @Permissions('salary.manage')
  authoriseTransfer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AuthoriseTransferDto) {
    return this.transfers.authorise(user, id, dto);
  }

  @Post('payout/direct/batches/:id/sync')
  @Permissions('salary.manage')
  syncTransfer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.transfers.sync(user, id);
  }

  @Post('lock')
  @Permissions('salary.manage')
  lock(@CurrentUser() user: AuthUser, @Body() dto: LockMonthDto) {
    return this.salary.setLocked(user.tenantId, dto.month, dto.locked);
  }

  @Post('upload')
  @Permissions('salary.manage')
  upload(@CurrentUser() user: AuthUser, @Body() dto: UploadSalaryDto) {
    return this.salary.upload(user.tenantId, dto.kind, dto.csv, dto.month);
  }
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function payrollMonth(month: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '') ? month : currentMonth();
}
