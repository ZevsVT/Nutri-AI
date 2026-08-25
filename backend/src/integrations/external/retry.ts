export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryable: boolean;
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (delayMs: number) => Promise<void>;
}

const defaultSleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  if (!options.retryable || options.retries <= 0) {
    return operation();
  }

  const baseDelayMs = options.baseDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 2_000;
  const sleep = options.sleep ?? defaultSleep;
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (
        attempt >= options.retries ||
        !options.shouldRetry ||
        !options.shouldRetry(error)
      ) {
        throw error;
      }
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      attempt += 1;
      await sleep(delay);
    }
  }
}
