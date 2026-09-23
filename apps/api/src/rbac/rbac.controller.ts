import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Permissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';
import { RbacService } from './rbac.service';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  /** GET /api/v1/roles — role catalog */
  @Get('roles')
  @Permissions('rbac.read')
  listRoles(@CurrentUser() user: AuthUser) {
    return this.rbac.listRoles(user.tenantId);
  }

  /** GET /api/v1/users — users with roles */
  @Get('users')
  @Permissions('rbac.read')
  listUsers(@CurrentUser() user: AuthUser) {
    return this.rbac.listUsers(user.tenantId);
  }

  /** PUT /api/v1/users/:id/roles — replace role set */
  @Put('users/:id/roles')
  @Permissions('rbac.assign')
  updateRoles(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
  ) {
    return this.rbac.updateUserRoles(
      user.tenantId,
      user.userId,
      id,
      dto.roleCodes,
    );
  }

  /** GET /api/v1/rbac/me/permissions — effective permissions for UI */
  @Get('rbac/me/permissions')
  myPermissions(@CurrentUser() user: AuthUser) {
    return this.rbac.myPermissions(user.userId);
  }
}
