import { randomBytes } from 'crypto';

import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { SecurityEventType, User, VerificationTokenType } from '@prisma/client';

import { AppConfigService } from '@/config/app-config.service';
import { MailService } from '@/modules/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from '@/modules/users/users.service';

import { AuditService } from '../audit/audit.service';
import {
  AuthTokens,
  AuthUser,
  OAuthProfile,
  RequestMetadata,
  SessionInfo,
} from './auth.types';
import { OAUTH_ERROR_CODES, OAuthException } from './oauth-errors';
import { PasswordPolicyService } from './password-policy.service';
import { TokenService } from './token.service';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private dummyPasswordHash!: string;

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await argon2.hash(
      randomBytes(32).toString('base64url'),
    );
  }

  async validateLocalCredentials(
    email: string,
    password: string,
    metadata?: RequestMetadata,
  ): Promise<AuthUser> {
    const user = await this.users.findByEmail(email);

    // Always verify, even without a user.
    const hashToVerify = user?.passwordHash ?? this.dummyPasswordHash;
    const passwordMatches = await argon2.verify(hashToVerify, password);

    const recordFailure = (detail: string): void =>
      this.audit.record({
        type: SecurityEventType.LOGIN_FAILED,
        userId: user?.id ?? null,
        email,
        metadata,
        detail,
      });

    // Reject locked accounts regardless of password (timing already spent above).
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      recordFailure('account locked');
      throw new UnauthorizedException(
        'Account temporarily locked due to failed attempts. Try again later.',
      );
    }

    if (!user || !user.passwordHash || !passwordMatches) {
      if (user) {
        const { justLocked } = await this.users.registerFailedLogin(user.id);
        if (justLocked) {
          this.audit.record({
            type: SecurityEventType.ACCOUNT_LOCKED,
            userId: user.id,
            email,
            metadata,
          });
        }
      }
      recordFailure('invalid credentials');
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      recordFailure('account disabled');
      throw new UnauthorizedException('Account disabled');
    }

    // Checked after password to avoid timing leak.
    if (this.config.requireEmailVerification && !user.emailVerifiedAt) {
      recordFailure('email not verified');
      throw new ForbiddenException({
        message: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    await this.users.clearLoginFailures(user.id);
    return { id: user.id, email: user.email, role: user.role };
  }

  async register(
    dto: { email: string; password: string; name?: string },
    metadata?: RequestMetadata,
  ): Promise<AuthResult> {
    await this.passwordPolicy.assertAcceptable(dto.password, [
      dto.email,
      dto.name ?? '',
    ]);
    const passwordHash = await argon2.hash(dto.password);

    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      emailVerified: false,
    });

    // Fire-and-forget: registration must not fail on email errors.
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

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    // Verification gate applies on next login, not register.
    const tokens = await this.tokens.issueTokensForUser(authUser, metadata);
    this.audit.record({
      type: SecurityEventType.REGISTER,
      userId: user.id,
      email: user.email,
      metadata,
    });
    return { user: authUser, tokens };
  }

  async login(user: AuthUser, metadata?: RequestMetadata): Promise<AuthTokens> {
    const tokens = await this.tokens.issueTokensForUser(user, metadata);
    this.audit.record({
      type: SecurityEventType.LOGIN_SUCCESS,
      userId: user.id,
      email: user.email,
      metadata,
    });
    return tokens;
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
    this.audit.record({
      type: SecurityEventType.SESSION_REVOKED,
      userId,
      detail: 'all sessions',
    });
  }

  listSessions(
    userId: string,
    presentedRefreshToken?: string,
  ): Promise<SessionInfo[]> {
    return this.tokens.listActiveSessions(userId, presentedRefreshToken);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.tokens.revokeSessionById(userId, sessionId);
    this.audit.record({
      type: SecurityEventType.SESSION_REVOKED,
      userId,
      detail: `session ${sessionId}`,
    });
  }

  // Idempotent via provider/providerAccountId unique key.
  async handleOAuthLogin(
    profile: OAuthProfile,
    metadata?: RequestMetadata,
  ): Promise<AuthResult> {
    const email = profile.email.toLowerCase();
    const emailVerifiedAt = profile.emailVerified ? new Date() : null;

    // Provisioning atomic; tokens intentionally outside.
    const user = await this.prisma.$transaction(async (tx) => {
      const existingAccount = await tx.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
        select: { userId: true },
      });

      let resolved: User;
      if (existingAccount) {
        resolved = await tx.user.findUniqueOrThrow({
          where: { id: existingAccount.userId },
        });
      } else if (!profile.emailVerified) {
        // Block linking unverified OAuth to existing users.
        const collision = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (collision) {
          throw new OAuthException(
            OAUTH_ERROR_CODES.unverified,
            'OAuth email is not verified by the provider — cannot link to existing account',
          );
        }
        resolved = await tx.user.create({
          data: {
            email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            emailVerifiedAt: null,
          },
        });
      } else {
        // Verified email: safe to create or link.
        resolved = await tx.user.upsert({
          where: { email },
          create: {
            email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            emailVerifiedAt,
          },
          update: {},
        });
      }

      if (!resolved.isActive) {
        throw new OAuthException(
          OAUTH_ERROR_CODES.disabled,
          'Account disabled',
        );
      }

      if (emailVerifiedAt && resolved.emailVerifiedAt === null) {
        await tx.user.updateMany({
          where: { id: resolved.id, emailVerifiedAt: null },
          data: { emailVerifiedAt },
        });
      }

      if (!existingAccount) {
        await tx.account.create({
          data: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
            userId: resolved.id,
          },
        });
      }

      return resolved;
    });

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = await this.tokens.issueTokensForUser(authUser, metadata);
    this.audit.record({
      type: SecurityEventType.OAUTH_LOGIN,
      userId: user.id,
      email: user.email,
      metadata,
      detail: profile.provider,
    });
    return { user: authUser, tokens };
  }

  // Idempotent + silent: never reveals whether an email is registered or already verified.
  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive || user.emailVerifiedAt) return;

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
    this.audit.record({ type: SecurityEventType.EMAIL_VERIFIED, userId });
  }

  // Password reset
  //Idempotent + silent: never reveals whether an email is registered.
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) return;

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
    this.audit.record({
      type: SecurityEventType.PASSWORD_RESET_REQUESTED,
      userId: user.id,
      email: user.email,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { userId } = await this.tokens.consumeVerificationToken(
      token,
      VerificationTokenType.PASSWORD_RESET,
    );

    const user = await this.users.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account disabled');
    }

    await this.passwordPolicy.assertAcceptable(newPassword, [user.email]);
    const passwordHash = await argon2.hash(newPassword);

    // Atomic: password change and session revocation must succeed together.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.audit.record({
      type: SecurityEventType.PASSWORD_RESET_COMPLETED,
      userId,
      email: user.email,
    });
  }
}
