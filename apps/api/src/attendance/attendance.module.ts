import { Module, forwardRef } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceAdminController } from './attendance-admin.controller';
import { AttendanceSelfController } from './attendance-self.controller';
import { AttendanceTeamController } from './attendance-team.controller';
import { AttendanceService } from './attendance.service';
import { IclockController } from './iclock.controller';

@Module({
  imports: [RbacModule, forwardRef(() => NotificationsModule)],
  controllers: [
    AttendanceSelfController,
    AttendanceTeamController,
    AttendanceAdminController,
    IclockController,
  ],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
