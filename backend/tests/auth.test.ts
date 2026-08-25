import assert from "node:assert/strict";
import type { OutgoingHttpHeaders } from "node:http";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app/app.js";
import { InMemoryAuthRepository } from "../src/modules/auth/auth.repository.js";
import type { PasswordResetEmailProvider } from "../src/modules/auth/auth.email.js";
import { loadConfig, type AppConfig } from "../src/config/env.js";

function testConfig(overrides: NodeJS.ProcessEnv = {}): AppConfig {
  return loadConfig({
    NODE_ENV: "development",
    CORS_ORIGINS: "http://localhost:5173",
    ...overrides,
  });
}

function cookieFrom(response: { headers: OutgoingHttpHeaders }): string {
  const value = response.headers["set-cookie"];
  const cookie = Array.isArray(value) ? value[0] : value;
  assert.ok(cookie);
  const first = cookie.split(";", 1)[0];
  assert.ok(first);
  return first;
}

async function close(app: FastifyInstance): Promise<void> {
  await app.close();
}

test("registration, login, current user, and logout use a revocable session cookie", async () => {
  const repository = new InMemoryAuthRepository();
  const app = await buildApp({
    config: testConfig(),
    authRepository: repository,
  });
  try {
    const registration = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: " Test@Example.com ",
        name: "Test User",
        password: "correct horse battery",
      },
    });
    assert.equal(registration.statusCode, 201);
    assert.equal(registration.json().data.user.email, "test@example.com");
    assert.equal("passwordHash" in registration.json().data.user, false);
    const stored = await repository.findUserByEmail("test@example.com");
    assert.ok(stored?.passwordHash);
    assert.notEqual(stored.passwordHash, "correct horse battery");
    const cookie = cookieFrom(registration);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().data.user.email, "test@example.com");
    assert.equal("passwordHash" in me.json().data.user, false);

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie },
    });
    assert.equal(logout.statusCode, 200);
    const afterLogout = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });
    assert.equal(afterLogout.statusCode, 401);
  } finally {
    await close(app);
  }
});

test("login rejects invalid credentials and preserves the safe authentication contract", async () => {
  const app = await buildApp({ config: testConfig() });
  try {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "login@example.com",
        name: "Login User",
        password: "correct horse battery",
      },
    });
    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "login@example.com", password: "wrong password" },
    });
    const unknownUser = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "unknown@example.com", password: "wrong password" },
    });
    assert.equal(wrongPassword.statusCode, 401);
    assert.equal(unknownUser.statusCode, 401);
    assert.equal(wrongPassword.json().error.code, "INVALID_CREDENTIALS");
    assert.equal(unknownUser.json().error.code, "INVALID_CREDENTIALS");
  } finally {
    await close(app);
  }
});

test("registration validates input, prevents duplicate identities, and enforces account status", async () => {
  const repository = new InMemoryAuthRepository();
  const app = await buildApp({
    config: testConfig(),
    authRepository: repository,
  });
  try {
    const invalidEmail = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "not-an-email", name: "User", password: "short" },
    });
    assert.equal(invalidEmail.statusCode, 400);
    const payload = {
      email: "status@example.com",
      name: "Status User",
      password: "correct horse battery",
    };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/register",
          payload,
        })
      ).statusCode,
      201,
    );
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload,
    });
    assert.equal(duplicate.statusCode, 409);
    const user = await repository.findUserByEmail(payload.email);
    assert.ok(user);
    repository.setUserStatus(user.id, "SUSPENDED");
    const suspended = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: payload.email, password: payload.password },
    });
    assert.equal(suspended.statusCode, 403);
    assert.equal(suspended.json().error.code, "ACCOUNT_SUSPENDED");
    repository.setUserStatus(user.id, "DELETED");
    const deleted = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: payload.email, password: payload.password },
    });
    assert.equal(deleted.statusCode, 401);
    assert.equal(deleted.json().error.code, "ACCOUNT_DEACTIVATED");
  } finally {
    await close(app);
  }
});

test("password reset is single-use and invalidates previous sessions", async () => {
  let resetToken: string | undefined;
  const mailer: PasswordResetEmailProvider = {
    async sendPasswordReset(input) {
      resetToken = input.token;
    },
  };
  const app = await buildApp({
    config: testConfig(),
    passwordResetEmailProvider: mailer,
  });
  try {
    const registration = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "reset@example.com",
        name: "Reset User",
        password: "correct horse battery",
      },
    });
    const oldCookie = cookieFrom(registration);
    const request = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/request",
      payload: { email: "reset@example.com" },
    });
    assert.equal(request.statusCode, 200);
    assert.ok(resetToken);
    if (!resetToken)
      throw new Error("test mailer did not receive a reset token");
    const reset = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/confirm",
      payload: { token: resetToken, password: "new correct battery" },
    });
    assert.equal(reset.statusCode, 200);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          headers: { cookie: oldCookie },
        })
      ).statusCode,
      401,
    );
    const oldPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "reset@example.com",
        password: "correct horse battery",
      },
    });
    assert.equal(oldPassword.statusCode, 401);
    const secondUse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/confirm",
      payload: { token: resetToken, password: "another correct battery" },
    });
    assert.equal(secondUse.statusCode, 401);
  } finally {
    await close(app);
  }
});

test("auth endpoints are covered by the existing rate limiter", async () => {
  const app = await buildApp({
    config: testConfig({ RATE_LIMIT_MAX: "2", RATE_LIMIT_WINDOW_MS: "60000" }),
  });
  try {
    const payload = {
      email: "rate@example.com",
      name: "Rate User",
      password: "correct horse battery",
    };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/register",
          payload,
        })
      ).statusCode,
      201,
    );
    const loginPayload = { email: payload.email, password: "wrong password" };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: loginPayload,
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: loginPayload,
        })
      ).statusCode,
      429,
    );
  } finally {
    await close(app);
  }
});
