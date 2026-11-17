import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Alumni emails over the same SMTP settings as MailService (SMTP_HOST, SMTP_PORT,
 * SMTP_FROM), kept separate so the existing mail service is not changed.
 */
@Injectable()
export class AlumniMailService {
  private readonly logger = new Logger(AlumniMailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Link into the alumni portal; ALUMNI_PORTAL_URL, else WEB_ORIGIN, else the local web app. */
  portalUrl(pathname = '') {
    const base =
      this.config.get<string>('ALUMNI_PORTAL_URL') ??
      this.config.get<string>('WEB_ORIGIN') ??
      'http://localhost:5173';
    return `${base.replace(/\/+$/, '')}/alumni${pathname}`;
  }

  invitation(to: string, name: string, token: string, expiresAt: Date) {
    // The token travels in the URL fragment, which browsers never send to a server.
    const link = this.portalUrl(`/register#token=${encodeURIComponent(token)}`);
    return this.send(to, 'You are invited to the PeopleOS alumni network', [
      `Hello ${name},`,
      '',
      'You are invited to join the alumni network of your former employer on PeopleOS.',
      'Use this one-time link to verify your email and create your alumni login:',
      '',
      link,
      '',
      `The link works once and expires on ${expiresAt.toUTCString()}.`,
      'If you did not expect this email, you can ignore it.',
    ]);
  }

  otp(to: string, purpose: 'password_reset' | 'email_change', code: string) {
    const subject =
      purpose === 'password_reset'
        ? 'Your alumni password reset code'
        : 'Confirm your new alumni login email';
    const intro =
      purpose === 'password_reset'
        ? 'You asked to reset the password of your alumni login.'
        : 'You asked to use this address for your alumni login.';
    return this.send(to, subject, [
      intro,
      '',
      `Your one-time code is: ${code}`,
      '',
      'The code expires in 10 minutes. If this was not you, you can ignore this email.',
    ]);
  }

  requestUpdate(
    to: string,
    name: string,
    documentLabel: string,
    outcome: string,
    note: string,
  ) {
    return this.send(to, `Your ${documentLabel} request was ${outcome}`, [
      `Hello ${name},`,
      '',
      `Your request for a ${documentLabel} was ${outcome}.`,
      ...(note ? ['', `Note from HR: ${note}`] : []),
      '',
      `See it in the alumni portal: ${this.portalUrl('/documents')}`,
    ]);
  }

  documentIssued(to: string, name: string, title: string) {
    return this.send(to, `Your document is ready: ${title}`, [
      `Hello ${name},`,
      '',
      `HR has issued "${title}". You can download it from your alumni documents:`,
      this.portalUrl('/documents'),
    ]);
  }

  broadcast(
    to: string,
    name: string,
    subject: string,
    body: string,
    pathname: string,
  ) {
    return this.send(to, subject, [
      `Hello ${name},`,
      '',
      body,
      '',
      `Read more in the alumni portal: ${this.portalUrl(pathname)}`,
      '',
      'You get these emails because you agreed to alumni communications. You can turn them off under Privacy in the portal.',
    ]);
  }

  eventCancelled(to: string, name: string, title: string) {
    return this.send(to, `Cancelled: ${title}`, [
      `Hello ${name},`,
      '',
      `The alumni event "${title}" has been cancelled. Sorry for the change of plans.`,
    ]);
  }

  /** Never throws: a mail outage must not undo HR or alumni actions. Returns whether it was sent. */
  private async send(to: string, subject: string, lines: string[]) {
    const from =
      this.config.get<string>('SMTP_FROM') ??
      'PeopleOS <noreply@peopleos.local>';
    try {
      const info = await this.getTransporter().sendMail({
        from,
        to,
        subject: subject.replace(/[\r\n]+/g, ' '),
        text: lines.join('\n'),
      });
      this.logger.log(
        `Alumni mail "${subject}" sent to ${to} id=${info.messageId}`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Alumni mail "${subject}" to ${to} failed`,
        err as Error,
      );
      return false;
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? 'localhost',
      port: Number(this.config.get('SMTP_PORT') ?? 1025),
      secure: false,
      tls: { rejectUnauthorized: false },
    });
    return this.transporter;
  }
}
