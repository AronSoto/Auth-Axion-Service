import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '@/prisma/prisma.service';

const REFRESH_TOKEN_RETENTION_DAYS = 30;
const VERIFICATION_TOKEN_RETENTION_DAYS = 7;

@Injectable()
export class TokensCleanupService {
  private readonly logger = new Logger(TokensCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'tokens-cleanup' })
  async run(): Promise<void> {
    const refreshCutoff = new Date(
      Date.now() - REFRESH_TOKEN_RETENTION_DAYS * 86_400_000,
    );
    const verificationCutoff = new Date(
      Date.now() - VERIFICATION_TOKEN_RETENTION_DAYS * 86_400_000,
    );

    const [refresh, verification] = await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: refreshCutoff } },
      }),
      this.prisma.verificationToken.deleteMany({
        where: { expiresAt: { lt: verificationCutoff } },
      }),
    ]);

    this.logger.log(
      `Cleaned ${refresh.count} refresh + ${verification.count} verification tokens`,
    );
  }
}
