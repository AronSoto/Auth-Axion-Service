import { AuthProvider, UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface JwtAccessPayload {
  sub: string;
  type: 'access';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

// Per-request device context, attached to refresh tokens for session visibility.
export interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionInfo {
  id: string;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
  // True for the session making the request (matched by refresh-cookie hash).
  current: boolean;
}

export interface OAuthProfile {
  provider: AuthProvider;
  providerAccountId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailVerified: boolean;
}
