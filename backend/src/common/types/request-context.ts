import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "../../config/env.js";
import type { ReadinessService } from "../lifecycle/readiness.js";
import type { AuthService } from "../../modules/auth/auth.service.js";

export type UserRole =
  "USER" | "ADMIN" | "MODERATOR" | "NUTRITION_EDITOR" | "SUPPORT";

export interface RequestUser {
  id: string;
  role: UserRole;
  permissions: readonly string[];
}

export interface SafeUser extends RequestUser {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
}

declare module "fastify" {
  interface FastifyRequest {
    user?: RequestUser;
    authUser?: SafeUser;
    startedAt: number;
  }

  interface FastifyInstance {
    config: AppConfig;
    readiness: ReadinessService;
    authService: AuthService;
  }
}

export type RequestWithContext = FastifyRequest;
export type AppWithContext = FastifyInstance;
