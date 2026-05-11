import { AuthProvider, User } from '@prisma/client';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface OAuthProfile {
  provider: AuthProvider;
  providerAccountId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  accessToken?: string;
  refreshToken?: string;
}

export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'role'>;
