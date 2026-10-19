import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { PayslipsController } from './payslips.controller';
import { PayslipsService } from './payslips.service';

@Module({
  imports: [RbacModule, NotificationsModule],
  controllers: [PayslipsController],
  providers: [PayslipsService],
})
export class PayslipsModule {}
