import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

export type JwtPayload = {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user.id, user.tenantId, user.email, user.roles.map((r) => r.role.code));
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: {
        user: { include: { roles: { include: { role: true } } } },
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const roles = stored.user.roles.map((r) => r.role.code);
    return this.issueTokens(
      stored.user.id,
      stored.user.tenantId,
      stored.user.email,
      roles,
    );
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        tenant: true,
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantCode: user.tenant.code,
      roles: user.roles.map((r) => r.role.code),
      mfaEnabled: user.mfaEnabled,
    };
  }

  private async issueTokens(
    userId: string,
    tenantId: string,
    email: string,
    roles: string[],
  ) {
    const payload: JwtPayload = { sub: userId, tenantId, email, roles };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString('base64url');
    const days = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
      tokenType: 'Bearer',
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
