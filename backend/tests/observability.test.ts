import assert from "node:assert/strict";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app/app.js";
import { createLoggerOptions } from "../src/common/logging/logger.js";
import { loadConfig, type AppConfig } from "../src/config/env.js";

function config(overrides: NodeJS.ProcessEnv = {}): AppConfig {
  return loadConfig({
    NODE_ENV: "development",
    CORS_ORIGINS: "http://localhost:5173",
    ...overrides,
  });
}

async function close(app: FastifyInstance): Promise<void> {
  await app.close();
}

test("liveness aliases and metrics expose safe operational data", async () => {
  const app = await buildApp({ config: config() });
  try {
    const live = await app.inject({ method: "GET", url: "/health/live" });
    assert.equal(live.statusCode, 200);
    assert.deepEqual(live.json(), { status: "ok" });

    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    assert.equal(ready.statusCode, 200);
    assert.deepEqual(ready.json(), { status: "ready" });

    const metrics = await app.inject({ method: "GET", url: "/metrics" });
    assert.equal(metrics.statusCode, 200);
    assert.match(metrics.body, /http_requests_total/);
    assert.match(metrics.body, /http_request_duration_ms/);
    assert.match(metrics.body, /route="\/health\/live"/);
    assert.match(metrics.body, /status="200"/);
    assert.equal(metrics.body.includes("requestId"), false);
  } finally {
    await close(app);
  }
});

test("readiness failures are coarse to clients and measurable internally", async () => {
  const app = await buildApp({
    config: config(),
    readinessChecks: [
      {
        name: "database",
        check: async () => {
          throw new Error("private connection details");
        },
      },
    ],
  });
  try {
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { status: "not_ready" });
    assert.equal(response.body.includes("connection details"), false);

    const metrics = await app.inject({ method: "GET", url: "/metrics" });
    assert.match(
      metrics.body,
      /dependency_errors_total\{dependency="database",operation="readiness"\} 1/,
    );
  } finally {
    await close(app);
  }
});

test("rate-limit tiers and configuration cannot be bypassed by forwarded headers", async () => {
  const app = await buildApp({
    config: config({
      AUTH_DEV_MODE: "true",
      RATE_LIMIT_MAX: "100",
      RATE_LIMIT_EXPENSIVE_MAX: "1",
    }),
  });
  try {
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/ai/chat",
      headers: {
        "x-development-user-id": "user-a",
        "x-forwarded-for": "198.51.100.10",
      },
      payload: { message: "First" },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/ai/chat",
      headers: {
        "x-development-user-id": "user-a",
        "x-forwarded-for": "198.51.100.11",
      },
      payload: { message: "Second" },
    });
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 429);
    assert.equal(second.json().error.code, "RATE_LIMITED");
    assert.equal(second.json().requestId, second.headers["x-request-id"]);

    const metrics = await app.inject({ method: "GET", url: "/metrics" });
    assert.match(metrics.body, /rate_limit_rejections_total/);
    assert.match(metrics.body, /route="\/api\/v1\/ai\/chat"/);
  } finally {
    await close(app);
  }
});

test("rate limiting can be disabled explicitly without changing request metrics", async () => {
  const app = await buildApp({
    config: config({ RATE_LIMIT_ENABLED: "false", RATE_LIMIT_MAX: "1" }),
  });
  try {
    const first = await app.inject({ method: "GET", url: "/api/v1" });
    const second = await app.inject({ method: "GET", url: "/api/v1" });
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(
      /^rate_limit_rejections_total/m.test(app.metrics.toPrometheus()),
      false,
    );
  } finally {
    await close(app);
  }
});

test("request serializers do not include credentials or request bodies", () => {
  const options = createLoggerOptions(config());
  const requestSerializer =
    options && typeof options === "object" && "serializers" in options
      ? options.serializers?.req
      : undefined;
  assert.equal(typeof requestSerializer, "function");
  const serialized = requestSerializer?.({
    method: "POST",
    url: "/api/v1/auth/login?token=private",
    id: "req_safe",
    headers: { authorization: "Bearer secret", cookie: "session=secret" },
    body: { password: "secret" },
  } as never);
  assert.deepEqual(serialized, {
    method: "POST",
    url: "/api/v1/auth/login",
    requestId: "req_safe",
  });
});
