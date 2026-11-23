import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import {
  AppraisalCycleController,
  AppraisalAdminController,
  AppraisalHrController,
  AppraisalManagementController,
  AppraisalManagerController,
  AppraisalReportsController,
  AppraisalSelfController,
} from './appraisals.controller';
import { AppraisalsService } from './appraisals.service';

@Module({
  imports: [NotificationsModule, RbacModule],
  controllers: [
    AppraisalSelfController,
    AppraisalManagerController,
    AppraisalHrController,
    AppraisalCycleController,
    AppraisalAdminController,
    AppraisalManagementController,
    AppraisalReportsController,
  ],
  providers: [AppraisalsService],
})
export class AppraisalsModule {}
