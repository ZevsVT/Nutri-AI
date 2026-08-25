import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../config/constants.js";
import {
  createAuthenticate,
  createAuthorize,
} from "../common/middleware/auth.js";
import { validateRequest } from "../common/middleware/request-validation.js";
import type { SystemController } from "../modules/system/system.controller.js";
import {
  apiMetadataQuerySchema,
  echoBodySchema,
} from "../modules/system/system.schemas.js";

const apiMetadataQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    format: { type: "string", enum: ["full", "compact"], default: "full" },
  },
};

const echoBodyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message"],
  properties: { message: { type: "string", minLength: 1, maxLength: 1_000 } },
};

const apiMetadataResponseJsonSchema = { $ref: "ApiMetadataResponse#" };
const echoResponseJsonSchema = { $ref: "EchoResponse#" };
const currentUserResponseJsonSchema = { $ref: "CurrentUserResponse#" };
const adminCheckResponseJsonSchema = { $ref: "AdminCheckResponse#" };
const errorResponseJsonSchema = { $ref: "ErrorResponse#" };

export async function registerRoutes(
  app: FastifyInstance,
  controller: SystemController,
): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        response: { 200: { $ref: "HealthResponse#" } },
      },
    },
    controller.health,
  );
  app.get(
    "/ready",
    {
      schema: {
        tags: ["system"],
        response: {
          200: { $ref: "ReadyResponse#" },
          503: { $ref: "NotReadyResponse#" },
        },
      },
    },
    controller.ready,
  );

  app.get(
    API_PREFIX,
    {
      preValidation: validateRequest("query", apiMetadataQuerySchema),
      schema: {
        tags: ["system"],
        description: "Versioned API metadata and contract boundary.",
        querystring: apiMetadataQueryJsonSchema,
        response: {
          200: {
            ...apiMetadataResponseJsonSchema,
            description: "API metadata",
            examples: [
              {
                success: true,
                data: {
                  name: "Nutri-AI API",
                  version: "v1",
                  status: "running",
                },
              },
            ],
          },
        },
      },
    },
    controller.apiMetadata,
  );

  app.post(
    `${API_PREFIX}/foundation/echo`,
    {
      preValidation: validateRequest("body", echoBodySchema),
      schema: {
        tags: ["foundation"],
        description:
          "Validation contract example; this route is not a product API.",
        body: echoBodyJsonSchema,
        response: {
          200: echoResponseJsonSchema,
          400: errorResponseJsonSchema,
        },
      },
    },
    controller.echo,
  );

  const authenticate = createAuthenticate(app.config);
  const authorizeAdmin = createAuthorize(app.config, "admin:read");

  app.get(
    `${API_PREFIX}/foundation/me`,
    {
      preHandler: authenticate,
      schema: {
        tags: ["foundation"],
        description:
          "Development-only identity boundary. Issue #8 will provide real token/session verification.",
        response: {
          200: currentUserResponseJsonSchema,
          401: errorResponseJsonSchema,
        },
      },
    },
    controller.currentUser,
  );
  app.get(
    `${API_PREFIX}/foundation/admin-check`,
    {
      preHandler: [authenticate, authorizeAdmin],
      schema: {
        tags: ["foundation"],
        description:
          "Development-only authorization boundary. Authorization remains server-side.",
        response: {
          200: adminCheckResponseJsonSchema,
          401: errorResponseJsonSchema,
          403: errorResponseJsonSchema,
        },
      },
    },
    controller.adminCheck,
  );
}
