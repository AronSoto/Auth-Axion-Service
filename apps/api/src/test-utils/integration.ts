import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import type ms from 'ms';

import { AppConfigModule } from '@/config/app-config.module';
import { AppConfigService } from '@/config/app-config.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaService } from '@/prisma/prisma.service';

// Minimal Nest module against the real dev DB; tests must run --runInBand.
export async function buildIntegrationModule(
  providers: NonNullable<
    Parameters<typeof Test.createTestingModule>[0]
  >['providers'] = [],
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env'] }),
      AppConfigModule,
      PrismaModule,
      JwtModule.registerAsync({
        global: true,
        inject: [AppConfigService],
        useFactory: (config: AppConfigService) => ({
          secret: config.jwt.accessSecret,
          signOptions: {
            expiresIn: config.jwt.accessExpiresIn as ms.StringValue,
          },
        }),
      }),
    ],
    providers,
  }).compile();
}

export async function truncateAuthTables(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "verification_tokens", "refresh_tokens", "accounts", "users" RESTART IDENTITY CASCADE',
  );
}
