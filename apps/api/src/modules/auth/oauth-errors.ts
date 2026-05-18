import { UnauthorizedException } from '@nestjs/common';

// Codes the frontend understands. Map 1:1 to the ERROR_MESSAGES table in
// apps/web/src/app/page.tsx, so any change here needs a matching change there.
export const OAUTH_ERROR_CODES = {
  unverified: 'oauth_unverified',
  disabled: 'oauth_disabled',
  failed: 'oauth_failed',
} as const;

export type OAuthErrorCode =
  (typeof OAUTH_ERROR_CODES)[keyof typeof OAUTH_ERROR_CODES];

interface OAuthErrorBody {
  message: string;
  code: OAuthErrorCode;
}

export class OAuthException extends UnauthorizedException {
  readonly code: OAuthErrorCode;

  constructor(code: OAuthErrorCode, message: string) {
    super({ message, code } satisfies OAuthErrorBody);
    this.code = code;
  }
}
