import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { AppConfigService } from '@/config/app-config.service';

// Translates OAuth-callback failures (passport guard OR controller body)
// into a frontend redirect so users never see raw JSON.
@Catch()
export class OAuthCallbackFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthCallbackFilter.name);

  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const message = exception instanceof Error ? exception.message : 'unknown';
    this.logger.warn(`OAuth callback failed: ${message}`);
    const reason = /not verified by the provider/i.test(message)
      ? 'oauth_unverified'
      : /disabled/i.test(message)
        ? 'oauth_disabled'
        : 'oauth_failed';
    res.redirect(
      `${this.config.frontendUrl}/auth/oauth-callback?error=${reason}`,
    );
  }
}
