import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>('SMTP_HOST') ?? 'localhost';
    const port = Number(this.config.get('SMTP_PORT') ?? 1025);
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      tls: { rejectUnauthorized: false },
    });
    return this.transporter;
  }

  async sendPasswordResetOtp(to: string, otp: string) {
    const from =
      this.config.get<string>('SMTP_FROM') ?? 'PeopleOS <noreply@peopleos.local>';
    const subject = 'PeopleOS password reset code';
    const text = [
      'You requested a password reset for PeopleOS.',
      '',
      `Your one-time code is: ${otp}`,
      '',
      'This code expires in 10 minutes. If you did not request a reset, you can ignore this email.',
    ].join('\n');

    try {
      const info = await this.getTransporter().sendMail({
        from,
        to,
        subject,
        text,
      });
      this.logger.log(`Password reset OTP mailed to ${to} id=${info.messageId}`);
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${to}`, err);
      throw err;
    }
  }
}
