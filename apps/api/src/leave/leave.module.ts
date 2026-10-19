import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { LeaveSelfController } from './leave-self.controller';
import { LeaveTeamController } from './leave-team.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [RbacModule, AttendanceModule, NotificationsModule],
  controllers: [LeaveSelfController, LeaveTeamController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
