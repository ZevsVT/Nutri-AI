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
import { AuthService } from "../modules/auth/auth.service.js";
import {
  InMemoryAuthRepository,
  type AuthRepository,
} from "../modules/auth/auth.repository.js";
import {
  NoopPasswordResetEmailProvider,
  type PasswordResetEmailProvider,
} from "../modules/auth/auth.email.js";
import { ApiController } from "../modules/api/api.controller.js";
import {
  InMemoryBusinessApiService,
  type BusinessApiService,
} from "../modules/api/api.service.js";
import { StorageController } from "../modules/storage/storage.controller.js";
import {
  InMemoryStorageObjectRepository,
  type StorageObjectRepository,
} from "../modules/storage/storage.repository.js";
import {
  StorageService,
  createStorageProvider,
} from "../modules/storage/storage.service.js";
import type { StorageProvider } from "../integrations/storage/storage-provider.js";
import {
  MetricsRegistry,
  metricRoute,
} from "../common/observability/metrics.js";
import {
  rateLimitCategory,
  rateLimitMax,
  routePath,
} from "../common/observability/rate-limit.js";

export interface BuildAppOptions {
  config: AppConfig;
  readinessChecks?: readonly ReadinessCheck[];
  registerAdditionalRoutes?: (app: FastifyInstance) => Promise<void>;
  authRepository?: AuthRepository;
  passwordResetEmailProvider?: PasswordResetEmailProvider;
  businessApiService?: BusinessApiService;
  storageProvider?: StorageProvider;
  storageObjectRepository?: StorageObjectRepository;
  storageService?: StorageService;
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
  const metrics = new MetricsRegistry();
  const readiness = new ReadinessService(
    options.readinessChecks,
    app.log,
    metrics,
  );
  const storageService =
    options.storageService ??
    new StorageService(
      options.storageProvider ?? createStorageProvider(config),
      options.storageObjectRepository ?? new InMemoryStorageObjectRepository(),
      config,
    );

  app.decorate("config", config);
  app.decorate("readiness", readiness);
  app.decorate("metrics", metrics);
  storageService.setMetrics(metrics);
  app.decorate(
    "authService",
    new AuthService(
      options.authRepository ?? new InMemoryAuthRepository(),
      config,
      options.passwordResetEmailProvider ??
        new NoopPasswordResetEmailProvider(),
    ),
  );
  app.decorateRequest("startedAt", 0);
  app.addHook("onClose", async () => storageService.stopCleanup());

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
    global: config.rateLimitEnabled,
    hook: "preHandler",
    allowList: (request) =>
      [
        "/health",
        "/ready",
        "/health/live",
        "/health/ready",
        "/metrics",
      ].includes(routePath(request.url)),
    // Authentication is a route pre-handler, so private requests are keyed
    // by the server-resolved user ID before this hook runs. Anonymous routes
    // use Fastify's proxy-aware IP, which only honors forwarded headers when
    // TRUST_PROXY is explicitly enabled.
    max: (request) => rateLimitMax(config, request.url),
    timeWindow: config.rateLimitWindowMs,
    keyGenerator: (request) => request.user?.id ?? request.ip,
    errorResponseBuilder: (request) => ({
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests" },
      requestId: request.id,
    }),
    onExceeded: (request) => {
      const route = metricRoute(
        request.routeOptions.url ?? routePath(request.url),
      );
      const limiterCategory = rateLimitCategory(route);
      metrics.recordRateLimitRejection(route, request.method);
      request.log.warn(
        {
          event: "rate_limit_rejected",
          requestId: request.id,
          route,
          method: request.method,
          limiterCategory,
          statusCode: 429,
        },
        "rate_limit_rejected",
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
        {
          name: "foods",
          description: "Canonical foods and nutrition provenance",
        },
        { name: "meals", description: "Owned meal diary and confirmation" },
        {
          name: "analysis",
          description: "Asynchronous meal recognition lifecycle",
        },
        { name: "nutrition", description: "Confirmed nutrition summaries" },
        { name: "assistant", description: "Grounded AI assistant" },
        { name: "recipes", description: "Published recipes" },
        { name: "water", description: "User water logs" },
        { name: "insights", description: "Nutrition insights" },
        { name: "barcode", description: "Barcode provider contract" },
        { name: "storage", description: "Private authenticated meal images" },
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
          LiveResponse: {
            type: "object",
            required: ["status"],
            properties: { status: { type: "string", enum: ["ok"] } },
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
                      "INVALID_CREDENTIALS",
                      "ACCOUNT_SUSPENDED",
                      "ACCOUNT_DEACTIVATED",
                      "AUTHORIZATION_ERROR",
                      "NOT_FOUND",
                      "FOOD_NOT_FOUND",
                      "MEAL_NOT_FOUND",
                      "ANALYSIS_NOT_FOUND",
                      "CONFLICT",
                      "INVALID_STATE",
                      "ANALYSIS_FAILED",
                      "ANALYSIS_NOT_READY",
                      "NUTRITION_DATA_UNAVAILABLE",
                      "RATE_LIMITED",
                      "EXTERNAL_SERVICE_ERROR",
                      "AI_ANALYSIS_ERROR",
                      "STORAGE_ERROR",
                      "STORAGE_OBJECT_NOT_FOUND",
                      "STORAGE_LIMIT_EXCEEDED",
                      "STORAGE_INVALID_OBJECT",
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
    $id: "LiveResponse",
    type: "object",
    required: ["status"],
    properties: { status: { type: "string", enum: ["ok"] } },
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
              "INVALID_CREDENTIALS",
              "ACCOUNT_SUSPENDED",
              "ACCOUNT_DEACTIVATED",
              "AUTHORIZATION_ERROR",
              "NOT_FOUND",
              "FOOD_NOT_FOUND",
              "MEAL_NOT_FOUND",
              "ANALYSIS_NOT_FOUND",
              "CONFLICT",
              "INVALID_STATE",
              "ANALYSIS_FAILED",
              "ANALYSIS_NOT_READY",
              "NUTRITION_DATA_UNAVAILABLE",
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
        route: metricRoute(request.routeOptions.url ?? routePath(request.url)),
      },
      "request_received",
    );
  });
  app.addHook("onResponse", async (request, reply) => {
    const route = metricRoute(request.routeOptions.url);
    const durationMs = Math.round(performance.now() - request.startedAt);
    metrics.recordHttpRequest(
      request.method,
      route,
      reply.statusCode,
      durationMs,
    );
    request.log.info(
      {
        event: "request_completed",
        requestId: request.id,
        method: request.method,
        route,
        statusCode: reply.statusCode,
        durationMs,
      },
      "request_completed",
    );
  });

  installErrorHandling(app);
  const systemService = new SystemService(config, readiness);
  const apiController = new ApiController(
    options.businessApiService ??
      new InMemoryBusinessApiService(undefined, storageService),
  );
  const storageController = new StorageController(storageService, config);
  storageService.startCleanup(app.log);
  await registerRoutes(
    app,
    new SystemController(systemService),
    apiController,
    storageController,
  );
  await options.registerAdditionalRoutes?.(app);
  readiness.markInitialized();

  return app;
}
