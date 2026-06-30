import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '@/prisma/prisma.service';

const DAY_MS = 86_400_000;
const REFRESH_TOKEN_RETENTION_DAYS = 30;
const VERIFICATION_TOKEN_RETENTION_DAYS = 7;
// Revoked rows past their useful "audit chain" window. Short because a
// revoked token cannot rotate again — keeping it only helps reuse-detection
// for the brief period after revocation.
const REVOKED_REFRESH_RETENTION_DAYS = 7;

@Injectable()
export class TokensCleanupService {
  private readonly logger = new Logger(TokensCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'tokens-cleanup' })
  async run(): Promise<void> {
    const now = Date.now();
    const refreshCutoff = new Date(now - REFRESH_TOKEN_RETENTION_DAYS * DAY_MS);
    const revokedCutoff = new Date(
      now - REVOKED_REFRESH_RETENTION_DAYS * DAY_MS,
    );
    const verificationCutoff = new Date(
      now - VERIFICATION_TOKEN_RETENTION_DAYS * DAY_MS,
    );

    const [refresh, revoked, verification] = await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: refreshCutoff } },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { revokedAt: { lt: revokedCutoff } },
      }),
      this.prisma.verificationToken.deleteMany({
        where: { expiresAt: { lt: verificationCutoff } },
      }),
    ]);

    this.logger.log(
      `Cleaned ${refresh.count} expired + ${revoked.count} revoked refresh tokens, ${verification.count} verification tokens`,
    );
  }
}
