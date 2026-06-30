import { randomBytes } from 'crypto';

import type { CookieOptions, Request, Response } from 'express';

import { OAUTH_ERROR_CODES, OAuthException } from '../oauth-errors';

const STATE_COOKIE = 'oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 min

const cookieAttrs = (isProduction: boolean): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  // Lax is enough: the provider redirects back via a top-level GET navigation.
  sameSite: 'lax',
  path: '/api/auth',
});

// Issue a CSRF state token and remember it in a short-lived cookie.
export function issueOAuthState(res: Response, isProduction: boolean): string {
  const state = randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    ...cookieAttrs(isProduction),
    maxAge: STATE_TTL_MS,
  });
  return state;
}

// Verify the callback's state matches the cookie. One-time use: always cleared.
export function verifyOAuthState(
  req: Request,
  res: Response,
  isProduction: boolean,
): void {
  const cookies = req.cookies as Record<string, string> | undefined;
  const expected = cookies?.[STATE_COOKIE];
  const received =
    typeof req.query.state === 'string' ? req.query.state : undefined;

  res.clearCookie(STATE_COOKIE, cookieAttrs(isProduction));

  if (!expected || !received || expected !== received) {
    throw new OAuthException(OAUTH_ERROR_CODES.failed, 'Invalid OAuth state');
  }
}
