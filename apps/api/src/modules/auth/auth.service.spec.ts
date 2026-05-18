import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import * as argon2 from 'argon2';

import { AppConfigService } from '@/config/app-config.service';
import { MailService } from '@/modules/mail/mail.service';
import { UsersService } from '@/modules/users/users.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  buildIntegrationModule,
  truncateAuthTables,
} from '@/test-utils/integration';

import { AuthService } from './auth.service';
import { OAuthProfile } from './auth.types';
import { TokenService } from './token.service';

const baseProfile = (overrides: Partial<OAuthProfile> = {}): OAuthProfile => ({
  provider: AuthProvider.GOOGLE,
  providerAccountId: 'google-uid-1',
  email: 'alice@test.dev',
  name: 'Alice OAuth',
  avatarUrl: 'https://example.com/a.png',
  emailVerified: true,
  ...overrides,
});

describe('AuthService.handleOAuthLogin (integration)', () => {
  let auth: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await buildIntegrationModule([
      AuthService,
      TokenService,
      UsersService,
      // We don't want real email delivery in tests. handleOAuthLogin doesn't
      // touch the mailer, but AuthService's constructor requires it.
      {
        provide: MailService,
        useValue: {
          sendVerificationEmail: jest.fn(),
          sendPasswordResetEmail: jest.fn(),
        },
      },
    ]);
    auth = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAuthTables(prisma);
  });

  it('creates a new user + account on first sign-in', async () => {
    const profile = baseProfile();

    const result = await auth.handleOAuthLogin(profile);

    expect(result.user.email).toBe(profile.email);
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();

    const user = await prisma.user.findUnique({
      where: { email: profile.email },
    });
    expect(user).not.toBeNull();
    expect(user?.name).toBe('Alice OAuth');
    expect(user?.emailVerifiedAt).not.toBeNull();

    const account = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: 'google-uid-1',
        },
      },
    });
    expect(account?.userId).toBe(user?.id);
  });

  it('links a new provider to an existing user with the same email', async () => {
    // Pre-existing local user.
    const existing = await prisma.user.create({
      data: {
        email: 'alice@test.dev',
        name: 'Alice Local',
        passwordHash: 'hash',
      },
    });

    await auth.handleOAuthLogin(
      baseProfile({ provider: AuthProvider.GITHUB, providerAccountId: 'gh-1' }),
    );

    // No duplicate user was created.
    const users = await prisma.user.count();
    expect(users).toBe(1);

    const linked = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GITHUB,
          providerAccountId: 'gh-1',
        },
      },
    });
    expect(linked?.userId).toBe(existing.id);
  });

  it('is idempotent: re-running the same OAuth login does not duplicate rows', async () => {
    const profile = baseProfile();
    await auth.handleOAuthLogin(profile);
    await auth.handleOAuthLogin(profile);
    await auth.handleOAuthLogin(profile);

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.account.count()).toBe(1);
  });

  it('does NOT overwrite an existing user profile on re-login', async () => {
    await prisma.user.create({
      data: {
        email: 'alice@test.dev',
        name: 'Alice (chose herself)',
        avatarUrl: 'https://my-cdn/me.png',
      },
    });

    await auth.handleOAuthLogin(
      baseProfile({
        name: 'Some Google Display Name',
        avatarUrl: 'https://google/u.png',
      }),
    );

    const user = await prisma.user.findUnique({
      where: { email: 'alice@test.dev' },
    });
    expect(user?.name).toBe('Alice (chose herself)');
    expect(user?.avatarUrl).toBe('https://my-cdn/me.png');
  });

  it('promotes emailVerifiedAt from null when OAuth confirms it', async () => {
    await prisma.user.create({
      data: { email: 'alice@test.dev', emailVerifiedAt: null },
    });

    await auth.handleOAuthLogin(baseProfile({ emailVerified: true }));

    const user = await prisma.user.findUnique({
      where: { email: 'alice@test.dev' },
    });
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it('does NOT reset an existing emailVerifiedAt timestamp', async () => {
    const originalVerified = new Date('2020-01-01T00:00:00.000Z');
    await prisma.user.create({
      data: { email: 'alice@test.dev', emailVerifiedAt: originalVerified },
    });

    await auth.handleOAuthLogin(baseProfile({ emailVerified: true }));

    const user = await prisma.user.findUnique({
      where: { email: 'alice@test.dev' },
    });
    expect(user?.emailVerifiedAt?.toISOString()).toBe(
      originalVerified.toISOString(),
    );
  });

  it('REFUSES to link an unverified OAuth email to an existing local user (account-takeover guard)', async () => {
    await prisma.user.create({
      data: {
        email: 'alice@test.dev',
        passwordHash: 'hash',
        emailVerifiedAt: null,
      },
    });

    await expect(
      auth.handleOAuthLogin(baseProfile({ emailVerified: false })),
    ).rejects.toThrow(/not verified by the provider/);

    // No account row was created, no user was linked.
    expect(await prisma.account.count()).toBe(0);
    const user = await prisma.user.findUnique({
      where: { email: 'alice@test.dev' },
    });
    expect(user?.emailVerifiedAt).toBeNull();
  });

  it('allows registering a brand-new user via unverified OAuth (no email collision)', async () => {
    // No pre-existing user — safe to create, but stays unverified.
    const result = await auth.handleOAuthLogin(
      baseProfile({ emailVerified: false }),
    );

    expect(result.user.email).toBe('alice@test.dev');
    const user = await prisma.user.findUnique({
      where: { email: 'alice@test.dev' },
    });
    expect(user?.emailVerifiedAt).toBeNull();
  });
});

