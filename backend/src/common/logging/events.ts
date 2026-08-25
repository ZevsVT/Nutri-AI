import type { FastifyBaseLogger } from "fastify";

interface RequestEventFields {
  requestId: string;
  method: string;
  route: string;
}

export type AuthenticationEvent =
  | "REGISTER_SUCCESS"
  | "REGISTER_FAILURE"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED";

export function logAuthEvent(
  logger: FastifyBaseLogger,
  event: AuthenticationEvent,
  requestId: string,
  userId?: string,
): void {
  logger.info({ event, requestId, ...(userId ? { userId } : {}) }, event);
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
