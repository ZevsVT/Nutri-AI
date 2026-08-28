import type { FastifyServerOptions } from "fastify";
import type { AppConfig } from "../../config/env.js";

export function createLoggerOptions(
  config: AppConfig,
): FastifyServerOptions["logger"] {
  return {
    level: config.logLevel,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body",
        "body.password",
        "body.token",
        "password",
        "accessToken",
        "refreshToken",
        "apiKey",
        "signedUrl",
      ],
      censor: "[Redacted]",
    },
    serializers: {
      req: (request) => ({
        method: request.method,
        url: request.url.split("?")[0],
        requestId: request.id,
      }),
      res: (reply) => ({ statusCode: reply.statusCode }),
    },
  };
}
