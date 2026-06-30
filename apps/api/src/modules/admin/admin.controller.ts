import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SecurityEvent, UserRole } from '@prisma/client';

import { Roles } from '@/common/decorators/roles.decorator';
import { PrismaService } from '@/prisma/prisma.service';

interface AdminStats {
  users: number;
  activeSessions: number;
  pendingVerifications: number;
}

const SECURITY_EVENTS_LIMIT = 100;

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Operational counters (admin only)' })
  async stats(): Promise<AdminStats> {
    const [users, activeSessions, pendingVerifications] =
      await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.refreshToken.count({
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
        }),
        this.prisma.verificationToken.count({
          where: { consumedAt: null, expiresAt: { gt: new Date() } },
        }),
      ]);
    return { users, activeSessions, pendingVerifications };
  }

  @Get('security-events')
  @ApiOperation({ summary: 'Recent security audit events (admin only)' })
  securityEvents(): Promise<SecurityEvent[]> {
    return this.prisma.securityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: SECURITY_EVENTS_LIMIT,
    });
  }
}
