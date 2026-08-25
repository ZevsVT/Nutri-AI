import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../src/app/app.js";
import { createShutdownHandler } from "../src/app/shutdown.js";
import { loadConfig } from "../src/config/env.js";

test("graceful shutdown closes the app and cleanup exactly once", async () => {
  const app = await buildApp({
    config: loadConfig({
      NODE_ENV: "development",
      CORS_ORIGINS: "http://localhost:5173",
    }),
  });
  let cleanupCalls = 0;
  const exitCodes: number[] = [];
  const shutdown = createShutdownHandler(app, {
    timeoutMs: 1_000,
    cleanup: async () => {
      cleanupCalls += 1;
    },
    exit: (code) => exitCodes.push(code),
  });

  await shutdown("SIGTERM");
  await shutdown("SIGINT");

  assert.equal(cleanupCalls, 1);
  assert.deepEqual(exitCodes, [0]);
});
