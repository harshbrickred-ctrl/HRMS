import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AlumniAuthService, type RequestMeta } from './alumni-auth.service';
import { AlumniMailService } from './alumni-mail.service';
import {
  ALUMNI_TERMS_VERSION,
  INVITE_TTL_DAYS,
  canInvite,
  hashToken,
  newToken,
  passwordProblem,
} from './alumni-rules';
import {
  AlumniSupport,
  isPrismaError,
  normaliseEmail,
} from './alumni-support.service';
import type { AlumniRegisterDto } from './dto/alumni-portal.dto';

@Injectable()
export class AlumniInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AlumniSupport,
    private readonly mail: AlumniMailService,
    private readonly auth: AlumniAuthService,
  ) {}

  /** ALM-03. A new one-time link to the personal email; earlier open links stop working. */
  async send(tenantId: string, actorUserId: string, alumniId: string) {
    const alumni = await this.prisma.alumni.findFirst({
      where: { id: alumniId, tenantId },
      include: { account: true },
    });
    if (!alumni) throw new NotFoundException('Alumni record not found.');
    if (!canInvite(alumni.eligibility)) {
      throw new BadRequestException(
        'Only alumni marked Eligible can be invited.',
      );
    }
    if (alumni.account?.status === 'active')
      throw new BadRequestException('This alumnus has already registered.');

    const token = newToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.alumniInvitation.updateMany({
        where: { alumniId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'Replaced by a new invitation' },
      });
      await tx.alumniInvitation.create({
        data: {
          tenantId,
          alumniId,
          email: alumni.personalEmail,
          tokenHash: hashToken(token),
          expiresAt,
          sentById: actorUserId,
          sentAt: now,
        },
      });
    });
    const emailSent = await this.mail.invitation(
      alumni.personalEmail,
      alumni.fullName,
      token,
      expiresAt,
    );
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.invite.send',
      'Alumni',
      alumniId,
      {
        email: alumni.personalEmail,
        expiresAt: expiresAt.toISOString(),
        emailSent,
        previousAccountStatus: alumni.account?.status ?? null,
      },
    );
    return {
      alumniId,
      email: alumni.personalEmail,
      expiresAt: expiresAt.toISOString(),
      emailSent,
    };
  }

  async sendMany(tenantId: string, actorUserId: string, alumniIds: string[]) {
    const results: {
      alumniId: string;
      ok: boolean;
      emailSent?: boolean;
      message?: string;
    }[] = [];
    for (const alumniId of [...new Set(alumniIds)]) {
      try {
        const sent = await this.send(tenantId, actorUserId, alumniId);
        results.push({ alumniId, ok: true, emailSent: sent.emailSent });
      } catch (error) {
        results.push({
          alumniId,
          ok: false,
          message:
            error instanceof HttpException
              ? error.message
              : 'Could not send the invitation.',
        });
      }
    }
    return { results };
  }

  async revoke(tenantId: string, actorUserId: string, alumniId: string) {
    await this.support.requireAlumni(tenantId, alumniId);
    const { count } = await this.prisma.alumniInvitation.updateMany({
      where: { alumniId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'Revoked by HR' },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.invite.revoke',
      'Alumni',
      alumniId,
      {
        revoked: count,
      },
    );
    return { revoked: count };
  }

  /** Public: what the registration page shows for a link. */
  async check(token: string) {
    const invitation = await this.usable(token);
    return {
      fullName: invitation.alumni.fullName,
      email: invitation.email,
      expiresAt: invitation.expiresAt.toISOString(),
      termsVersion: ALUMNI_TERMS_VERSION,
    };
  }

  /**
   * Public. The emailed link proves the alumnus controls the personal inbox, so
   * the login email is verified here. Terms and data consent are required; the
   * link is claimed atomically so it can never be used twice.
   */
  async register(dto: AlumniRegisterDto, meta: RequestMeta) {
    const problem = passwordProblem(dto.password);
    if (problem) throw new BadRequestException(problem);
    const invitation = await this.usable(dto.token);
    const { alumniId, tenantId } = invitation;
    const email = normaliseEmail(invitation.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const communications = dto.communications === true;
    const directory = dto.directory === true;
    const now = new Date();

    try {
      const account = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.alumniInvitation.updateMany({
          where: {
            id: invitation.id,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { acceptedAt: now },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException(
            'This invitation link has already been used. Sign in instead.',
          );
        }
        const existing = await tx.alumniAccount.findUnique({
          where: { alumniId },
        });
        const data = {
          email,
          passwordHash,
          status: 'active' as const,
          statusReason: '',
          emailVerifiedAt: now,
          failedLoginCount: 0,
          lockedUntil: null,
          communicationsConsent: communications,
        };
        const saved = existing
          ? await tx.alumniAccount.update({ where: { id: existing.id }, data })
          : await tx.alumniAccount.create({
              data: { ...data, tenantId, alumniId },
            });
        const consents = [
          { type: 'terms' as const, granted: true },
          { type: 'data_processing' as const, granted: true },
          { type: 'communications' as const, granted: communications },
          { type: 'directory' as const, granted: directory },
        ];
        await tx.alumniConsent.createMany({
          data: consents.map((consent) => ({
            ...consent,
            tenantId,
            alumniId,
            version: ALUMNI_TERMS_VERSION,
            ipAddress: meta.ip,
            userAgent: meta.userAgent,
            recordedAt: now,
          })),
        });
        const profile = {
          directoryOptIn: directory,
          directoryOptInAt: directory ? now : null,
        };
        await tx.alumniProfile.upsert({
          where: { alumniId },
          create: { alumniId, ...profile },
          update: profile,
        });
        await this.support.audit(
          tx,
          tenantId,
          { type: 'alumni', alumniId },
          'alumni.register',
          'AlumniAccount',
          saved.id,
          {
            invitationId: invitation.id,
            reactivated: Boolean(existing),
            ip: meta.ip,
          },
        );
        return saved;
      });
      return this.auth.issueTokens(account);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          'This email is already used by another alumni login. Please contact HR.',
        );
      }
      throw error;
    }
  }

  private async usable(token: string) {
    const invitation = await this.prisma.alumniInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { alumni: true },
    });
    if (
      !invitation ||
      invitation.revokedAt ||
      !canInvite(invitation.alumni.eligibility)
    ) {
      throw new BadRequestException(
        'This invitation link is no longer valid. Ask HR for a new one.',
      );
    }
    if (invitation.acceptedAt) {
      throw new BadRequestException(
        'This invitation link has already been used. Sign in instead.',
      );
    }
    if (invitation.expiresAt <= new Date()) {
      throw new BadRequestException(
        'This invitation link has expired. Ask HR for a new one.',
      );
    }
    return invitation;
  }
}
