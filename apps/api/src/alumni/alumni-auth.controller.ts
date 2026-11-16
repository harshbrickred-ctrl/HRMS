import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ClientMeta } from './alumni-auth.guard';
import { AlumniAuthService, type RequestMeta } from './alumni-auth.service';
import { AlumniInvitationsService } from './alumni-invitations.service';
import {
  AlumniLoginDto,
  AlumniRefreshDto,
  AlumniRegisterDto,
  AlumniResetConfirmDto,
  AlumniResetRequestDto,
  AlumniResetVerifyDto,
  InvitationTokenDto,
} from './dto/alumni-portal.dto';

/** Public alumni sign-up and sign-in. Separate from /auth, which is for employees. */
@Controller('alumni/auth')
export class AlumniAuthController {
  constructor(
    private readonly auth: AlumniAuthService,
    private readonly invitations: AlumniInvitationsService,
  ) {}

  /** POST /api/v1/alumni/auth/invitation */
  @Post('invitation')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  checkInvitation(@Body() dto: InvitationTokenDto) {
    return this.invitations.check(dto.token);
  }

  /** POST /api/v1/alumni/auth/register */
  @Post('register')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: AlumniRegisterDto, @ClientMeta() meta: RequestMeta) {
    return this.invitations.register(dto, meta);
  }

  /** POST /api/v1/alumni/auth/login */
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: AlumniLoginDto, @ClientMeta() meta: RequestMeta) {
    return this.auth.login(dto, meta);
  }

  /** POST /api/v1/alumni/auth/refresh */
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() dto: AlumniRefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /** POST /api/v1/alumni/auth/logout */
  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: AlumniRefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  /** POST /api/v1/alumni/auth/password-reset/request */
  @Post('password-reset/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  requestReset(@Body() dto: AlumniResetRequestDto) {
    return this.auth.requestReset(dto.email);
  }

  /** POST /api/v1/alumni/auth/password-reset/verify */
  @Post('password-reset/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  verifyReset(@Body() dto: AlumniResetVerifyDto) {
    return this.auth.verifyReset(dto);
  }

  /** POST /api/v1/alumni/auth/password-reset/confirm */
  @Post('password-reset/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  confirmReset(@Body() dto: AlumniResetConfirmDto) {
    return this.auth.confirmReset(dto);
  }
}
