import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetVerifyDto } from './dto/password-reset-verify.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }

  /** POST /api/v1/auth/password-reset/request */
  @Post('password-reset/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  requestReset(@Body() dto: PasswordResetRequestDto) {
    return this.passwordReset.request(dto.email);
  }

  /** POST /api/v1/auth/password-reset/verify */
  @Post('password-reset/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  verifyReset(@Body() dto: PasswordResetVerifyDto) {
    return this.passwordReset.verify(dto.email, dto.otp);
  }

  /** POST /api/v1/auth/password-reset/confirm */
  @Post('password-reset/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  confirmReset(@Body() dto: PasswordResetConfirmDto) {
    return this.passwordReset.confirm(dto.resetToken, dto.password);
  }
}
