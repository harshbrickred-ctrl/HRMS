import { Module } from '@nestjs/common';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  controllers: [RbacController],
  providers: [RbacService, PermissionsService, PermissionsGuard],
  exports: [PermissionsService, PermissionsGuard],
})
export class RbacModule {}
