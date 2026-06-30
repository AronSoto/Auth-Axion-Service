import { Injectable, Logger } from '@nestjs/common';
import { SecurityEventType } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

import { RequestMetadata } from '../auth/auth.types';

interface RecordInput {
  type: SecurityEventType;
  userId?: string | null;
  email?: string | null;
  metadata?: RequestMetadata;
  detail?: string;
}

/**
 * Append-only security audit trail. Writes are fire-and-forget: auditing must
 * never break or slow down the auth flow it observes.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordInput): void {
    void this.prisma.securityEvent
      .create({
        data: {
          type: input.type,
          userId: input.userId ?? null,
          email: input.email ?? null,
          ipAddress: input.metadata?.ipAddress,
          userAgent: input.metadata?.userAgent,
          detail: input.detail,
        },
      })
      .catch((err) => {
        this.logger.error(
          `Failed to record security event ${input.type}`,
          err instanceof Error ? err.stack : String(err),
        );
      });
  }
}
