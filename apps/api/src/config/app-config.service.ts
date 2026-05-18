import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Env } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }
  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get apiPort(): number {
    return this.get('API_PORT');
  }
  get apiUrl(): string {
    return this.get('API_URL');
  }
  get frontendUrl(): string {
    return this.get('FRONTEND_URL');
  }
  get throttle(): { ttl: number; limit: number } {
    return { ttl: this.get('THROTTLE_TTL'), limit: this.get('THROTTLE_LIMIT') };
  }

  get requireEmailVerification(): boolean {
    return this.get('REQUIRE_EMAIL_VERIFICATION');
  }

  get enableCron(): boolean {
    return this.get('ENABLE_CRON');
  }

  get jwt(): {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  } {
    return {
      accessSecret: this.get('JWT_ACCESS_SECRET'),
      accessExpiresIn: this.get('JWT_ACCESS_EXPIRES_IN'),
      refreshSecret: this.get('JWT_REFRESH_SECRET'),
      refreshExpiresIn: this.get('JWT_REFRESH_EXPIRES_IN'),
    };
  }

  get google(): {
    clientId?: string;
    clientSecret?: string;
    callbackUrl?: string;
  } {
    return {
      clientId: this.get('GOOGLE_CLIENT_ID'),
      clientSecret: this.get('GOOGLE_CLIENT_SECRET'),
      callbackUrl: this.get('GOOGLE_CALLBACK_URL'),
    };
  }

  get github(): {
    clientId?: string;
    clientSecret?: string;
    callbackUrl?: string;
  } {
    return {
      clientId: this.get('GITHUB_CLIENT_ID'),
      clientSecret: this.get('GITHUB_CLIENT_SECRET'),
      callbackUrl: this.get('GITHUB_CALLBACK_URL'),
    };
  }

  get mail(): {
    driver: 'smtp' | 'resend';
    from: string;
    smtp: { host?: string; port?: number; user?: string; pass?: string };
    resendApiKey?: string;
  } {
    return {
      driver: this.get('MAIL_DRIVER'),
      from: this.get('MAIL_FROM'),
      smtp: {
        host: this.get('MAIL_SMTP_HOST'),
        port: this.get('MAIL_SMTP_PORT'),
        user: this.get('MAIL_SMTP_USER'),
        pass: this.get('MAIL_SMTP_PASS'),
      },
      resendApiKey: this.get('RESEND_API_KEY'),
    };
  }

  get isGoogleConfigured(): boolean {
    const g = this.google;
    return Boolean(g.clientId && g.clientSecret && g.callbackUrl);
  }

  get isGithubConfigured(): boolean {
    const g = this.github;
    return Boolean(g.clientId && g.clientSecret && g.callbackUrl);
  }
}
