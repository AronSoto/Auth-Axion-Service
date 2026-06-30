import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  Type,
  mixin,
} from '@nestjs/common';
import { AuthGuard, IAuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import type { Request, Response } from 'express';

import { AppConfigService } from '@/config/app-config.service';

import { issueOAuthState, verifyOAuthState } from './oauth-state';

/**
 * Builds a passport OAuth guard that:
 *   - 503s when the provider isn't configured,
 *   - issues a CSRF `state` cookie when starting the flow,
 *   - verifies that cookie against the callback's `state` before the token swap.
 */
export function createOAuthGuard(
  strategy: string,
  providerName: string,
  isConfigured: (config: AppConfigService) => boolean,
): Type<IAuthGuard> {
  @Injectable()
  class OAuthGuardMixin extends AuthGuard(strategy) {
    constructor(private readonly config: AppConfigService) {
      super();
    }

    canActivate(context: ExecutionContext) {
      if (!isConfigured(this.config)) {
        throw new ServiceUnavailableException(
          `${providerName} OAuth is not configured`,
        );
      }
      const { req, res } = this.http(context);
      if (this.isCallback(req)) {
        verifyOAuthState(req, res, this.config.isProduction);
      }
      return super.canActivate(context);
    }

    getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
      const { req, res } = this.http(context);
      if (this.isCallback(req)) return {};
      return { state: issueOAuthState(res, this.config.isProduction) };
    }

    private http(context: ExecutionContext): { req: Request; res: Response } {
      const ctx = context.switchToHttp();
      return {
        req: ctx.getRequest<Request>(),
        res: ctx.getResponse<Response>(),
      };
    }

    private isCallback(req: Request): boolean {
      return req.path.endsWith('/callback');
    }
  }

  return mixin(OAuthGuardMixin);
}
