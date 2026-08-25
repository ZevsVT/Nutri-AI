import { ExternalServiceError } from "../../common/errors/app-error.js";

export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  context: { provider: string; operation: string },
  parentSignal?: AbortSignal,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be greater than zero");
  }

  const controller = new AbortController();
  const timeoutError = new ExternalServiceError(
    context.provider,
    context.operation,
    undefined,
    { retryable: true },
  );
  const abortError = () =>
    new ExternalServiceError(
      context.provider,
      context.operation,
      parentSignal?.reason,
      { retryable: false },
    );
  let timer: NodeJS.Timeout | undefined;
  let rejectAbort: ((error: ExternalServiceError) => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => {
    controller.abort(parentSignal?.reason);
    rejectAbort?.(abortError());
  };

  try {
    if (parentSignal?.aborted) {
      onAbort();
    } else {
      parentSignal?.addEventListener("abort", onAbort, { once: true });
    }

    const operationPromise = Promise.resolve().then(() =>
      operation(controller.signal),
    );
    return await Promise.race([
      operationPromise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort(timeoutError);
          reject(timeoutError);
        }, timeoutMs);
      }),
      abortPromise,
    ]);
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error;
    }
    throw new ExternalServiceError(context.provider, context.operation, error, {
      retryable: false,
    });
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    parentSignal?.removeEventListener("abort", onAbort);
  }
}
