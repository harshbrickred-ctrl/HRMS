import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AlumniAuthService,
  type AlumniPrincipal,
  type RequestMeta,
} from './alumni-auth.service';

type AlumniRequest = Request & { alumni?: AlumniPrincipal };

/** Alumni portal guard. Employee tokens fail here; alumni tokens fail on JwtAuthGuard. */
@Injectable()
export class AlumniAuthGuard implements CanActivate {
  constructor(private readonly auth: AlumniAuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AlumniRequest>();
    const header = request.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    request.alumni = await this.auth.authenticate(token);
    return true;
  }
}

export const CurrentAlumni = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AlumniPrincipal => {
    const principal = ctx.switchToHttp().getRequest<AlumniRequest>().alumni;
    if (!principal) throw new UnauthorizedException();
    return principal;
  },
);

/** IP and browser, stored with consents and sign-in audits. */
export const ClientMeta = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestMeta => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return {
      ip: (request.ip ?? '').slice(0, 64),
      userAgent: String(request.headers['user-agent'] ?? '').slice(0, 300),
    };
  },
);
