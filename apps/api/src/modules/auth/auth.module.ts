import { Module, type Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AppConfigModule } from '@/config/app-config.module';
import { AppConfigService } from '@/config/app-config.service';
import {
  isGithubOAuthConfigured,
  isGoogleOAuthConfigured,
} from '@/config/oauth-env';
import { UsersModule } from '@/modules/users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { TokenService } from './token.service';

// Strategies are eager — only register the ones with credentials.
const oauthStrategies: Provider[] = [
  ...(isGoogleOAuthConfigured() ? [GoogleStrategy] : []),
  ...(isGithubOAuthConfigured() ? [GithubStrategy] : []),
];

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwt.accessSecret,
        signOptions: {
          expiresIn: config.jwt.accessExpiresIn,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    LocalStrategy,
    JwtStrategy,
    ...oauthStrategies,
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
