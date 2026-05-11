import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthProvider } from '@prisma/client';
import { Profile, Strategy } from 'passport-github2';

import { AppConfigService } from '@/config/app-config.service';

import { OAuthProfile } from '../auth.types';

type GithubVerifyCallback = (
  err: Error | null,
  user?: OAuthProfile | false,
) => void;
const PLACEHOLDER = 'NOT_CONFIGURED';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GithubStrategy.name);

  constructor(config: AppConfigService) {
    const { clientId, clientSecret, callbackUrl } = config.github;
    super({
      clientID: clientId ?? PLACEHOLDER,
      clientSecret: clientSecret ?? PLACEHOLDER,
      callbackURL:
        callbackUrl ?? 'http://localhost:3000/api/auth/github/callback',
      scope: ['user:email'],
    });

    if (!config.isGithubConfigured) {
      this.logger.warn(
        'GitHub OAuth env vars are missing — /auth/github will fail until configured.',
      );
    }
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: GithubVerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(
        new Error(
          'GitHub profile missing email — ensure user:email scope is granted',
        ),
      );
      return;
    }

    const oauthProfile: OAuthProfile = {
      provider: AuthProvider.GITHUB,
      providerAccountId: profile.id,
      email,
      name: profile.displayName ?? profile.username,
      avatarUrl: profile.photos?.[0]?.value,
      emailVerified: true, // GitHub returns only verified emails when scope=user:email
      accessToken,
      refreshToken,
    };
    done(null, oauthProfile);
  }
}
