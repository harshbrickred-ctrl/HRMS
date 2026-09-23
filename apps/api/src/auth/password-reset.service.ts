import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const GENERIC_REQUEST_MESSAGE =
  'If an account exists for that email, an OTP has been sent.';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_SESSION_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async request(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, status: 'ACTIVE' },
    });

    if (!user) {
      return { message: GENERIC_REQUEST_MESSAGE };
    }

    const latest = await this.prisma.passwordResetOtp.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException(
        'Please wait before requesting another code.',
      );
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const otpHash = await bcrypt.hash(otp, 10);

    await this.prisma.passwordResetOtp.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    await this.prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    try {
      await this.mail.sendPasswordResetOtp(user.email, otp);
    } catch (err) {
      this.logger.error(`OTP email failed for user ${user.id}`, err);
      // Still return generic message; do not leak delivery failure details to client
    }

    return { message: GENERIC_REQUEST_MESSAGE };
  }

  async verify(emailRaw: string, otp: string) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, status: 'ACTIVE' },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired code.');
    }

    const record = await this.prisma.passwordResetOtp.findFirst({
      where: {
        userId: user.id,
        consumedAt: null,
        resetSessionHash: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code.');
    }

    if (record.attemptCount >= MAX_OTP_ATTEMPTS) {
      await this.prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestException('Invalid or expired code.');
    }

    const ok = await bcrypt.compare(otp, record.otpHash);
    if (!ok) {
      const attempts = record.attemptCount + 1;
      await this.prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: {
          attemptCount: attempts,
          ...(attempts >= MAX_OTP_ATTEMPTS
            ? { consumedAt: new Date() }
            : {}),
        },
      });
      throw new BadRequestException('Invalid or expired code.');
    }

    const resetToken = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: {
        consumedAt: new Date(),
        resetSessionHash: this.hashToken(resetToken),
        resetSessionExpiresAt: new Date(Date.now() + RESET_SESSION_TTL_MS),
      },
    });

    return {
      resetToken,
      expiresIn: Math.floor(RESET_SESSION_TTL_MS / 1000),
    };
  }

  async confirm(resetToken: string, password: string) {
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const sessionHash = this.hashToken(resetToken);
    const record = await this.prisma.passwordResetOtp.findFirst({
      where: {
        resetSessionHash: sessionHash,
        resetSessionExpiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!record || !record.user || record.user.status !== 'ACTIVE') {
      throw new BadRequestException('Invalid or expired reset session.');
    }

    const same = await bcrypt.compare(password, record.user.passwordHash);
    if (same) {
      throw new BadRequestException(
        'New password must be different from the current password.',
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordResetOtp.update({
        where: { id: record.id },
        data: {
          resetSessionHash: null,
          resetSessionExpiresAt: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: record.user.tenantId,
          actorUserId: record.userId,
          action: 'auth.password.reset',
          entityType: 'User',
          entityId: record.userId,
          metadata: { method: 'otp' },
        },
      });
    });

    return { success: true };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
