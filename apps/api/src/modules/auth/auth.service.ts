import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { VerificationTokenType } from '@prisma/client';

import { MailService } from '@/modules/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from '@/modules/users/users.service';

import { AuthTokens, AuthenticatedUser, OAuthProfile } from './auth.types';
import { TokenService } from './token.service';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}

interface AuthResult {
  user: AuthenticatedUser;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  // Local Authentication (email + password)
  async validateLocalCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.passwordHash) return null;

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return null;
    if (!user.isActive) throw new UnauthorizedException('Account disabled');

    return { id: user.id, email: user.email, role: user.role };
  }

  async register(
    dto: { email: string; password: string; name?: string },
    metadata?: RequestMetadata,
  ): Promise<AuthResult> {
    const passwordHash = await argon2.hash(dto.password);

    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      emailVerified: false,
    });

    // Fire-and-forget verification email — registration shouldn't fail if
    // email delivery is down.
    const verificationToken = await this.tokens.issueVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
      VERIFICATION_TOKEN_TTL_MS,
    );
    void this.mail
      .sendVerificationEmail(user.email, verificationToken)
      .catch((err) => {
        this.logger.error(
          `Failed to send verification email for ${user.email}`,
          err,
        );
      });

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = await this.tokens.issueTokensForUser(authUser, metadata);
    return { user: authUser, tokens };
  }

  async login(
    user: AuthenticatedUser,
    metadata?: RequestMetadata,
  ): Promise<AuthTokens> {
    return this.tokens.issueTokensForUser(user, metadata);
  }

  async refresh(
    refreshToken: string,
    metadata?: RequestMetadata,
  ): Promise<AuthTokens> {
    const result = await this.tokens.rotateRefreshToken(refreshToken, metadata);
    const user = await this.users.findById(result.userId);
    if (!user || !user.isActive)
      throw new UnauthorizedException('User no longer active');

    const accessToken = this.tokens.signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: result.newToken,
      refreshTokenExpiresAt: result.expiresAt,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  // OAuth Authentication
  async handleOAuthLogin(
    profile: OAuthProfile,
    metadata?: RequestMetadata,
  ): Promise<AuthResult> {
    // 1. Existing linked account?
    const existing = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
    });

    let userId: string;

    if (existing) {
      userId = existing.userId;
    } else {
      // 2. User with same email — link the new provider to that account.
      const sameEmail = await this.prisma.user.findUnique({
        where: { email: profile.email.toLowerCase() },
      });

      if (sameEmail) {
        await this.prisma.account.create({
          data: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
            userId: sameEmail.id,
          },
        });
        userId = sameEmail.id;
      } else {
        // 3. Brand new user. We trust OAuth-verified emails; fall back to false otherwise.
        const created = await this.prisma.user.create({
          data: {
            email: profile.email.toLowerCase(),
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            emailVerifiedAt: profile.emailVerified ? new Date() : null,
            accounts: {
              create: {
                provider: profile.provider,
                providerAccountId: profile.providerAccountId,
              },
            },
          },
        });
        userId = created.id;
      }
    }

    // If OAuth tells us the email is verified and we hadn't recorded it, record it.
    if (profile.emailVerified) {
      await this.prisma.user
        .updateMany({
          where: { id: userId, emailVerifiedAt: null },
          data: { emailVerifiedAt: new Date() },
        })
        .catch(() => undefined);
    }

    const user = await this.users.findByIdOrFail(userId);
    if (!user.isActive) throw new UnauthorizedException('Account disabled');

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = await this.tokens.issueTokensForUser(authUser, metadata);
    return { user: authUser, tokens };
  }

  // Email verification
  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.users.findByIdOrFail(userId);
    if (user.emailVerifiedAt)
      throw new BadRequestException('Email already verified');

    const token = await this.tokens.issueVerificationToken(
      userId,
      VerificationTokenType.EMAIL_VERIFICATION,
      VERIFICATION_TOKEN_TTL_MS,
    );
    await this.mail.sendVerificationEmail(user.email, token);
  }

  // Idempotent + silent: never reveals whether an email is registered or already verified.
  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerifiedAt) return;

    const token = await this.tokens.issueVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
      VERIFICATION_TOKEN_TTL_MS,
    );
    void this.mail.sendVerificationEmail(user.email, token).catch((err) => {
      this.logger.error(
        `Failed to resend verification email for ${user.email}`,
        err,
      );
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const { userId } = await this.tokens.consumeVerificationToken(
      token,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    await this.users.markEmailVerified(userId);
  }

  // Password reset
  //Idempotent + silent: never reveals whether an email is registered.
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;

    const token = await this.tokens.issueVerificationToken(
      user.id,
      VerificationTokenType.PASSWORD_RESET,
      PASSWORD_RESET_TTL_MS,
    );
    void this.mail.sendPasswordResetEmail(user.email, token).catch((err) => {
      this.logger.error(
        `Failed to send password reset email for ${user.email}`,
        err,
      );
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { userId } = await this.tokens.consumeVerificationToken(
      token,
      VerificationTokenType.PASSWORD_RESET,
    );

    const passwordHash = await argon2.hash(newPassword);
    await this.users.updatePasswordHash(userId, passwordHash);

    // Force re-auth on every device after a password change.
    await this.tokens.revokeAllForUser(userId);
  }
}
