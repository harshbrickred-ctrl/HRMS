import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type AlumniAnnouncement,
  type AlumniEvent,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AlumniPrincipal } from './alumni-auth.service';
import { AlumniMailService } from './alumni-mail.service';
import {
  type Audience,
  audienceMatches,
  describeAudience,
  readAudience,
} from './alumni-rules';
import { AlumniSupport } from './alumni-support.service';
import type {
  AnnouncementDto,
  AudienceDto,
  EventDto,
  UpdateAnnouncementDto,
  UpdateEventDto,
} from './dto/alumni-admin.dto';
import type { RsvpDto } from './dto/alumni-portal.dto';

const PAST_EVENTS_DAYS = 60;

type Person = {
  departmentName: string;
  locationName: string;
  joiningDate: Date;
  lastWorkingDay: Date;
};

/** ALM-09. HR publishes to audience groups; alumni see only what was meant for them. */
@Injectable()
export class AlumniEngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: AlumniSupport,
    private readonly mail: AlumniMailService,
  ) {}

  // ─── HR: announcements and newsletters ─────────────────────────────────────

  async listAnnouncements(tenantId: string) {
    const rows = await this.prisma.alumniAnnouncement.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
    return rows.map((row) => this.announcementView(row));
  }

  async createAnnouncement(
    tenantId: string,
    actorUserId: string,
    dto: AnnouncementDto,
  ) {
    const row = await this.prisma.alumniAnnouncement.create({
      data: {
        tenantId,
        kind: dto.kind ?? 'announcement',
        title: dto.title.trim(),
        body: dto.body.trim(),
        audience: this.audienceJson(dto.audience),
        createdById: actorUserId,
        updatedById: actorUserId,
      },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.announcement.create',
      'AlumniAnnouncement',
      row.id,
    );
    return this.announcementView(row);
  }

  async updateAnnouncement(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateAnnouncementDto,
  ) {
    const current = await this.requireAnnouncement(tenantId, id);
    if (current.status === 'archived')
      throw new BadRequestException('An archived post cannot be edited.');
    const row = await this.prisma.alumniAnnouncement.update({
      where: { id },
      data: {
        kind: dto.kind,
        title: dto.title?.trim(),
        body: dto.body?.trim(),
        audience: dto.audience ? this.audienceJson(dto.audience) : undefined,
        updatedById: actorUserId,
      },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.announcement.update',
      'AlumniAnnouncement',
      id,
    );
    return this.announcementView(row);
  }

  /** Publishing emails the audience, but only alumni who agreed to communications. */
  async publishAnnouncement(tenantId: string, actorUserId: string, id: string) {
    const current = await this.requireAnnouncement(tenantId, id);
    if (current.status !== 'draft')
      throw new BadRequestException('Only a draft can be published.');
    const row = await this.prisma.alumniAnnouncement.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        updatedById: actorUserId,
      },
    });
    const label = row.kind === 'newsletter' ? 'Newsletter' : 'Announcement';
    const emailed = await this.broadcast(
      tenantId,
      readAudience(row.audience),
      `${label}: ${row.title}`,
      row.body,
      '/',
    );
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.announcement.publish',
      'AlumniAnnouncement',
      id,
      {
        emailed,
      },
    );
    return { ...this.announcementView(row), emailed };
  }

  async archiveAnnouncement(tenantId: string, actorUserId: string, id: string) {
    await this.requireAnnouncement(tenantId, id);
    const row = await this.prisma.alumniAnnouncement.update({
      where: { id },
      data: { status: 'archived', updatedById: actorUserId },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.announcement.archive',
      'AlumniAnnouncement',
      id,
    );
    return this.announcementView(row);
  }

  // ─── HR: events ────────────────────────────────────────────────────────────

  async listEvents(tenantId: string) {
    const rows = await this.prisma.alumniEvent.findMany({
      where: { tenantId },
      include: { rsvps: { select: { response: true } } },
      orderBy: { startsAt: 'desc' },
    });
    return rows.map((row) => this.eventView(row, row.rsvps));
  }

  async createEvent(tenantId: string, actorUserId: string, dto: EventDto) {
    const dates = this.eventDates(dto.startsAt, dto.endsAt, dto.rsvpBy);
    const row = await this.prisma.alumniEvent.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        ...dates,
        venue: dto.venue?.trim() ?? '',
        meetingUrl: dto.meetingUrl?.trim() ?? '',
        capacity: dto.capacity ?? null,
        audience: this.audienceJson(dto.audience),
        createdById: actorUserId,
        updatedById: actorUserId,
      },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.event.create',
      'AlumniEvent',
      row.id,
    );
    return this.eventView(row, []);
  }

  async updateEvent(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateEventDto,
  ) {
    const current = await this.requireEvent(tenantId, id);
    if (current.status === 'cancelled')
      throw new BadRequestException('A cancelled event cannot be edited.');
    const dates = this.eventDates(
      dto.startsAt ?? current.startsAt.toISOString(),
      dto.endsAt ?? current.endsAt?.toISOString(),
      dto.rsvpBy ?? current.rsvpBy?.toISOString(),
    );
    const row = await this.prisma.alumniEvent.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        ...dates,
        venue: dto.venue?.trim(),
        meetingUrl: dto.meetingUrl?.trim(),
        capacity: dto.capacity,
        audience: dto.audience ? this.audienceJson(dto.audience) : undefined,
        updatedById: actorUserId,
      },
      include: { rsvps: { select: { response: true } } },
    });
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.event.update',
      'AlumniEvent',
      id,
    );
    return this.eventView(row, row.rsvps);
  }

  async publishEvent(tenantId: string, actorUserId: string, id: string) {
    const current = await this.requireEvent(tenantId, id);
    if (current.status !== 'draft')
      throw new BadRequestException('Only a draft event can be published.');
    if (current.startsAt <= new Date())
      throw new BadRequestException('The event start time has already passed.');
    const row = await this.prisma.alumniEvent.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        updatedById: actorUserId,
      },
    });
    const when = row.startsAt.toUTCString();
    const where = [row.venue, row.meetingUrl].filter(Boolean).join(' · ');
    const body = [
      row.description,
      '',
      `When: ${when}`,
      ...(where ? [`Where: ${where}`] : []),
    ].join('\n');
    const emailed = await this.broadcast(
      tenantId,
      readAudience(row.audience),
      `Alumni event: ${row.title}`,
      body,
      '/events',
    );
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.event.publish',
      'AlumniEvent',
      id,
      { emailed },
    );
    return { ...this.eventView(row, []), emailed };
  }

  /** Tells everyone who said going or maybe, if they may still be contacted. */
  async cancelEvent(tenantId: string, actorUserId: string, id: string) {
    const current = await this.requireEvent(tenantId, id);
    if (current.status === 'cancelled') return this.eventView(current, []);
    const row = await this.prisma.alumniEvent.update({
      where: { id },
      data: { status: 'cancelled', updatedById: actorUserId },
      include: {
        rsvps: {
          where: { response: { in: ['going', 'maybe'] } },
          include: { alumni: { include: { account: true } } },
        },
      },
    });
    if (current.status === 'published') {
      for (const rsvp of row.rsvps) {
        const account = rsvp.alumni.account;
        if (
          account?.status === 'active' &&
          rsvp.alumni.eligibility === 'eligible'
        ) {
          await this.mail.eventCancelled(
            account.email,
            rsvp.alumni.fullName,
            row.title,
          );
        }
      }
    }
    await this.support.audit(
      this.prisma,
      tenantId,
      { type: 'hr', userId: actorUserId },
      'alumni.event.cancel',
      'AlumniEvent',
      id,
    );
    return this.eventView(row, row.rsvps);
  }

  async eventRsvps(tenantId: string, id: string) {
    await this.requireEvent(tenantId, id);
    const rows = await this.prisma.alumniEventRsvp.findMany({
      where: { eventId: id },
      include: {
        alumni: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            departmentName: true,
          },
        },
      },
      orderBy: { respondedAt: 'asc' },
    });
    return rows.map((row) => ({
      alumni: row.alumni,
      response: row.response,
      note: row.note,
      respondedAt: row.updatedAt.toISOString(),
    }));
  }

  // ─── Alumnus ───────────────────────────────────────────────────────────────

  async announcementsFor(principal: AlumniPrincipal) {
    const person = await this.person(principal.alumniId);
    const rows = await this.prisma.alumniAnnouncement.findMany({
      where: { tenantId: principal.tenantId, status: 'published' },
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });
    return rows
      .filter((row) => audienceMatches(readAudience(row.audience), person))
      .slice(0, 50)
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        publishedAt: row.publishedAt?.toISOString() ?? null,
      }));
  }

  async eventsFor(principal: AlumniPrincipal) {
    const person = await this.person(principal.alumniId);
    const since = new Date(Date.now() - PAST_EVENTS_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.alumniEvent.findMany({
      where: {
        tenantId: principal.tenantId,
        startsAt: { gte: since },
        OR: [
          { status: 'published' },
          // A cancelled event stays visible to people who had answered it.
          {
            status: 'cancelled',
            rsvps: { some: { alumniId: principal.alumniId } },
          },
        ],
      },
      include: {
        rsvps: { select: { response: true, alumniId: true, note: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
    return rows
      .filter((row) => audienceMatches(readAudience(row.audience), person))
      .map((row) => this.portalEventView(row, principal.alumniId));
  }

  async rsvp(principal: AlumniPrincipal, eventId: string, dto: RsvpDto) {
    const event = await this.prisma.alumniEvent.findFirst({
      where: { id: eventId, tenantId: principal.tenantId, status: 'published' },
      include: {
        rsvps: { select: { response: true, alumniId: true, note: true } },
      },
    });
    const person = await this.person(principal.alumniId);
    if (!event || !audienceMatches(readAudience(event.audience), person))
      throw new NotFoundException('Event not found.');
    const now = new Date();
    if (event.startsAt <= now)
      throw new BadRequestException('This event has already started.');
    if (event.rsvpBy && event.rsvpBy < now)
      throw new BadRequestException('Replies for this event have closed.');
    if (dto.response === 'going' && event.capacity) {
      const going = event.rsvps.filter(
        (row) =>
          row.response === 'going' && row.alumniId !== principal.alumniId,
      ).length;
      if (going >= event.capacity)
        throw new BadRequestException('This event is full.');
    }
    await this.prisma.alumniEventRsvp.upsert({
      where: { eventId_alumniId: { eventId, alumniId: principal.alumniId } },
      create: {
        eventId,
        alumniId: principal.alumniId,
        response: dto.response,
        note: dto.note?.trim() ?? '',
      },
      update: { response: dto.response, note: dto.note?.trim() ?? '' },
    });
    await this.support.audit(
      this.prisma,
      principal.tenantId,
      { type: 'alumni', alumniId: principal.alumniId },
      'alumni.event.rsvp',
      'AlumniEvent',
      eventId,
      { response: dto.response },
    );
    const fresh = await this.prisma.alumniEvent.findUniqueOrThrow({
      where: { id: eventId },
      include: {
        rsvps: { select: { response: true, alumniId: true, note: true } },
      },
    });
    return this.portalEventView(fresh, principal.alumniId);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Emails eligible, active alumni in the audience who agreed to communications. */
  private async broadcast(
    tenantId: string,
    audience: Audience,
    subject: string,
    body: string,
    pathname: string,
  ) {
    const people = await this.prisma.alumni.findMany({
      where: {
        tenantId,
        eligibility: 'eligible',
        account: { is: { status: 'active', communicationsConsent: true } },
      },
      include: { account: { select: { email: true } } },
    });
    let sent = 0;
    for (const person of people) {
      if (!person.account || !audienceMatches(audience, person)) continue;
      if (
        await this.mail.broadcast(
          person.account.email,
          person.fullName,
          subject,
          body,
          pathname,
        )
      )
        sent += 1;
    }
    return sent;
  }

  private async person(alumniId: string): Promise<Person> {
    return this.prisma.alumni.findUniqueOrThrow({
      where: { id: alumniId },
      select: {
        departmentName: true,
        locationName: true,
        joiningDate: true,
        lastWorkingDay: true,
      },
    });
  }

  private audienceJson(dto: AudienceDto | undefined): Prisma.InputJsonObject {
    const audience = readAudience(dto ?? {});
    return {
      departments: [
        ...new Set(audience.departments!.map((item) => item.trim())),
      ],
      exitYears: [...new Set(audience.exitYears)],
      joinYears: [...new Set(audience.joinYears)],
      locations: [...new Set(audience.locations!.map((item) => item.trim()))],
    };
  }

  private eventDates(
    startsAtRaw: string,
    endsAtRaw?: string,
    rsvpByRaw?: string,
  ) {
    const startsAt = new Date(startsAtRaw);
    const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
    const rsvpBy = rsvpByRaw ? new Date(rsvpByRaw) : null;
    if (endsAt && endsAt < startsAt)
      throw new BadRequestException('The event ends before it starts.');
    if (rsvpBy && rsvpBy > startsAt)
      throw new BadRequestException(
        'The reply deadline must be before the event starts.',
      );
    return { startsAt, endsAt, rsvpBy };
  }

  private async requireAnnouncement(tenantId: string, id: string) {
    const row = await this.prisma.alumniAnnouncement.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Post not found.');
    return row;
  }

  private async requireEvent(tenantId: string, id: string) {
    const row = await this.prisma.alumniEvent.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Event not found.');
    return row;
  }

  private announcementView(row: AlumniAnnouncement) {
    const audience = readAudience(row.audience);
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      audience,
      audienceLabel: describeAudience(audience),
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private eventView(row: AlumniEvent, rsvps: { response: string }[]) {
    const audience = readAudience(row.audience);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      venue: row.venue,
      meetingUrl: row.meetingUrl,
      capacity: row.capacity,
      rsvpBy: row.rsvpBy?.toISOString() ?? null,
      audience,
      audienceLabel: describeAudience(audience),
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      counts: {
        going: rsvps.filter((rsvp) => rsvp.response === 'going').length,
        maybe: rsvps.filter((rsvp) => rsvp.response === 'maybe').length,
        declined: rsvps.filter((rsvp) => rsvp.response === 'declined').length,
      },
    };
  }

  private portalEventView(
    row: AlumniEvent & {
      rsvps: { response: string; alumniId: string; note: string }[];
    },
    alumniId: string,
  ) {
    const mine = row.rsvps.find((rsvp) => rsvp.alumniId === alumniId);
    const going = row.rsvps.filter((rsvp) => rsvp.response === 'going').length;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      venue: row.venue,
      meetingUrl: row.meetingUrl,
      rsvpBy: row.rsvpBy?.toISOString() ?? null,
      status: row.status,
      going,
      spotsLeft: row.capacity ? Math.max(0, row.capacity - going) : null,
      myResponse: mine?.response ?? null,
      myNote: mine?.note ?? '',
    };
  }
}
