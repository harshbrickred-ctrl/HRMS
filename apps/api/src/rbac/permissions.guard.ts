import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionsService } from './permissions.service';
import type { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user?.userId) {
      throw new ForbiddenException('Missing authenticated user');
    }

    const ok = await this.permissions.userHasAllPermissions(
      user.userId,
      required,
    );
    if (!ok) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
