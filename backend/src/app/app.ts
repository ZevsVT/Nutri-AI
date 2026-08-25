import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";
import { SERVICE_VERSION } from "../config/constants.js";
import { installErrorHandling } from "../common/errors/error-handler.js";
import { createLoggerOptions } from "../common/logging/logger.js";
import {
  ReadinessService,
  type ReadinessCheck,
} from "../common/lifecycle/readiness.js";
import "../common/types/request-context.js";
import { registerRoutes } from "./routes.js";
import { SystemController } from "../modules/system/system.controller.js";
import { SystemService } from "../modules/system/system.service.js";

export interface BuildAppOptions {
  config: AppConfig;
  readinessChecks?: readonly ReadinessCheck[];
  registerAdditionalRoutes?: (app: FastifyInstance) => Promise<void>;
}

const requestIdPattern = /^[A-Za-z0-9_.:-]{1,128}$/;

function requestIdFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const value = headers["x-request-id"];
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && requestIdPattern.test(candidate) ? candidate : undefined;
}

export async function buildApp(
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const { config } = options;
  const app = Fastify({
    logger: createLoggerOptions(config),
    bodyLimit: config.requestBodyLimitBytes,
    trustProxy: config.trustProxy,
    // Fastify otherwise trusts any incoming header before genReqId runs.
    // Validate it ourselves so correlation IDs cannot contain unbounded or
    // log-sensitive values.
    requestIdHeader: false,
    genReqId: (request) =>
      requestIdFromHeaders(request.headers) ?? `req_${randomUUID()}`,
    logController: new LogController({ disableRequestLogging: true }),
  });
  const readiness = new ReadinessService(options.readinessChecks, app.log);

  app.decorate("config", config);
  app.decorate("readiness", readiness);
  app.decorateRequest("startedAt", 0);

  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed"), false);
    },
  });
  await app.register(multipart, {
    limits: { fileSize: config.fileUploadLimitBytes, files: 1, parts: 10 },
  });
  await app.register(rateLimit, {
    global: true,
    allowList: (request) =>
      request.url === "/health" || request.url === "/ready",
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindowMs,
    keyGenerator: (request) => request.user?.id ?? request.ip,
    errorResponseBuilder: (request) => ({
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests" },
      requestId: request.id,
    }),
    onExceeded: (request) => {
      request.log.warn(
        {
          event: "rate_limit_exceeded",
          requestId: request.id,
          route: request.url.split("?")[0],
        },
        "rate_limit_exceeded",
      );
    },
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Nutri-AI API",
        description: "Production API foundation for Nutri-AI",
        version: SERVICE_VERSION,
      },
      servers: [{ url: config.apiBaseUrl }],
      tags: [
        { name: "system", description: "Health, readiness, and API metadata" },
        {
          name: "foundation",
          description: "Non-business foundation contract examples",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Reserved for Issue #8",
          },
        },
        schemas: {
          HealthResponse: {
            type: "object",
            required: ["status", "service", "version"],
            properties: {
              status: { type: "string", enum: ["ok"] },
              service: { type: "string" },
              version: { type: "string" },
            },
          },
          ReadyResponse: {
            type: "object",
            required: ["status"],
            properties: { status: { type: "string", enum: ["ready"] } },
          },
          NotReadyResponse: {
            type: "object",
            required: ["status"],
            properties: { status: { type: "string", enum: ["not_ready"] } },
          },
          ErrorResponse: {
            type: "object",
            required: ["success", "error", "requestId"],
            example: {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "Invalid request body",
              },
              requestId: "req_example",
            },
            properties: {
              success: { type: "boolean", enum: [false] },
              error: {
                type: "object",
                required: ["code", "message"],
                properties: {
                  code: {
                    type: "string",
                    enum: [
                      "VALIDATION_ERROR",
                      "AUTHENTICATION_ERROR",
                      "AUTHORIZATION_ERROR",
                      "NOT_FOUND",
                      "CONFLICT",
                      "RATE_LIMITED",
                      "EXTERNAL_SERVICE_ERROR",
                      "AI_ANALYSIS_ERROR",
                      "STORAGE_ERROR",
                      "DATABASE_ERROR",
                      "INTERNAL_SERVER_ERROR",
                    ],
                  },
                  message: { type: "string" },
                  details: {},
                },
              },
              requestId: { type: "string" },
            },
          },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.addSchema({
    $id: "HealthResponse",
    type: "object",
    required: ["status", "service", "version"],
    properties: {
      status: { type: "string", enum: ["ok"] },
      service: { type: "string" },
      version: { type: "string" },
    },
  });
  app.addSchema({
    $id: "ReadyResponse",
    type: "object",
    required: ["status"],
    properties: { status: { type: "string", enum: ["ready"] } },
  });
  app.addSchema({
    $id: "NotReadyResponse",
    type: "object",
    required: ["status"],
    properties: { status: { type: "string", enum: ["not_ready"] } },
  });
  app.addSchema({
    $id: "ApiMetadataResponse",
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: {
        type: "object",
        required: ["name", "version", "status"],
        properties: {
          name: { type: "string" },
          version: { type: "string" },
          status: { type: "string" },
        },
      },
    },
  });
  app.addSchema({
    $id: "EchoResponse",
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: {
        type: "object",
        required: ["message", "environment"],
        properties: {
          message: { type: "string" },
          environment: { type: "string" },
        },
      },
    },
  });
  app.addSchema({
    $id: "CurrentUserResponse",
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: {
        type: "object",
        required: ["user"],
        properties: {
          user: {
            type: "object",
            required: ["id", "role", "permissions"],
            properties: {
              id: { type: "string" },
              role: { type: "string" },
              permissions: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  });
  app.addSchema({
    $id: "AdminCheckResponse",
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: {
        type: "object",
        required: ["authorized"],
        properties: {
          authorized: { type: "boolean" },
          userId: { type: "string" },
        },
      },
    },
  });
  app.addSchema({
    $id: "ErrorResponse",
    type: "object",
    required: ["success", "error", "requestId"],
    examples: [
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
        },
        requestId: "req_example",
      },
    ],
    properties: {
      success: { type: "boolean", enum: [false] },
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            enum: [
              "VALIDATION_ERROR",
              "AUTHENTICATION_ERROR",
              "AUTHORIZATION_ERROR",
              "NOT_FOUND",
              "CONFLICT",
              "RATE_LIMITED",
              "EXTERNAL_SERVICE_ERROR",
              "AI_ANALYSIS_ERROR",
              "STORAGE_ERROR",
              "DATABASE_ERROR",
              "INTERNAL_SERVER_ERROR",
            ],
          },
          message: { type: "string" },
          details: {},
        },
      },
      requestId: { type: "string" },
    },
  });

  app.addHook("onRequest", async (request, reply) => {
    request.startedAt = performance.now();
    reply.header("x-request-id", request.id);
    reply.header("cache-control", "no-store");
    request.log.info(
      {
        event: "request_received",
        requestId: request.id,
        method: request.method,
        route: request.url.split("?")[0],
      },
      "request_received",
    );
  });
  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        event: "request_completed",
        requestId: request.id,
        method: request.method,
        route: request.routeOptions.url ?? request.url.split("?")[0],
        statusCode: reply.statusCode,
        durationMs: Math.round(performance.now() - request.startedAt),
      },
      "request_completed",
    );
  });

  installErrorHandling(app);
  const systemService = new SystemService(config, readiness);
  await registerRoutes(app, new SystemController(systemService));
  await options.registerAdditionalRoutes?.(app);
  readiness.markInitialized();

  return app;
}
