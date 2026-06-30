import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { AppConfigService } from '@/config/app-config.service';

import {
  OAUTH_ERROR_CODES,
  OAuthException,
  type OAuthErrorCode,
} from '../oauth-errors';

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

    const code: OAuthErrorCode =
      exception instanceof OAuthException
        ? exception.code
        : OAUTH_ERROR_CODES.failed;

    res.redirect(
      `${this.config.frontendUrl}/auth/oauth-callback?error=${code}`,
    );
  }
}
