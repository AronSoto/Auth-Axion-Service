import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import type ms from 'ms';

import { AppConfigModule } from '@/config/app-config.module';
import { AppConfigService } from '@/config/app-config.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaService } from '@/prisma/prisma.service';

const LOCAL_DB_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'db', // docker-compose service name
  'postgres', // docker-compose service name
]);

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const host = new URL(url).hostname;
  if (LOCAL_DB_HOSTS.has(host)) return;

  throw new Error(
    `Refusing to truncate: DATABASE_URL host "${host}" is not local`,
  );
}

// Minimal Nest module against the real dev DB; tests must run --runInBand.
export async function buildIntegrationModule(
  providers: NonNullable<
    Parameters<typeof Test.createTestingModule>[0]
  >['providers'] = [],
): Promise<TestingModule> {
  assertLocalDatabase();
  const moduleRef = await Test.createTestingModule({
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
  await moduleRef.init();
  return moduleRef;
}

export async function truncateAuthTables(prisma: PrismaService): Promise<void> {
  assertLocalDatabase();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "verification_tokens", "refresh_tokens", "accounts", "users" RESTART IDENTITY CASCADE',
  );
}
