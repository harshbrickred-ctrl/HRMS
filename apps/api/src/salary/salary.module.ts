import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { RbacModule } from '../rbac/rbac.module';
import { BankTransferService } from './bank-transfer.service';
import { RazorpayXGateway } from './razorpay-x';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';

@Module({
  imports: [RbacModule, AttendanceModule],
  controllers: [SalaryController, RazorpayWebhookController],
  providers: [SalaryService, BankTransferService, RazorpayXGateway],
})
export class SalaryModule {}
