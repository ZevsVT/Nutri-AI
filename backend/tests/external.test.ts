import assert from "node:assert/strict";
import { test } from "node:test";
import { ExternalServiceError } from "../src/common/errors/app-error.js";
import { withRetry } from "../src/integrations/external/retry.js";
import { withTimeout } from "../src/integrations/external/timeout.js";

test("external operations time out with a safe typed error", async () => {
  await assert.rejects(
    withTimeout(() => new Promise<string>(() => undefined), 5, {
      provider: "test",
      operation: "slow-operation",
    }),
    ExternalServiceError,
  );
});

test("retry is opt-in and bounded", async () => {
  let attempts = 0;
  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("temporary");
      }
      return "ok";
    },
    {
      retries: 2,
      retryable: true,
      shouldRetry: (error) =>
        error instanceof Error && error.message === "temporary",
      sleep: async () => undefined,
    },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);

  attempts = 0;
  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1;
        throw new Error("not safe to retry");
      },
      { retries: 3, retryable: false },
    ),
  );
  assert.equal(attempts, 1);
});

test("timeout aborts operations that support cancellation", async () => {
  let aborted = false;
  await assert.rejects(
    withTimeout(
      (signal) =>
        new Promise<string>((_, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
      5,
      { provider: "test", operation: "cancellable-operation" },
    ),
    ExternalServiceError,
  );
  assert.equal(aborted, true);
});

test("retry does not retry when no retry predicate is supplied", async () => {
  let attempts = 0;
  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1;
        throw new Error("not classified");
      },
      { retries: 3, retryable: true, sleep: async () => undefined },
    ),
  );
  assert.equal(attempts, 1);
});
