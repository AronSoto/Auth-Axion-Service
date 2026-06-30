import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggerModule } from './common/logging/logger.module';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { TokensCleanupModule } from './modules/tokens-cleanup/tokens-cleanup.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

// Read at boot — DI not available when imports[] is evaluated.
const cronEnabled = process.env.ENABLE_CRON !== 'false';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    ...(cronEnabled ? [ScheduleModule.forRoot(), TokensCleanupModule] : []),
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
    AdminModule,
  ],
  providers: [
    // Order matters: rate-limit -> authn -> authz.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
