export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EXTERNAL_SERVICE_ERROR"
  | "AI_ANALYSIS_ERROR"
  | "STORAGE_ERROR"
  | "DATABASE_ERROR"
  | "INTERNAL_SERVER_ERROR";

export const errorStatus: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  EXTERNAL_SERVICE_ERROR: 503,
  AI_ANALYSIS_ERROR: 502,
  STORAGE_ERROR: 502,
  DATABASE_ERROR: 503,
  INTERNAL_SERVER_ERROR: 500,
};

export interface AppErrorOptions {
  cause?: unknown;
  details?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = errorStatus[code];
    this.details = options.details;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export class ExternalServiceError extends AppError {
  readonly provider: string;
  readonly operation: string;
  readonly retryable: boolean;

  constructor(
    provider: string,
    operation: string,
    cause?: unknown,
    options: { retryable?: boolean } = {},
  ) {
    super(
      "EXTERNAL_SERVICE_ERROR",
      "An external service is temporarily unavailable",
      { cause },
    );
    this.name = "ExternalServiceError";
    this.provider = provider;
    this.operation = operation;
    this.retryable = options.retryable ?? false;
  }
}
