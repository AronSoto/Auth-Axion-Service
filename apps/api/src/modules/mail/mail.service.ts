import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { Resend } from 'resend';

import { AppConfigService } from '@/config/app-config.service';

import {
  RenderedEmail,
  passwordResetTemplate,
  verifyEmailTemplate,
} from './templates';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private smtp?: Transporter;
  private resend?: Resend;

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    const { driver, smtp, resendApiKey } = this.config.mail;

    if (driver === 'smtp') {
      if (!smtp.host || !smtp.port) {
        this.logger.warn(
          'MAIL_DRIVER=smtp but SMTP creds missing — emails will be logged only.',
        );
        return;
      }
      this.smtp = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        auth:
          smtp.user && smtp.pass
            ? { user: smtp.user, pass: smtp.pass }
            : undefined,
      });
      return;
    }

    if (driver === 'resend') {
      if (!resendApiKey) {
        this.logger.warn(
          'MAIL_DRIVER=resend but RESEND_API_KEY missing — emails will be logged only.',
        );
        return;
      }
      this.resend = new Resend(resendApiKey);
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = `${this.config.frontendUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
    await this.send(to, verifyEmailTemplate(url));
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const url = `${this.config.frontendUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
    await this.send(to, passwordResetTemplate(url));
  }

  private async send(to: string, email: RenderedEmail): Promise<void> {
    const from = this.config.mail.from;

    if (this.resend) {
      const result = await this.resend.emails.send({
        from,
        to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      if (result.error) {
        this.logger.error(`Resend send failed: ${result.error.message}`);
        throw new Error(`Failed to send email: ${result.error.message}`);
      }
      return;
    }

    if (this.smtp) {
      await this.smtp.sendMail({
        from,
        to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      return;
    }

    this.logger.warn(
      `[mail:dryrun] to=${to} subject="${email.subject}"\n${email.text}`,
    );
  }
}
