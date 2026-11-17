import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AlumniAccount } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AlumniMailService } from './alumni-mail.service';
import {
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGINS,
  MAX_OTP_ATTEMPTS,
  OTP_TTL_MS,
  RESET_SESSION_TTL_MS,
  SESSION_TTL_DAYS,
  hashToken,
  newOtp,
  newToken,
  passwordProblem,
  portalAllowed,
} from './alumni-rules';
import {
  AlumniSupport,
  isPrismaError,
  normaliseEmail,
} from './alumni-support.service';
import type {
  AlumniChangePasswordDto,
  AlumniLoginDto,
  AlumniResetConfirmDto,
  AlumniResetVerifyDto,
  EmailChangeConfirmDto,
  EmailChangeRequestDto,
} from './dto/alumni-portal.dto';

export const ALUMNI_AUDIENCE = 'peopleos-alumni';
export const ALUMNI_ISSUER = 'peopleos';
export const ALUMNI_ACCESS_TTL = '15m' as const;

/**
 * Alumni tokens are signed with their own secret, so the employee JwtStrategy
 * rejects them and the alumni guard rejects employee tokens. ALUMNI_JWT_SECRET
 * may be set; otherwise a key is derived from JWT_ACCESS_SECRET.
 */
export function alumniJwtSecret(config: ConfigService) {
  const employeeSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
  const own = config.get<string>('ALUMNI_JWT_SECRET');
  if (own) {
    if (own === employeeSecret) {
      throw new Error(
        'ALUMNI_JWT_SECRET must be different from JWT_ACCESS_SECRET.',
      );
    }
    return own;
  }
  return createHmac('sha256', employeeSecret)
    .update('peopleos-alumni-portal-v1')
    .digest('base64url');
}

type AlumniTokenPayload = {
  sub: string;
  alumniId: string;
  tenantId: string;
  sid: string;
  typ: string;
};

/** The signed-in alumnus, set on the request by AlumniAuthGuard. */
export type AlumniPrincipal = {
  accountId: string;
  alumniId: string;
  tenantId: string;
  sessionId: string;
};
export type RequestMeta = { ip: string; userAgent: string };

const INVALID_LOGIN = 'Invalid email or password.';
const GENERIC_RESET =
  'If an alumni login exists for that email, a code has been sent.';
const INVALID_CODE = 'Invalid or expired code.';
/** Compared against when no account matches, so a wrong email takes as long as a wrong password. */
const TIMING_HASH = bcrypt.hashSync('alumni-timing-guard', 10);

