import type { FastifyBaseLogger } from "fastify";
import { ExternalServiceError } from "../../common/errors/app-error.js";
import { logExternalFailure } from "../../common/logging/events.js";
import { withRetry } from "./retry.js";
import { withTimeout } from "./timeout.js";

export interface ExternalOperationOptions {
  provider: string;
  operation: string;
  timeoutMs: number;
  retries: number;
  retryable: boolean;
  requestId?: string;
  userId?: string;
  signal?: AbortSignal;
  logger?: FastifyBaseLogger;
}

export async function executeExternal<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: ExternalOperationOptions,
): Promise<T> {
  const startedAt = performance.now();

  try {
    const result = await withRetry(
      () =>
        withTimeout(
          operation,
          options.timeoutMs,
          {
            provider: options.provider,
            operation: options.operation,
          },
          options.signal,
        ),
      {
        retries: options.retries,
        retryable: options.retryable,
        shouldRetry: (error) =>
          options.retryable &&
          error instanceof ExternalServiceError &&
          error.retryable,
      },
    );
    if (options.logger) {
      options.logger.info(
        {
          event: "external_service_completed",
          status: "success",
          provider: options.provider,
          operation: options.operation,
          requestId: options.requestId,
          userId: options.userId,
          durationMs: Math.round(performance.now() - startedAt),
        },
        "external_service_completed",
      );
    }
    return result;
  } catch (error) {
    if (options.logger) {
      logExternalFailure(
        options.logger,
        {
          provider: options.provider,
          operation: options.operation,
          requestId: options.requestId,
          userId: options.userId,
          durationMs: Math.round(performance.now() - startedAt),
        },
        error,
      );
    }
    throw error;
  }
}
