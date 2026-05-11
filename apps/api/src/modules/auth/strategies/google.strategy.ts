import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from '@prisma/client';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

import { AppConfigService } from '@/config/app-config.service';

import { OAuthProfile } from '../auth.types';

const PLACEHOLDER = 'NOT_CONFIGURED';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(config: AppConfigService) {
    const { clientId, clientSecret, callbackUrl } = config.google;
    super({
      clientID: clientId ?? PLACEHOLDER,
      clientSecret: clientSecret ?? PLACEHOLDER,
      callbackURL:
        callbackUrl ?? 'http://localhost:3000/api/auth/google/callback',
      scope: ['email', 'profile'],
    });

    if (!config.isGoogleConfigured) {
      this.logger.warn(
        'Google OAuth env vars are missing — /auth/google will fail until configured.',
      );
    }
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google profile missing email'), false);
      return;
    }

    const oauthProfile: OAuthProfile = {
      provider: AuthProvider.GOOGLE,
      providerAccountId: profile.id,
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      emailVerified: profile.emails?.[0]?.verified === true,
      accessToken,
      refreshToken,
    };
    done(null, oauthProfile);
  }
}
