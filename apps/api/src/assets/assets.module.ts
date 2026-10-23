import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  imports: [RbacModule, NotificationsModule],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