@Injectable()
export class AlumniAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: AlumniMailService,
    private readonly support: AlumniSupport,
  ) {}

  async login(dto: AlumniLoginDto, meta: RequestMeta) {
    const email = normaliseEmail(dto.email);
    const accounts = await this.prisma.alumniAccount.findMany({
      where: { email },
      include: { alumni: { select: { eligibility: true } } },
      take: 5,
    });
    if (!accounts.length) {
      await bcrypt.compare(dto.password, TIMING_HASH);
      throw new UnauthorizedException(INVALID_LOGIN);
    }

    const now = new Date();
    let locked = false;
    for (const account of accounts) {
      // While locked the password is not even checked.
      if (account.lockedUntil && account.lockedUntil > now) {
        locked = true;
        continue;
      }
      if (await bcrypt.compare(dto.password, account.passwordHash)) {
        if (!portalAllowed(account.status, account.alumni.eligibility)) {
          throw new UnauthorizedException(
            'Your alumni access is not active. Please contact HR.',
          );
        }
        await this.prisma.alumniAccount.update({
          where: { id: account.id },
          data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
        });
        await this.support.audit(
          this.prisma,
          account.tenantId,
          { type: 'alumni', alumniId: account.alumniId },
          'alumni.auth.login',
          'AlumniAccount',
          account.id,
          { ip: meta.ip },
        );
        return this.issueTokens(account);
      }
      locked = (await this.recordFailure(account, now, meta)) || locked;
    }
    if (locked) {
      throw new UnauthorizedException(
        `Too many failed sign-ins. Try again in ${LOCKOUT_MINUTES} minutes or reset your password.`,
      );
    }
    throw new UnauthorizedException(INVALID_LOGIN);
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.alumniSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: {
        account: { include: { alumni: { select: { eligibility: true } } } },
      },
    });
    if (!session) throw new UnauthorizedException('Invalid refresh token.');
    if (session.revokedAt) {
      // A used refresh token came back: treat it as stolen and end every session.
      await this.prisma.alumniSession.updateMany({
        where: { accountId: session.accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token.');
    }
    if (
      session.expiresAt < new Date() ||
      !portalAllowed(session.account.status, session.account.alumni.eligibility)
    ) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    await this.prisma.alumniSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(session.account);
  }

  async logout(refreshToken: string) {
    await this.prisma.alumniSession.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  /** Checks the token AND the database, so Do Not Contact or a logout takes effect at once. */
  async authenticate(accessToken: string): Promise<AlumniPrincipal> {
    let payload: AlumniTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AlumniTokenPayload>(accessToken, {
        audience: ALUMNI_AUDIENCE,
        issuer: ALUMNI_ISSUER,
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ !== 'alumni' || !payload.sid)
      throw new UnauthorizedException();

    const session = await this.prisma.alumniSession.findUnique({
      where: { id: payload.sid },
      include: {
        account: { include: { alumni: { select: { eligibility: true } } } },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.accountId !== payload.sub
    ) {
      throw new UnauthorizedException();
    }
    if (
      !portalAllowed(session.account.status, session.account.alumni.eligibility)
    ) {
      throw new UnauthorizedException(
        'Your alumni access is not active. Please contact HR.',
      );
    }
    return {
      accountId: session.accountId,
      alumniId: session.account.alumniId,
      tenantId: session.account.tenantId,
      sessionId: session.id,
    };
  }

  async issueTokens(
    account: Pick<AlumniAccount, 'id' | 'alumniId' | 'tenantId'>,
  ) {
    const refreshToken = newToken(48);
    const session = await this.prisma.alumniSession.create({
      data: {
        accountId: account.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });
    const payload: AlumniTokenPayload = {
      sub: account.id,
      alumniId: account.alumniId,
      tenantId: account.tenantId,
      sid: session.id,
      typ: 'alumni',
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken,
      expiresIn: ALUMNI_ACCESS_TTL,
      tokenType: 'Bearer',
    };
  }

  // ─── Password reset (no shortcut codes) ────────────────────────────────────

  async requestReset(emailRaw: string) {
    const accounts = await this.activeAccounts(normaliseEmail(emailRaw));
    for (const account of accounts) {
      await this.prisma.alumniOtp.updateMany({
        where: {
          accountId: account.id,
          purpose: 'password_reset',
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      const code = newOtp();
      await this.prisma.alumniOtp.create({
        data: {
          accountId: account.id,
          purpose: 'password_reset',
          codeHash: await bcrypt.hash(code, 10),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      });
      await this.mail.otp(account.email, 'password_reset', code);
    }
    return { message: GENERIC_RESET };
  }

  async verifyReset(dto: AlumniResetVerifyDto) {
    const accounts = await this.activeAccounts(normaliseEmail(dto.email));
    for (const account of accounts) {
      const record = await this.checkOtp(account.id, 'password_reset', dto.otp);
      if (!record) continue;
      const resetToken = newToken();
      await this.prisma.alumniOtp.update({
        where: { id: record.id },
        data: {
          consumedAt: new Date(),
          resetSessionHash: hashToken(resetToken),
          resetSessionExpiresAt: new Date(Date.now() + RESET_SESSION_TTL_MS),
        },
      });
      return { resetToken, expiresIn: Math.floor(RESET_SESSION_TTL_MS / 1000) };
    }
    throw new BadRequestException(INVALID_CODE);
  }

  async confirmReset(dto: AlumniResetConfirmDto) {
    const problem = passwordProblem(dto.password);
    if (problem) throw new BadRequestException(problem);
    const record = await this.prisma.alumniOtp.findFirst({
      where: {
        resetSessionHash: hashToken(dto.resetToken),
        resetSessionExpiresAt: { gt: new Date() },
      },
      include: {
        account: { include: { alumni: { select: { eligibility: true } } } },
      },
    });
    if (
      !record ||
      !portalAllowed(record.account.status, record.account.alumni.eligibility)
    ) {
      throw new BadRequestException('Invalid or expired reset session.');
    }
    if (await bcrypt.compare(dto.password, record.account.passwordHash)) {
      throw new BadRequestException(
        'New password must be different from the current password.',
      );
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.alumniAccount.update({
        where: { id: record.accountId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      });
      await tx.alumniSession.updateMany({
        where: { accountId: record.accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.alumniOtp.update({
        where: { id: record.id },
        data: { resetSessionHash: null, resetSessionExpiresAt: null },
      });
      await this.support.audit(
        tx,
        record.account.tenantId,
        { type: 'alumni', alumniId: record.account.alumniId },
        'alumni.auth.password.reset',
        'AlumniAccount',
        record.accountId,
        { method: 'otp' },
      );
    });
    return { success: true };
  }

  // ─── Signed-in account changes ─────────────────────────────────────────────

  async changePassword(
    principal: AlumniPrincipal,
    dto: AlumniChangePasswordDto,
  ) {
    const account = await this.prisma.alumniAccount.findUniqueOrThrow({
      where: { id: principal.accountId },
    });
    if (!(await bcrypt.compare(dto.currentPassword, account.passwordHash))) {
      throw new BadRequestException('Current password is incorrect.');
    }
    const problem = passwordProblem(dto.newPassword);
    if (problem) throw new BadRequestException(problem);
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password.',
      );
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.alumniAccount.update({
        where: { id: account.id },
        data: { passwordHash },
      });
      // Other devices are signed out; this one stays signed in.
      await tx.alumniSession.updateMany({
        where: {
          accountId: account.id,
          revokedAt: null,
          id: { not: principal.sessionId },
        },
        data: { revokedAt: new Date() },
      });
      await this.support.audit(
        tx,
        account.tenantId,
        { type: 'alumni', alumniId: account.alumniId },
        'alumni.auth.password.change',
        'AlumniAccount',
        account.id,
      );
    });
    return { success: true };
  }

  async requestEmailChange(
    principal: AlumniPrincipal,
    dto: EmailChangeRequestDto,
  ) {
    const account = await this.prisma.alumniAccount.findUniqueOrThrow({
      where: { id: principal.accountId },
    });
    if (!(await bcrypt.compare(dto.password, account.passwordHash))) {
      throw new BadRequestException('Password is incorrect.');
    }
    const newEmail = normaliseEmail(dto.newEmail);
    if (newEmail === account.email)
      throw new BadRequestException('That is already your login email.');
    await this.assertEmailFree(account.tenantId, newEmail, account.id);

    await this.prisma.alumniOtp.updateMany({
      where: {
        accountId: account.id,
        purpose: 'email_change',
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    const code = newOtp();
    await this.prisma.alumniOtp.create({
      data: {
        accountId: account.id,
        purpose: 'email_change',
        codeHash: await bcrypt.hash(code, 10),
        target: newEmail,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    const sent = await this.mail.otp(newEmail, 'email_change', code);
    if (!sent)
      throw new BadRequestException(
        'We could not send the code to that address. Try again later.',
      );
    return { message: `We sent a 6-digit code to ${newEmail}.` };
  }

  async confirmEmailChange(
    principal: AlumniPrincipal,
    dto: EmailChangeConfirmDto,
  ) {
    const record = await this.checkOtp(
      principal.accountId,
      'email_change',
      dto.otp,
    );
    if (!record) throw new BadRequestException(INVALID_CODE);
    await this.assertEmailFree(
      principal.tenantId,
      record.target,
      principal.accountId,
    );
    try {
      await this.prisma.$transaction(async (tx) => {
        const before = await tx.alumniAccount.findUniqueOrThrow({
          where: { id: principal.accountId },
        });
        await tx.alumniAccount.update({
          where: { id: principal.accountId },
          data: { email: record.target, emailVerifiedAt: new Date() },
        });
        await tx.alumniOtp.update({
          where: { id: record.id },
          data: { consumedAt: new Date() },
        });
        await this.support.audit(
          tx,
          principal.tenantId,
          { type: 'alumni', alumniId: principal.alumniId },
          'alumni.auth.email.change',
          'AlumniAccount',
          principal.accountId,
          { from: before.email, to: record.target },
        );
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002'))
        throw new ConflictException(
          'That email is already used by another alumni login.',
        );
      throw error;
    }
    return { email: record.target };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async activeAccounts(email: string) {
    const accounts = await this.prisma.alumniAccount.findMany({
      where: { email, status: 'active' },
      include: { alumni: { select: { eligibility: true } } },
      take: 5,
    });
    return accounts.filter((account) =>
      portalAllowed(account.status, account.alumni.eligibility),
    );
  }

  /** The latest open code for the purpose if the given code matches it; counts wrong tries. */
  private async checkOtp(
    accountId: string,
    purpose: 'password_reset' | 'email_change',
    code: string,
  ) {
    const record = await this.prisma.alumniOtp.findFirst({
      where: { accountId, purpose, consumedAt: null, resetSessionHash: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt < new Date()) return null;
    if (await bcrypt.compare(code, record.codeHash)) return record;
    const attempts = record.attemptCount + 1;
    await this.prisma.alumniOtp.update({
      where: { id: record.id },
      data: {
        attemptCount: attempts,
        ...(attempts >= MAX_OTP_ATTEMPTS ? { consumedAt: new Date() } : {}),
      },
    });
    return null;
  }

  /** Adds one failed try; locks the account at the limit. Returns whether it is now locked. */
  private async recordFailure(
    account: AlumniAccount,
    now: Date,
    meta: RequestMeta,
  ) {
    const updated = await this.prisma.alumniAccount.update({
      where: { id: account.id },
      data: { failedLoginCount: { increment: 1 } },
    });
    if (updated.failedLoginCount < MAX_FAILED_LOGINS) return false;
    await this.prisma.alumniAccount.update({
      where: { id: account.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000),
      },
    });
    await this.support.audit(
      this.prisma,
      account.tenantId,
      { type: 'system' },
      'alumni.auth.locked',
      'AlumniAccount',
      account.id,
      { ip: meta.ip, minutes: LOCKOUT_MINUTES },
    );
    return true;
  }

  private async assertEmailFree(
    tenantId: string,
    email: string,
    exceptAccountId: string,
  ) {
    const taken = await this.prisma.alumniAccount.findFirst({
      where: { tenantId, email, id: { not: exceptAccountId } },
    });
    if (taken)
      throw new ConflictException(
        'That email is already used by another alumni login.',
      );
  }
}
