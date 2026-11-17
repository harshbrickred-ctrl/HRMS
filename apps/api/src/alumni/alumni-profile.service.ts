import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type AlumniProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AlumniPrincipal, RequestMeta } from './alumni-auth.service';
import {
  ALUMNI_TERMS_VERSION,
  type DirectoryFilters,
  directoryCard,
  formatTenure,
  matchesDirectory,
  parseVisibility,
  portalAllowed,
  readVisibility,
} from './alumni-rules';
import {
  type AlumniUpload,
  AlumniSupport,
  PHOTO_EXT,
  contentType,
  day,
} from './alumni-support.service';
import type {
  AlumniProfileDto,
  ConsentDto,
  DirectoryQueryDto,
} from './dto/alumni-portal.dto';

const DIRECTORY_PAGE_SIZE = 24;
const DIRECTORY_SCAN_LIMIT = 5000;
const CONSENT_TYPES = [
  'terms',
  'data_processing',
  'communications',
  'directory',
] as const;

/** Everything here is the alumnus's own data or other alumni's opted-in fields; never Employee data. */
@Injectable()
export class AlumniProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AlumniSupport,
  ) {}

  async me(principal: AlumniPrincipal) {
    const alumni = await this.prisma.alumni.findUniqueOrThrow({
      where: { id: principal.alumniId },
      include: {
        account: {
          select: {
            email: true,
            communicationsConsent: true,
            lastLoginAt: true,
          },
        },
        profile: true,
      },
    });
    return {
      id: alumni.id,
      fullName: alumni.fullName,
      employeeCode: alumni.employeeCode,
      designation: alumni.designation,
      departmentName: alumni.departmentName,
      locationName: alumni.locationName,
      joiningDate: day(alumni.joiningDate),
      lastWorkingDay: day(alumni.lastWorkingDay),
      tenure: formatTenure(alumni.tenureMonths),
      personalEmail: alumni.personalEmail,
      loginEmail: alumni.account?.email ?? alumni.personalEmail,
      lastLoginAt: alumni.account?.lastLoginAt?.toISOString() ?? null,
      profile: this.profileView(alumni.profile),
      consents: await this.currentConsents(alumni.id),
    };
  }

  async updateProfile(principal: AlumniPrincipal, dto: AlumniProfileDto) {
    const current = await this.prisma.alumniProfile.findUnique({
      where: { alumniId: principal.alumniId },
    });
    let visibility: Prisma.InputJsonObject | undefined;
    if (dto.visibility) {
      try {
        visibility = {
          ...readVisibility(current?.visibility),
          ...parseVisibility(dto.visibility),
        };
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
    }
    const skills = dto.skills
      ? [...new Set(dto.skills.map((skill) => skill.trim()).filter(Boolean))]
      : undefined;
    const data = {
      currentEmployer: dto.currentEmployer?.trim(),
      currentDesignation: dto.currentDesignation?.trim(),
      industry: dto.industry?.trim(),
      location: dto.location?.trim(),
      phone: dto.phone?.trim(),
      contactEmail: dto.contactEmail?.trim().toLowerCase(),
      linkedinUrl: dto.linkedinUrl?.trim(),
      skills,
      visibility,
    };
    await this.prisma.alumniProfile.upsert({
      where: { alumniId: principal.alumniId },
      create: { alumniId: principal.alumniId, ...data },
      update: data,
    });
    await this.support.audit(
      this.prisma,
      principal.tenantId,
      { type: 'alumni', alumniId: principal.alumniId },
      'alumni.profile.update',
      'AlumniProfile',
      principal.alumniId,
      {
        fields: Object.keys(data).filter(
          (key) => data[key as keyof typeof data] !== undefined,
        ),
      },
    );
    return this.me(principal);
  }

  async savePhoto(principal: AlumniPrincipal, file: AlumniUpload | undefined) {
    const saved = await this.support.saveFile(
      principal.tenantId,
      principal.alumniId,
      'photo',
      file,
      PHOTO_EXT,
    );
    const previous = await this.prisma.alumniProfile.findUnique({
      where: { alumniId: principal.alumniId },
    });
    await this.prisma.alumniProfile.upsert({
      where: { alumniId: principal.alumniId },
      create: { alumniId: principal.alumniId, photoPath: saved.storagePath },
      update: { photoPath: saved.storagePath },
    });
    if (previous?.photoPath) await this.support.remove(previous.photoPath);
    return this.me(principal);
  }

  async removePhoto(principal: AlumniPrincipal) {
    const profile = await this.prisma.alumniProfile.findUnique({
      where: { alumniId: principal.alumniId },
    });
    if (profile?.photoPath) {
      await this.prisma.alumniProfile.update({
        where: { id: profile.id },
        data: { photoPath: '' },
      });
      await this.support.remove(profile.photoPath);
    }
    return this.me(principal);
  }

  /** Own photo always; someone else's only when both are in the directory and the photo is shared. */
  async openPhoto(viewer: AlumniPrincipal, alumniId: string) {
    const target = await this.prisma.alumni.findFirst({
      where: { id: alumniId, tenantId: viewer.tenantId },
      include: { profile: true, account: { select: { status: true } } },
    });
    if (!target?.profile?.photoPath) throw new NotFoundException('No photo.');
    if (alumniId !== viewer.alumniId) {
      const viewerProfile = await this.prisma.alumniProfile.findUnique({
        where: { alumniId: viewer.alumniId },
      });
      const shared =
        viewerProfile?.directoryOptIn &&
        target.profile.directoryOptIn &&
        readVisibility(target.profile.visibility).photo &&
        target.account &&
        portalAllowed(target.account.status, target.eligibility);
      if (!shared) throw new NotFoundException('No photo.');
    }
    return {
      stream: await this.support.open(target.profile.photoPath),
      contentType: contentType(target.profile.photoPath),
    };
  }

  // ─── Consent (rules 5 and 6) ───────────────────────────────────────────────

  async consents(principal: AlumniPrincipal) {
    const history = await this.prisma.alumniConsent.findMany({
      where: { alumniId: principal.alumniId },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    return {
      current: await this.currentConsents(principal.alumniId),
      history: history.map((row) => ({
        type: row.type,
        granted: row.granted,
        version: row.version,
        recordedAt: row.recordedAt.toISOString(),
      })),
    };
  }

  /** Every change is a new consent row. Withdrawing data processing ends portal access. */
  async setConsent(
    principal: AlumniPrincipal,
    dto: ConsentDto,
    meta: RequestMeta,
  ) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.alumniConsent.create({
        data: {
          tenantId: principal.tenantId,
          alumniId: principal.alumniId,
          type: dto.type,
          version: ALUMNI_TERMS_VERSION,
          granted: dto.granted,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
          recordedAt: now,
        },
      });
      if (dto.type === 'communications') {
        await tx.alumniAccount.update({
          where: { id: principal.accountId },
          data: { communicationsConsent: dto.granted },
        });
      }
      if (dto.type === 'directory') {
        const profile = {
          directoryOptIn: dto.granted,
          directoryOptInAt: dto.granted ? now : null,
        };
        await tx.alumniProfile.upsert({
          where: { alumniId: principal.alumniId },
          create: { alumniId: principal.alumniId, ...profile },
          update: profile,
        });
      }
      if (dto.type === 'data_processing' && !dto.granted) {
        await this.support.closeAccount(
          tx,
          principal.accountId,
          'withdrawn',
          'The alumnus withdrew data-processing consent.',
        );
      }
      await this.support.audit(
        tx,
        principal.tenantId,
        { type: 'alumni', alumniId: principal.alumniId },
        'alumni.consent.update',
        'AlumniConsent',
        principal.alumniId,
        { type: dto.type, granted: dto.granted, ip: meta.ip },
      );
    });
    if (dto.type === 'data_processing' && !dto.granted)
      return { signedOut: true };
    return this.consents(principal);
  }

  // ─── Directory (ALM-06) ────────────────────────────────────────────────────

  async directory(principal: AlumniPrincipal, query: DirectoryQueryDto) {
    const viewer = await this.prisma.alumniProfile.findUnique({
      where: { alumniId: principal.alumniId },
    });
    if (!viewer?.directoryOptIn) {
      throw new ForbiddenException(
        'Turn on "Show me in the alumni directory" under Privacy to browse the directory.',
      );
    }
    const people = await this.prisma.alumni.findMany({
      where: {
        tenantId: principal.tenantId,
        id: { not: principal.alumniId },
        eligibility: 'eligible',
        account: { is: { status: 'active' } },
        profile: { is: { directoryOptIn: true } },
      },
      include: { profile: true },
      orderBy: { fullName: 'asc' },
      take: DIRECTORY_SCAN_LIMIT,
    });
    const cards = people.map((person) =>
      directoryCard({ ...person, profile: person.profile! }),
    );
    const filters: DirectoryFilters = {
      q: query.q,
      department: query.department,
      batch: query.batch,
      exitYear: query.exitYear,
      location: query.location,
      industry: query.industry,
    };
    const matching = cards.filter((card) => matchesDirectory(card, filters));
    const page = query.page ?? 1;
    return {
      total: matching.length,
      page,
      pageSize: DIRECTORY_PAGE_SIZE,
      items: matching.slice(
        (page - 1) * DIRECTORY_PAGE_SIZE,
        page * DIRECTORY_PAGE_SIZE,
      ),
      // Built from visible values only, so the options never reveal hidden fields.
      options: {
        departments: unique(cards.map((card) => card.department)),
        batches: unique(cards.map((card) => card.batch)).sort((a, b) => b - a),
        exitYears: unique(cards.map((card) => card.exitYear)).sort(
          (a, b) => b - a,
        ),
        locations: unique(cards.map((card) => card.location)),
        industries: unique(cards.map((card) => card.industry)),
      },
    };
  }

  private async currentConsents(alumniId: string) {
    const rows = await this.prisma.alumniConsent.findMany({
      where: { alumniId },
      orderBy: { recordedAt: 'desc' },
    });
    const current = {} as Record<
      (typeof CONSENT_TYPES)[number],
      { granted: boolean; recordedAt: string } | null
    >;
    for (const type of CONSENT_TYPES) {
      const latest = rows.find((row) => row.type === type);
      current[type] = latest
        ? {
            granted: latest.granted,
            recordedAt: latest.recordedAt.toISOString(),
          }
        : null;
    }
    return current;
  }

  private profileView(profile: AlumniProfile | null) {
    return {
      currentEmployer: profile?.currentEmployer ?? '',
      currentDesignation: profile?.currentDesignation ?? '',
      industry: profile?.industry ?? '',
      location: profile?.location ?? '',
      phone: profile?.phone ?? '',
      contactEmail: profile?.contactEmail ?? '',
      skills: profile?.skills ?? [],
      linkedinUrl: profile?.linkedinUrl ?? '',
      hasPhoto: Boolean(profile?.photoPath),
      visibility: readVisibility(profile?.visibility),
      directoryOptIn: profile?.directoryOptIn ?? false,
    };
  }
}

function unique<T extends string | number>(values: (T | undefined)[]) {
  const set = new Set(
    values.filter((value): value is T => value !== undefined && value !== ''),
  );
  return [...set].sort((a, b) => String(a).localeCompare(String(b)));
}
