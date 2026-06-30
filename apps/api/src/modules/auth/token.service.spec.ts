import { createHash } from 'crypto';

import { UnauthorizedException } from '@nestjs/common';
import { VerificationTokenType } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import {
  buildIntegrationModule,
  truncateAuthTables,
} from '@/test-utils/integration';

import { AuditService } from '../audit/audit.service';
import { TokenService } from './token.service';

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

describe('TokenService (integration)', () => {
  let tokens: TokenService;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await buildIntegrationModule([
      TokenService,
      { provide: AuditService, useValue: { record: jest.fn() } },
    ]);
    tokens = moduleRef.get(TokenService);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAuthTables(prisma);
    const user = await prisma.user.create({
      data: { email: 'alice@test.dev' },
    });
    userId = user.id;
  });

  describe('refresh token rotation', () => {
    it('rotates: old token is revoked, new one is active, chain is linked', async () => {
      const { token: original } = await tokens.issueRefreshToken(userId);

      const { newToken } = await tokens.rotateRefreshToken(original);

      const oldRow = await prisma.refreshToken.findUnique({
        where: { tokenHash: hash(original) },
      });
      const newRow = await prisma.refreshToken.findUnique({
        where: { tokenHash: hash(newToken) },
      });

      expect(oldRow?.revokedAt).not.toBeNull();
      expect(oldRow?.replacedByHash).toBe(hash(newToken));
      expect(newRow?.revokedAt).toBeNull();
      expect(newRow?.userId).toBe(userId);
    });

    it('detects reuse: replaying a revoked token revokes the entire chain', async () => {
      const { token: t1 } = await tokens.issueRefreshToken(userId);
      const { newToken: t2 } = await tokens.rotateRefreshToken(t1);
      const { token: tIndependent } = await tokens.issueRefreshToken(userId);

      await expect(tokens.rotateRefreshToken(t1)).rejects.toThrow(
        UnauthorizedException,
      );

      const stillActive = await prisma.refreshToken.count({
        where: { userId, revokedAt: null },
      });
      expect(stillActive).toBe(0);

      await expect(tokens.rotateRefreshToken(t2)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(tokens.rotateRefreshToken(tIndependent)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an unknown token without touching the DB state', async () => {
      await expect(
        tokens.rotateRefreshToken('never-issued-token'),
      ).rejects.toThrow(UnauthorizedException);
      const count = await prisma.refreshToken.count();
      expect(count).toBe(0);
    });

    it('rejects an expired token', async () => {
      const { token } = await tokens.issueRefreshToken(userId);
      // Force the row's expiresAt into the past.
      await prisma.refreshToken.update({
        where: { tokenHash: hash(token) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(tokens.rotateRefreshToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revokeAllForUser', () => {
    it("revokes only the target user's active tokens", async () => {
      const other = await prisma.user.create({
        data: { email: 'bob@test.dev' },
      });
      await tokens.issueRefreshToken(userId);
      await tokens.issueRefreshToken(userId);
      await tokens.issueRefreshToken(other.id);

      await tokens.revokeAllForUser(userId);

      const aliceActive = await prisma.refreshToken.count({
        where: { userId, revokedAt: null },
      });
      const bobActive = await prisma.refreshToken.count({
        where: { userId: other.id, revokedAt: null },
      });
      expect(aliceActive).toBe(0);
      expect(bobActive).toBe(1);
    });
  });

  describe('verification tokens', () => {
    it('is single-use: a consumed token cannot be reused', async () => {
      const raw = await tokens.issueVerificationToken(
        userId,
        VerificationTokenType.EMAIL_VERIFICATION,
        60_000,
      );

      const first = await tokens.consumeVerificationToken(
        raw,
        VerificationTokenType.EMAIL_VERIFICATION,
      );
      expect(first.userId).toBe(userId);

      await expect(
        tokens.consumeVerificationToken(
          raw,
          VerificationTokenType.EMAIL_VERIFICATION,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a token of the wrong type', async () => {
      const raw = await tokens.issueVerificationToken(
        userId,
        VerificationTokenType.EMAIL_VERIFICATION,
        60_000,
      );

      await expect(
        tokens.consumeVerificationToken(
          raw,
          VerificationTokenType.PASSWORD_RESET,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      const raw = await tokens.issueVerificationToken(
        userId,
        VerificationTokenType.PASSWORD_RESET,
        60_000,
      );
      await prisma.verificationToken.update({
        where: { tokenHash: hash(raw) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(
        tokens.consumeVerificationToken(
          raw,
          VerificationTokenType.PASSWORD_RESET,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issuing a new token of the same type invalidates older outstanding ones', async () => {
      const first = await tokens.issueVerificationToken(
        userId,
        VerificationTokenType.EMAIL_VERIFICATION,
        60_000,
      );
      const second = await tokens.issueVerificationToken(
        userId,
        VerificationTokenType.EMAIL_VERIFICATION,
        60_000,
      );

      // First is auto-consumed by the issue of the second.
      await expect(
        tokens.consumeVerificationToken(
          first,
          VerificationTokenType.EMAIL_VERIFICATION,
        ),
      ).rejects.toThrow(UnauthorizedException);

      // Second is still usable.
      const ok = await tokens.consumeVerificationToken(
        second,
        VerificationTokenType.EMAIL_VERIFICATION,
      );
      expect(ok.userId).toBe(userId);
    });
  });
});
