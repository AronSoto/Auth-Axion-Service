import { randomBytes, createHash } from 'crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import ms, { type StringValue } from 'ms';
import { VerificationTokenType } from '@prisma/client';

import { AppConfigService } from '@/config/app-config.service';
import { PrismaService } from '@/prisma/prisma.service';

import { AuthTokens, AuthUser, JwtAccessPayload } from './auth.types';

const REFRESH_TOKEN_BYTES = 48;
const VERIFICATION_TOKEN_BYTES = 32;

/**
 * Token operations (issuing, hashing, rotation).
 *
 * Refresh tokens are opaque random strings — we never sign them as JWTs because
 * we want server-side revocation by deleting the row. We store the hash, not
 * the plaintext, so a DB leak doesn't expose the tokens themselves.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  // Generic Helpers
  private generateOpaqueToken(bytes: number): string {
    return randomBytes(bytes).toString('base64url');
  }

  private hashToken(token: string): string {
    // SHA-256 is sufficient: refresh/verification tokens are already
    // high-entropy random bytes. Argon2 here would only add latency.
    return createHash('sha256').update(token).digest('hex');
  }

  // Access token (JWT)
  signAccessToken(user: AuthUser): string {
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };
    return this.jwt.sign(payload);
  }

  // Refresh token
  async issueRefreshToken(
    userId: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = this.generateOpaqueToken(REFRESH_TOKEN_BYTES);
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      Date.now() + ms(this.config.jwt.refreshExpiresIn as StringValue),
    );

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Validate a refresh token and rotate it: revoke the old row, issue a new one.
   * Throws on missing, expired, or revoked token.
   *
   * Reuse detection: if a token that was already revoked is presented, we
   * assume the chain is compromised and revoke ALL tokens for that user.
   */
  async rotateRefreshToken(
    presentedToken: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ userId: string; newToken: string; expiresAt: Date }> {
    const tokenHash = this.hashToken(presentedToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) throw new UnauthorizedException('Invalid refresh token');

    if (existing.revokedAt) {
      // Reuse of a revoked token — likely a stolen token replayed. Burn the chain.
      await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedException(
        'Refresh token reuse detected — all sessions revoked',
      );
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const newPlain = this.generateOpaqueToken(REFRESH_TOKEN_BYTES);
    const newHash = this.hashToken(newPlain);
    const newExpiresAt = new Date(
      Date.now() + ms(this.config.jwt.refreshExpiresIn as StringValue),
    );

    // Atomic rotation: revoke old + insert new in a single transaction.
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedByHash: newHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          tokenHash: newHash,
          userId: existing.userId,
          userAgent: metadata?.userAgent,
          ipAddress: metadata?.ipAddress,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    return {
      userId: existing.userId,
      newToken: newPlain,
      expiresAt: newExpiresAt,
    };
  }

  async revokeRefreshToken(presentedToken: string): Promise<void> {
    const tokenHash = this.hashToken(presentedToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!existing || existing.revokedAt) return;
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async issueTokensForUser(
    user: AuthUser,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokens> {
    const accessToken = this.signAccessToken(user);
    const refresh = await this.issueRefreshToken(user.id, metadata);
    return {
      accessToken,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  async issueVerificationToken(
    userId: string,
    type: VerificationTokenType,
    ttlMs: number,
  ): Promise<string> {
    const token = this.generateOpaqueToken(VERIFICATION_TOKEN_BYTES);
    const tokenHash = this.hashToken(token);

    // Invalidate any prior outstanding tokens of the same type — only the
    // newest link should ever be valid.
    await this.prisma.verificationToken.updateMany({
      where: { userId, type, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await this.prisma.verificationToken.create({
      data: {
        tokenHash,
        userId,
        type,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return token;
  }

  async consumeVerificationToken(
    presentedToken: string,
    type: VerificationTokenType,
  ): Promise<{ userId: string }> {
    const tokenHash = this.hashToken(presentedToken);
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.type !== type) {
      throw new UnauthorizedException('Invalid token');
    }
    if (record.consumedAt)
      throw new UnauthorizedException('Token already used');
    if (record.expiresAt < new Date())
      throw new UnauthorizedException('Token expired');

    await this.prisma.verificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return { userId: record.userId };
  }
}
