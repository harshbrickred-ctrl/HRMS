import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { RbacModule } from '../rbac/rbac.module';
import { HrController, HrSelfController } from './hr.controller';
import { HrService } from './hr.service';

@Module({
  imports: [RbacModule, AttendanceModule],
  controllers: [HrController, HrSelfController],
  providers: [HrService],
})
export class HrModule {}
