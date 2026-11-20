import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

@Module({
  imports: [RbacModule, NotificationsModule],
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
