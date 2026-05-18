import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from '@prisma/client';
import { Profile, Strategy } from 'passport-github2';

import { AppConfigService } from '@/config/app-config.service';

import { OAuthProfile } from '../auth.types';
import { OAUTH_ERROR_CODES, OAuthException } from '../oauth-errors';

type GithubVerifyCallback = (
  err: Error | null,
  user?: OAuthProfile | false,
) => void;

// Registered only when GitHub OAuth env is configured (see AuthModule).
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: AppConfigService) {
    const { clientId, clientSecret, callbackUrl } = config.github;
    super({
      clientID: clientId!,
      clientSecret: clientSecret!,
      callbackURL: callbackUrl!,
      scope: ['user:email'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: GithubVerifyCallback,
  ): void {
    // Pick only emails GitHub flagged verified.
    const verifiedEmail = profile.emails?.find(
      (e) => (e as { verified?: boolean }).verified === true,
    )?.value;

    if (!verifiedEmail) {
      done(
        new OAuthException(
          OAUTH_ERROR_CODES.unverified,
          'GitHub profile has no verified email — user must verify their GitHub email first',
        ),
      );
      return;
    }

    const oauthProfile: OAuthProfile = {
      provider: AuthProvider.GITHUB,
      providerAccountId: profile.id,
      email: verifiedEmail,
      name: profile.displayName ?? profile.username,
      avatarUrl: profile.photos?.[0]?.value,
      emailVerified: true,
      accessToken,
      refreshToken,
    };
    done(null, oauthProfile);
  }
}
