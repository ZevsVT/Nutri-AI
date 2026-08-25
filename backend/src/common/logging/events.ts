import type { FastifyBaseLogger } from "fastify";

interface RequestEventFields {
  requestId: string;
  method: string;
  route: string;
}

export function logAuthenticationFailure(
  logger: FastifyBaseLogger,
  fields: RequestEventFields,
): void {
  logger.warn(
    { event: "authentication_failed", ...fields },
    "authentication_failed",
  );
}

export function logAuthorizationFailure(
  logger: FastifyBaseLogger,
  fields: RequestEventFields,
): void {
  logger.warn(
    { event: "authorization_failed", ...fields },
    "authorization_failed",
  );
}

export function logExternalFailure(
  logger: FastifyBaseLogger,
  fields: {
    provider: string;
    operation: string;
    requestId?: string;
    userId?: string;
    durationMs?: number;
  },
  error?: unknown,
): void {
  logger.error(
    {
      event: "external_service_failed",
      status: "failed",
      ...fields,
      errorType: error instanceof Error ? error.name : "unknown",
    },
    "external_service_failed",
  );
}

export function logExternalCompletion(
  logger: FastifyBaseLogger,
  fields: {
    provider: string;
    operation: string;
    requestId?: string;
    userId?: string;
    durationMs: number;
  },
): void {
  logger.info(
    { event: "external_service_completed", status: "success", ...fields },
    "external_service_completed",
  );
}
