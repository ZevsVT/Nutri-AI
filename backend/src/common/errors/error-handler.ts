import type { FastifyInstance } from "fastify";
import { AppError, type ErrorCode } from "./app-error.js";

interface FastifyErrorLike {
  code?: string;
  statusCode?: number;
  validation?: unknown[];
  message?: string;
  error?: { code?: string; message?: string };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export function successResponse<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: unknown,
): ApiErrorResponse {
  return {
    success: false,
    error:
      details === undefined ? { code, message } : { code, message, details },
    requestId,
  };
}

function asFastifyError(error: unknown): FastifyErrorLike {
  if (typeof error === "object" && error !== null) {
    return error as FastifyErrorLike;
  }
  return {};
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const candidate = asFastifyError(error);

  if (candidate.code === "FST_ERR_CORS") {
    return new AppError("AUTHORIZATION_ERROR", "Origin is not allowed", {
      cause: error,
    });
  }

  if (candidate.message === "Origin is not allowed") {
    return new AppError("AUTHORIZATION_ERROR", "Origin is not allowed", {
      cause: error,
    });
  }

  if (candidate.error?.code === "RATE_LIMITED") {
    return new AppError("RATE_LIMITED", "Too many requests", { cause: error });
  }

  if (candidate.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
    return new AppError("VALIDATION_ERROR", "Request payload is too large", {
      cause: error,
    });
  }

  if (
    candidate.code === "FST_ERR_CTP_INVALID_JSON_BODY" ||
    candidate.code === "FST_ERR_CTP_INVALID_CONTENT_LENGTH" ||
    candidate.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE" ||
    candidate.code === "FST_REQ_FILE_TOO_LARGE" ||
    candidate.code === "FST_FILES_LIMIT" ||
    candidate.code === "FST_PARTS_LIMIT" ||
    candidate.code === "FST_FIELDS_LIMIT"
  ) {
    return new AppError("VALIDATION_ERROR", "Invalid request payload", {
      cause: error,
    });
  }

  if (candidate.code === "FST_ERR_RATE_LIMIT" || candidate.statusCode === 429) {
    return new AppError("RATE_LIMITED", "Too many requests", { cause: error });
  }

  if (Array.isArray(candidate.validation) || candidate.statusCode === 400) {
    return new AppError("VALIDATION_ERROR", "Invalid request", {
      cause: error,
    });
  }

  return new AppError("INTERNAL_SERVER_ERROR", "An unexpected error occurred", {
    cause: error,
  });
}

export function installErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    const requestId = request.id;
    reply.header("x-request-id", requestId);
    request.log.info(
      {
        event: "route_not_found",
        requestId,
        method: request.method,
        route: request.url.split("?")[0],
      },
      "route_not_found",
    );
    reply
      .code(404)
      .send(
        errorResponse(
          "NOT_FOUND",
          "The requested resource was not found",
          requestId,
        ),
      );
  });

  app.setErrorHandler((error, request, reply) => {
    const normalized = normalizeError(error);
    const requestId = request.id;
    request.log.error(
      {
        event: "request_failed",
        requestId,
        errorCode: normalized.code,
        error: {
          name: normalized.name,
          code: normalized.code,
          statusCode: normalized.statusCode,
          message: normalized.message,
        },
      },
      "request_failed",
    );

    reply.header("x-request-id", requestId);
    reply
      .code(normalized.statusCode)
      .send(
        errorResponse(
          normalized.code,
          normalized.message,
          requestId,
          normalized.details,
        ),
      );
  });
}
