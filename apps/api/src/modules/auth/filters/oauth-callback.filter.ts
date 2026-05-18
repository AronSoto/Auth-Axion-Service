import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';

import { AppConfigService } from '@/config/app-config.service';

// Translates OAuth-callback failures into a frontend redirect.
@Catch()
export class OAuthCallbackFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthCallbackFilter.name);

  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const message = exception instanceof Error ? exception.message : 'unknown';
    this.logger.warn(`OAuth callback failed: ${message}`);
    res.redirect(
      `${this.config.frontendUrl}/auth/oauth-callback?error=oauth_failed`,
    );
  }
}
