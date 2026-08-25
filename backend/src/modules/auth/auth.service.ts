import { createHash, randomBytes } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { AppError } from "../../common/errors/app-error.js";
import type {
  RequestUser,
  SafeUser,
} from "../../common/types/request-context.js";
import type { AppConfig } from "../../config/env.js";
import { logAuthEvent } from "../../common/logging/events.js";
import { hashPassword, verifyPassword } from "./password.js";
import type {
  AuthRepository,
  AuthSessionRecord,
  AuthUserRecord,
} from "./auth.repository.js";
import { normalizeEmail } from "./auth.repository.js";
import type {
  LoginInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  RegisterInput,
} from "./auth.schemas.js";
import type { PasswordResetEmailProvider } from "./auth.email.js";

export interface IssuedSession {
  token: string;
  expiresAt: Date;
  user: SafeUser;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly config: AppConfig,
    private readonly emailProvider: PasswordResetEmailProvider,
  ) {}

  async register(
    input: RegisterInput,
    logger: FastifyBaseLogger,
    requestId: string,
  ): Promise<IssuedSession> {
    const email = normalizeEmail(input.email);
    if (await this.repository.findUserByEmail(email)) {
      logAuthEvent(logger, "REGISTER_FAILURE", requestId);
      throw new AppError(
        "CONFLICT",
        "An account with this email already exists",
      );
    }
    const passwordHash = await hashPassword(input.password);
    let user: AuthUserRecord;
    try {
      user = await this.repository.createUser({
        email,
        passwordHash,
        name: input.name.trim(),
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        logAuthEvent(logger, "REGISTER_FAILURE", requestId);
        throw new AppError(
          "CONFLICT",
          "An account with this email already exists",
          { cause: error },
        );
      }
      throw error;
    }
    const session = await this.issueSession(user);
    logAuthEvent(logger, "REGISTER_SUCCESS", requestId, user.id);
    return session;
  }

  async login(
    input: LoginInput,
    logger: FastifyBaseLogger,
    requestId: string,
  ): Promise<IssuedSession> {
    const user = await this.repository.findUserByEmail(
      normalizeEmail(input.email),
    );
    if (
      !user ||
      !user.passwordHash ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      logAuthEvent(logger, "LOGIN_FAILURE", requestId);
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password");
    }
    if (user.status === "SUSPENDED") {
      logAuthEvent(logger, "LOGIN_FAILURE", requestId, user.id);
      throw new AppError("ACCOUNT_SUSPENDED", "This account is suspended");
    }
    if (user.status === "DELETED") {
      logAuthEvent(logger, "LOGIN_FAILURE", requestId, user.id);
      throw new AppError("ACCOUNT_DEACTIVATED", "This account is deactivated");
    }
    const now = new Date();
    await this.repository.updateLastLogin(user.id, now);
    user.lastLoginAt = now;
    const session = await this.issueSession(user);
    logAuthEvent(logger, "LOGIN_SUCCESS", requestId, user.id);
    return session;
  }

  async resolveSession(
    token: string,
  ): Promise<{ user: SafeUser; session: AuthSessionRecord } | null> {
    const session = await this.repository.findSessionByTokenHash(
      hashToken(token),
    );
    if (!session || session.revokedAt || session.expiresAt <= new Date())
      return null;
    const user = await this.repository.findUserById(session.userId);
    if (!user || user.status !== "ACTIVE") return null;
    await this.repository.touchSession(session.id, new Date());
    return { user: toSafeUser(user), session };
  }

  async logout(
    token: string | undefined,
    logger: FastifyBaseLogger,
    requestId: string,
  ): Promise<void> {
    if (token) {
      await this.repository.revokeSessionByTokenHash(
        hashToken(token),
        new Date(),
      );
    }
    logAuthEvent(logger, "LOGOUT", requestId);
  }

  async requestPasswordReset(
    input: PasswordResetRequestInput,
    logger: FastifyBaseLogger,
    requestId: string,
  ): Promise<void> {
    const user = await this.repository.findUserByEmail(
      normalizeEmail(input.email),
    );
    if (user?.status === "ACTIVE" && user.passwordHash) {
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(
        Date.now() + this.config.passwordResetTtlMinutes * 60_000,
      );
      await this.repository.createPasswordReset({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt,
      });
      await this.emailProvider.sendPasswordReset({
        email: user.email,
        token,
        expiresAt,
      });
    }
    logAuthEvent(logger, "PASSWORD_RESET_REQUESTED", requestId, user?.id);
  }

  async confirmPasswordReset(
    input: PasswordResetConfirmInput,
    logger: FastifyBaseLogger,
    requestId: string,
  ): Promise<void> {
    const reset = await this.repository.findPasswordResetByTokenHash(
      hashToken(input.token),
    );
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      throw new AppError(
        "INVALID_CREDENTIALS",
        "Invalid or expired reset credential",
      );
    }
    const success = await this.repository.updatePasswordAndRevokeSessions(
      reset.userId,
      await hashPassword(input.password),
      reset.id,
    );
    if (!success)
      throw new AppError(
        "INVALID_CREDENTIALS",
        "Invalid or expired reset credential",
      );
    logAuthEvent(logger, "PASSWORD_RESET_COMPLETED", requestId, reset.userId);
  }

  getRequestUser(user: SafeUser): RequestUser {
    return { id: user.id, role: user.role, permissions: user.permissions };
  }

  private async issueSession(user: AuthUserRecord): Promise<IssuedSession> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + this.config.authSessionTtlHours * 60 * 60_000,
    );
    await this.repository.createSession({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
    });
    return { token, expiresAt, user: toSafeUser(user) };
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function toSafeUser(user: AuthUserRecord): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    permissions: [],
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
