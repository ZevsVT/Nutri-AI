import { randomUUID } from "node:crypto";
import type { PrismaClient, User as PrismaUser } from "@prisma/client";
import type { UserRole } from "../../common/types/request-context.js";

export type AccountStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: AccountStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserById(id: string): Promise<AuthUserRecord | null>;
  createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<AuthUserRecord>;
  updateLastLogin(id: string, at: Date): Promise<void>;
  updatePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
    resetTokenId?: string,
  ): Promise<boolean>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<AuthSessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>;
  touchSession(id: string, at: Date): Promise<void>;
  revokeSessionByTokenHash(tokenHash: string, at: Date): Promise<void>;
  revokeAllSessions(userId: string, at: Date): Promise<void>;
  createPasswordReset(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findPasswordResetByTokenHash(tokenHash: string): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
    usedAt: Date | null;
  } | null>;
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
    return user ? toAuthUser(user) : null;
  }

  async findUserById(id: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toAuthUser(user) : null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<AuthUserRecord> {
    const user = await this.prisma.user.create({
      data: {
        email: normalizeEmail(input.email),
        passwordHash: input.passwordHash,
        name: input.name,
      },
    });
    return toAuthUser(user);
  }

  async updateLastLogin(id: string, at: Date): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: at } });
  }

  async updatePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
    resetTokenId?: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      if (resetTokenId) {
        const consumed = await transaction.passwordResetToken.updateMany({
          where: {
            id: resetTokenId,
            userId,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });
        if (consumed.count !== 1) return false;
      }

      const now = new Date();
      await transaction.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      await transaction.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });
  }

  async createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<AuthSessionRecord> {
    const session = await this.prisma.session.create({ data: input });
    return toSession(session);
  }

  async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<AuthSessionRecord | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
    });
    return session ? toSession(session) : null;
  }

  async touchSession(id: string, at: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null, expiresAt: { gt: at } },
      data: { lastUsedAt: at },
    });
  }

  async revokeSessionByTokenHash(tokenHash: string, at: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async revokeAllSessions(userId: string, at: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async createPasswordReset(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: input.userId, usedAt: null },
    });
    await this.prisma.passwordResetToken.create({ data: input });
  }

  async findPasswordResetByTokenHash(tokenHash: string) {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }
}

export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly sessions = new Map<string, AuthSessionRecord>();
  private readonly resets = new Map<
    string,
    {
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      usedAt: Date | null;
    }
  >();

  setUserStatus(id: string, status: AccountStatus): void {
    const user = this.users.get(id);
    if (user) user.status = status;
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return (
      [...this.users.values()].find(
        (user) => user.email === normalizeEmail(email),
      ) ?? null
    );
  }

  async findUserById(id: string): Promise<AuthUserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<AuthUserRecord> {
    const normalizedEmail = normalizeEmail(input.email);
    if (
      [...this.users.values()].some((user) => user.email === normalizedEmail)
    ) {
      const error = new Error("duplicate email");
      (error as Error & { code?: string }).code = "P2002";
      throw error;
    }
    const user: AuthUserRecord = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      name: input.name,
      avatarUrl: null,
      role: "USER",
      status: "ACTIVE",
      createdAt: new Date(),
      lastLoginAt: null,
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateLastLogin(id: string, at: Date): Promise<void> {
    const user = this.users.get(id);
    if (user) user.lastLoginAt = at;
  }

  async updatePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
    resetTokenId?: string,
  ): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    if (resetTokenId) {
      const reset = [...this.resets.values()].find(
        (item) => item.id === resetTokenId,
      );
      if (
        !reset ||
        reset.userId !== userId ||
        reset.usedAt ||
        reset.expiresAt <= new Date()
      )
        return false;
      reset.usedAt = new Date();
    }
    user.passwordHash = passwordHash;
    await this.revokeAllSessions(userId, new Date());
    return true;
  }

  async createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<AuthSessionRecord> {
    const session: AuthSessionRecord = {
      id: randomUUID(),
      ...input,
      lastUsedAt: new Date(),
      revokedAt: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<AuthSessionRecord | null> {
    return (
      [...this.sessions.values()].find(
        (session) => session.tokenHash === tokenHash,
      ) ?? null
    );
  }

  async touchSession(id: string, at: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session && !session.revokedAt && session.expiresAt > at)
      session.lastUsedAt = at;
  }

  async revokeSessionByTokenHash(tokenHash: string, at: Date): Promise<void> {
    const session = await this.findSessionByTokenHash(tokenHash);
    if (session && !session.revokedAt) session.revokedAt = at;
  }

  async revokeAllSessions(userId: string, at: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt)
        session.revokedAt = at;
    }
  }

  async createPasswordReset(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    for (const reset of this.resets.values()) {
      if (reset.userId === input.userId && !reset.usedAt)
        reset.usedAt = new Date();
    }
    const reset = { id: randomUUID(), ...input, usedAt: null };
    this.resets.set(reset.id, reset);
  }

  async findPasswordResetByTokenHash(tokenHash: string) {
    return (
      [...this.resets.values()].find(
        (reset) => reset.tokenHash === tokenHash,
      ) ?? null
    );
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthUser(user: PrismaUser): AuthUserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function toSession(session: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
}): AuthSessionRecord {
  return session;
}
