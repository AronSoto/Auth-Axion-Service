import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from '@prisma/client';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

import { AppConfigService } from '@/config/app-config.service';

import { OAuthProfile } from '../auth.types';

// Registered only when Google OAuth env is configured (see AuthModule).
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: AppConfigService) {
    const { clientId, clientSecret, callbackUrl } = config.google;
    super({
      clientID: clientId!,
      clientSecret: clientSecret!,
      callbackURL: callbackUrl!,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
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
    };
    done(null, oauthProfile);
  }
}
