import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../common/errors/app-error.js";
import { successResponse } from "../../common/errors/error-handler.js";
import { parseOrThrow } from "../../common/middleware/request-validation.js";
import type { AppConfig } from "../../config/env.js";
import {
  readSessionCookie,
  clearSessionCookie,
  sessionCookie,
} from "./auth.cookies.js";
import type { AuthService } from "./auth.service.js";
import {
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema,
  type LoginInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
  type RegisterInput,
} from "./auth.schemas.js";

export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly config: AppConfig,
  ) {}

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    assertSafeOrigin(request, this.config);
    const input = parseOrThrow(
      registerSchema,
      request.body,
      "body",
    ) as RegisterInput;
    const issued = await this.service.register(input, request.log, request.id);
    setSession(reply, issued.token, issued.expiresAt, this.config);
    return reply.code(201).send(successResponse({ user: issued.user }));
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    assertSafeOrigin(request, this.config);
    const input = parseOrThrow(loginSchema, request.body, "body") as LoginInput;
    const issued = await this.service.login(input, request.log, request.id);
    setSession(reply, issued.token, issued.expiresAt, this.config);
    return reply.send(successResponse({ user: issued.user }));
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    assertSafeOrigin(request, this.config);
    await this.service.logout(
      readSessionCookie(request.headers.cookie),
      request.log,
      request.id,
    );
    reply.header("set-cookie", clearSessionCookie(isSecureCookie(this.config)));
    return reply.send(successResponse({ loggedOut: true }));
  };

  me = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.authUser) {
      throw new AppError("AUTHENTICATION_ERROR", "Authentication is required");
    }
    return reply.send(successResponse({ user: request.authUser }));
  };

  requestPasswordReset = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    assertSafeOrigin(request, this.config);
    const input = parseOrThrow(
      passwordResetRequestSchema,
      request.body,
      "body",
    ) as PasswordResetRequestInput;
    await this.service.requestPasswordReset(input, request.log, request.id);
    return reply.send(
      successResponse({
        message: "If the account exists, reset instructions have been sent",
      }),
    );
  };

  confirmPasswordReset = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    assertSafeOrigin(request, this.config);
    const input = parseOrThrow(
      passwordResetConfirmSchema,
      request.body,
      "body",
    ) as PasswordResetConfirmInput;
    await this.service.confirmPasswordReset(input, request.log, request.id);
    return reply.send(successResponse({ passwordReset: true }));
  };
}

function setSession(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
  config: AppConfig,
): void {
  reply.header(
    "set-cookie",
    sessionCookie(token, expiresAt, isSecureCookie(config)),
  );
}

function isSecureCookie(config: AppConfig): boolean {
  return config.nodeEnv !== "development";
}

function assertSafeOrigin(request: FastifyRequest, config: AppConfig): void {
  const origin = request.headers.origin;
  if (origin && !config.corsOrigins.includes(origin)) {
    throw new AppError("AUTHORIZATION_ERROR", "Origin is not allowed");
  }
}
