import assert from "node:assert/strict";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app/app.js";
import { loadConfig, type AppConfig } from "../src/config/env.js";

function testConfig(overrides: NodeJS.ProcessEnv = {}): AppConfig {
  return loadConfig({
    NODE_ENV: "development",
    CORS_ORIGINS: "http://localhost:5173",
    ...overrides,
  });
}

async function close(app: FastifyInstance): Promise<void> {
  await app.close();
}

test("health, readiness, and versioned metadata endpoints work", async () => {
  const app = await buildApp({ config: testConfig() });
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), {
      status: "ok",
      service: "nutri-ai-api",
      version: "0.1.0",
    });
    assert.match(health.headers["x-request-id"] as string, /^req_/);
    assert.equal(health.headers["cache-control"], "no-store");
    assert.equal(health.headers["x-content-type-options"], "nosniff");
    assert.equal(health.headers["x-frame-options"], "SAMEORIGIN");

    const ready = await app.inject({ method: "GET", url: "/ready" });
    assert.equal(ready.statusCode, 200);
    assert.deepEqual(ready.json(), { status: "ready" });

    const metadata = await app.inject({ method: "GET", url: "/api/v1" });
    assert.equal(metadata.statusCode, 200);
    assert.deepEqual(metadata.json(), {
      success: true,
      data: { name: "Nutri-AI API", version: "v1", status: "running" },
    });

    const incomingRequestId = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "req_client-correlation-1" },
    });
    assert.equal(
      incomingRequestId.headers["x-request-id"],
      "req_client-correlation-1",
    );

    const unsafeRequestId = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "../../secret" },
    });
    assert.match(unsafeRequestId.headers["x-request-id"] as string, /^req_/);
  } finally {
    await close(app);
  }
});

test("Zod validation returns a safe standardized error", async () => {
  const app = await buildApp({ config: testConfig() });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/foundation/echo",
      payload: { message: "" },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().success, false);
    assert.equal(response.json().error.code, "VALIDATION_ERROR");
    assert.equal(response.json().error.message, "Invalid request body");
    assert.equal(Array.isArray(response.json().error.details), true);
    assert.equal(response.json().requestId, response.headers["x-request-id"]);
  } finally {
    await close(app);
  }
});

test("authentication and authorization foundations reject and allow the expected requests", async () => {
  const app = await buildApp({ config: testConfig({ AUTH_DEV_MODE: "true" }) });
  try {
    const unauthorized = await app.inject({
      method: "GET",
      url: "/api/v1/foundation/me",
    });
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(unauthorized.json().error.code, "AUTHENTICATION_ERROR");

    const user = await app.inject({
      method: "GET",
      url: "/api/v1/foundation/me",
      headers: { "x-development-user-id": "user-1" },
    });
    assert.equal(user.statusCode, 200);
    assert.equal(user.json().data.user.id, "user-1");

    const forbidden = await app.inject({
      method: "GET",
      url: "/api/v1/foundation/admin-check",
      headers: { "x-development-user-id": "user-1" },
    });
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.json().error.code, "AUTHORIZATION_ERROR");

    const authorized = await app.inject({
      method: "GET",
      url: "/api/v1/foundation/admin-check",
      headers: {
        "x-development-user-id": "admin-1",
        "x-development-user-role": "ADMIN",
      },
    });
    assert.equal(authorized.statusCode, 200);
  } finally {
    await close(app);
  }
});

test("rate limiting and security headers are active", async () => {
  const app = await buildApp({
    config: testConfig({ RATE_LIMIT_MAX: "2", RATE_LIMIT_WINDOW_MS: "60000" }),
  });
  try {
    const first = await app.inject({
      method: "GET",
      url: "/api/v1",
      headers: { origin: "http://localhost:5173" },
    });
    const second = await app.inject({ method: "GET", url: "/api/v1" });
    const limited = await app.inject({ method: "GET", url: "/api/v1" });
    assert.equal(
      first.headers["access-control-allow-origin"],
      "http://localhost:5173",
    );
    assert.equal(first.headers["x-content-type-options"], "nosniff");
    assert.equal(second.statusCode, 200);
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.json().error.code, "RATE_LIMITED");
    assert.equal(limited.headers["x-ratelimit-limit"], "2");
    assert.equal(typeof limited.headers["retry-after"], "string");
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);
  } finally {
    await close(app);
  }
});

test("allowed CORS preflight and bounded payload failures are handled", async () => {
  const app = await buildApp({
    config: testConfig({ REQUEST_BODY_LIMIT_BYTES: "128" }),
  });
  try {
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/foundation/echo",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
      },
    });
    assert.equal(preflight.statusCode, 204);
    assert.equal(
      preflight.headers["access-control-allow-origin"],
      "http://localhost:5173",
    );

    const oversized = await app.inject({
      method: "POST",
      url: "/api/v1/foundation/echo",
      payload: { message: "x".repeat(1_000) },
    });
    assert.equal(oversized.statusCode, 400);
    assert.equal(oversized.json().error.code, "VALIDATION_ERROR");

    const malformedJson = await app.inject({
      method: "POST",
      url: "/api/v1/foundation/echo",
      headers: { "content-type": "application/json" },
      payload: '{"message":',
    });
    assert.equal(malformedJson.statusCode, 400);
    assert.equal(malformedJson.json().error.code, "VALIDATION_ERROR");
  } finally {
    await close(app);
  }
});

test("unexpected CORS origins are rejected with a request ID", async () => {
  const app = await buildApp({ config: testConfig() });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://unexpected.example" },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "AUTHORIZATION_ERROR");
    assert.equal(response.json().requestId, response.headers["x-request-id"]);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  } finally {
    await close(app);
  }
});

test("unexpected errors do not leak implementation details", async () => {
  const app = await buildApp({
    config: testConfig(),
    registerAdditionalRoutes: async (instance) => {
      instance.get("/test/internal-error", async () => {
        throw new Error("database password should not be returned");
      });
    },
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/test/internal-error",
    });
    assert.equal(response.statusCode, 500);
    assert.equal(response.json().error.code, "INTERNAL_SERVER_ERROR");
    assert.equal(response.json().error.message, "An unexpected error occurred");
    assert.equal(response.body.includes("database password"), false);
  } finally {
    await close(app);
  }
});

test("readiness hides dependency failures", async () => {
  const app = await buildApp({
    config: testConfig(),
    readinessChecks: [
      {
        name: "database",
        check: async () => {
          throw new Error("connection details");
        },
      },
    ],
  });
  try {
    const response = await app.inject({ method: "GET", url: "/ready" });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { status: "not_ready" });
  } finally {
    await close(app);
  }
});
