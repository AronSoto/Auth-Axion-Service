import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';

// Internal security fields (passwordHash, lockout counters) never leave the API.
export type SafeUser = Omit<
  User,
  'passwordHash' | 'failedLoginAttempts' | 'lockedUntil'
>;

// Brute-force thresholds for local login.
const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 min

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  name: true,
  avatarUrl: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
  }

  async findByIdOrFail(id: string): Promise<SafeUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async create(input: {
    email: string;
    name?: string;
    passwordHash?: string | null;
    avatarUrl?: string;
    emailVerified?: boolean;
    role?: UserRole;
  }): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
          passwordHash: input.passwordHash ?? null,
          avatarUrl: input.avatarUrl,
          emailVerifiedAt: input.emailVerified ? new Date() : null,
          role: input.role ?? 'USER',
        },
      });
    } catch (err) {
      // P2002 = unique constraint violation; race-safe than a pre-check.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  async updateProfile(
    id: string,
    data: { name?: string; avatarUrl?: string },
  ): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_USER_SELECT,
    });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  // Count a failed local login; lock the account once the threshold is hit.
  // Returns whether this attempt triggered a fresh lock (for auditing).
  async registerFailedLogin(id: string): Promise<{ justLocked: boolean }> {
    const { failedLoginAttempts } = await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });

    if (failedLoginAttempts >= MAX_FAILED_LOGINS) {
      await this.prisma.user.update({
        where: { id },
        data: {
          lockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
          failedLoginAttempts: 0,
        },
      });
      return { justLocked: true };
    }
    return { justLocked: false };
  }

  // Clear the counter + lock after a successful login.
  async clearLoginFailures(id: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: {
        id,
        OR: [
          { failedLoginAttempts: { gt: 0 } },
          { lockedUntil: { not: null } },
        ],
      },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
}
