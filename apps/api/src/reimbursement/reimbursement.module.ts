import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { ReimbursementController } from './reimbursement.controller';
import { ReimbursementService } from './reimbursement.service';

@Module({
  imports: [RbacModule, NotificationsModule],
  controllers: [ReimbursementController],
  providers: [ReimbursementService],
  exports: [ReimbursementService],
})
export class ReimbursementModule {}
