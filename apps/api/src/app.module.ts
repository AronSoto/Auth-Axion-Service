import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { TokensCleanupModule } from './modules/tokens-cleanup/tokens-cleanup.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [
        {
          ttl: config.throttle.ttl * 1000,
          limit: config.throttle.limit,
        },
      ],
    }),
    PrismaModule,
    MailModule,
    UsersModule,
    AuthModule,
    HealthModule,
    TokensCleanupModule,
  ],
  providers: [
    // Order matters: rate-limit before authentication.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Secure-by-default: every endpoint requires JWT unless decorated with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
