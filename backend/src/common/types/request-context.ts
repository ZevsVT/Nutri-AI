import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "../../config/env.js";
import type { ReadinessService } from "../lifecycle/readiness.js";

export type UserRole =
  "USER" | "ADMIN" | "MODERATOR" | "NUTRITION_EDITOR" | "SUPPORT";

export interface RequestUser {
  id: string;
  role: UserRole;
  permissions: readonly string[];
}

declare module "fastify" {
  interface FastifyRequest {
    user?: RequestUser;
    startedAt: number;
  }

  interface FastifyInstance {
    config: AppConfig;
    readiness: ReadinessService;
  }
}

export type RequestWithContext = FastifyRequest;
export type AppWithContext = FastifyInstance;