describe('AuthService.validateLocalCredentials — email verification gate', () => {
  let auth: AuthService;
  let prisma: PrismaService;

  // Spy on the real config so we can flip requireEmailVerification per-test
  // without rebuilding the module.
  let requireVerificationSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await buildIntegrationModule([
      AuthService,
      TokenService,
      UsersService,
      {
        provide: MailService,
        useValue: {
          sendVerificationEmail: jest.fn(),
          sendPasswordResetEmail: jest.fn(),
        },
      },
    ]);
    auth = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);

    const config = moduleRef.get(AppConfigService);
    requireVerificationSpy = jest.spyOn(
      config,
      'requireEmailVerification',
      'get',
    );
  });

  afterAll(async () => {
    requireVerificationSpy.mockRestore();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAuthTables(prisma);
  });

  it('with the flag OFF, an unverified user can log in normally', async () => {
    requireVerificationSpy.mockReturnValue(false);
    const passwordHash = await argon2.hash('Password123!');
    await prisma.user.create({
      data: { email: 'alice@test.dev', passwordHash, emailVerifiedAt: null },
    });

    const result = await auth.validateLocalCredentials(
      'alice@test.dev',
      'Password123!',
    );
    expect(result?.email).toBe('alice@test.dev');
  });

  it('with the flag ON, an unverified user is rejected with EMAIL_NOT_VERIFIED', async () => {
    requireVerificationSpy.mockReturnValue(true);
    const passwordHash = await argon2.hash('Password123!');
    await prisma.user.create({
      data: { email: 'alice@test.dev', passwordHash, emailVerifiedAt: null },
    });

    await expect(
      auth.validateLocalCredentials('alice@test.dev', 'Password123!'),
    ).rejects.toMatchObject({
      response: { code: 'EMAIL_NOT_VERIFIED' },
    });
    await expect(
      auth.validateLocalCredentials('alice@test.dev', 'Password123!'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('with the flag ON, a verified user can still log in', async () => {
    requireVerificationSpy.mockReturnValue(true);
    const passwordHash = await argon2.hash('Password123!');
    await prisma.user.create({
      data: {
        email: 'alice@test.dev',
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });

    const result = await auth.validateLocalCredentials(
      'alice@test.dev',
      'Password123!',
    );
    expect(result?.email).toBe('alice@test.dev');
  });

  it('with the flag ON, a wrong password throws Unauthorized (no enumeration of verified-vs-unverified)', async () => {
    requireVerificationSpy.mockReturnValue(true);
    const passwordHash = await argon2.hash('Password123!');
    await prisma.user.create({
      data: { email: 'alice@test.dev', passwordHash, emailVerifiedAt: null },
    });

    // Wrong password on an unverified user must NOT reveal the
    // EMAIL_NOT_VERIFIED state. It throws the generic Unauthorized,
    // identical to any other bad login.
    await expect(
      auth.validateLocalCredentials('alice@test.dev', 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.validateLocalCredentials — non-happy paths', () => {
  let auth: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await buildIntegrationModule([
      AuthService,
      TokenService,
      UsersService,
      {
        provide: MailService,
        useValue: {
          sendVerificationEmail: jest.fn(),
          sendPasswordResetEmail: jest.fn(),
        },
      },
    ]);
    auth = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAuthTables(prisma);
  });

  it('unknown email throws the generic Unauthorized (no user enumeration)', async () => {
    await expect(
      auth.validateLocalCredentials('ghost@test.dev', 'whatever'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('OAuth-only user (no passwordHash) cannot log in locally', async () => {
    // Simulates a user that signed up via Google — no local password set.
    await prisma.user.create({
      data: { email: 'alice@test.dev', passwordHash: null },
    });

    await expect(
      auth.validateLocalCredentials('alice@test.dev', 'Password123!'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('disabled account with correct password throws Account disabled', async () => {
    const passwordHash = await argon2.hash('Password123!');
    await prisma.user.create({
      data: {
        email: 'alice@test.dev',
        passwordHash,
        isActive: false,
      },
    });

    await expect(
      auth.validateLocalCredentials('alice@test.dev', 'Password123!'),
    ).rejects.toMatchObject({
      message: 'Account disabled',
    });
  });
});

describe('AuthService — isActive gate on email / password flows', () => {
  let auth: AuthService;
  let prisma: PrismaService;
  let mailMock: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };

  beforeAll(async () => {
    mailMock = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await buildIntegrationModule([
      AuthService,
      TokenService,
      UsersService,
      { provide: MailService, useValue: mailMock },
    ]);
    auth = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAuthTables(prisma);
    mailMock.sendVerificationEmail.mockClear();
    mailMock.sendPasswordResetEmail.mockClear();
  });

  it('resendVerification is silent and sends no mail when the user is disabled', async () => {
    await prisma.user.create({
      data: {
        email: 'alice@test.dev',
        passwordHash: 'hash',
        emailVerifiedAt: null,
        isActive: false,
      },
    });

    await expect(
      auth.resendVerification('alice@test.dev'),
    ).resolves.toBeUndefined();
    expect(mailMock.sendVerificationEmail).not.toHaveBeenCalled();
    expect(await prisma.verificationToken.count()).toBe(0);
  });

  it('requestPasswordReset is silent and sends no mail when the user is disabled', async () => {
    await prisma.user.create({
      data: {
        email: 'alice@test.dev',
        passwordHash: 'hash',
        isActive: false,
      },
    });

    await expect(
      auth.requestPasswordReset('alice@test.dev'),
    ).resolves.toBeUndefined();
    expect(mailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(await prisma.verificationToken.count()).toBe(0);
  });

  it('resetPassword refuses if the account was disabled after the token was issued', async () => {
    // Simulate: user requested reset while active, admin disables them, then user clicks the link.
    const user = await prisma.user.create({
      data: { email: 'alice@test.dev', passwordHash: 'old-hash' },
    });

    await auth.requestPasswordReset('alice@test.dev');
    const tokenRow = await prisma.verificationToken.findFirst({
      where: { userId: user.id },
    });
    expect(tokenRow).not.toBeNull();

    // The plaintext token is only available to the mailer — we exercise the
    // same outcome by deactivating the user, then trying the consume path
    // with a freshly issued plaintext token.
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    // Issue a fresh plaintext token directly so we have the cleartext value
    // to feed resetPassword (the email path would have it; we don't).
    const tokens = (auth as unknown as { tokens: TokenService }).tokens;
    const freshToken = await tokens.issueVerificationToken(
      user.id,
      'PASSWORD_RESET',
      60_000,
    );

    await expect(
      auth.resetPassword(freshToken, 'NewPassword123!'),
    ).rejects.toMatchObject({ message: 'Account disabled' });

    // Password must not have been rotated.
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.passwordHash).toBe('old-hash');
  });
});
