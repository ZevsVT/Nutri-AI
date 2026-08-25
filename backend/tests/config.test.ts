import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigurationError, loadConfig } from "../src/config/env.js";

test("development config has safe defaults", () => {
  const config = loadConfig({});
  assert.equal(config.nodeEnv, "development");
  assert.equal(config.port, 4000);
  assert.deepEqual(config.corsOrigins, ["http://localhost:5173"]);
});

test("production config fails fast without a strong JWT secret", () => {
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "production",
        API_BASE_URL: "https://api.example.com",
        CORS_ORIGINS: "https://app.example.com",
      }),
    ConfigurationError,
  );
});

test("production config rejects wildcard CORS", () => {
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "production",
        API_BASE_URL: "https://api.example.com",
        CORS_ORIGINS: "*",
        JWT_SECRET: "a-secret-that-is-longer-than-thirty-two-characters",
      }),
    /CORS_ORIGINS cannot use/,
  );
});

test("secure environments require an explicit CORS allowlist", () => {
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "staging",
        API_BASE_URL: "https://staging-api.example.com",
        JWT_SECRET: "a-secret-that-is-longer-than-thirty-two-characters",
      }),
    /CORS_ORIGINS must contain/,
  );
});

test("secure environments reject non-HTTPS origins and invalid origin syntax", () => {
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "production",
        API_BASE_URL: "https://api.example.com",
        CORS_ORIGINS: "http://app.example.com",
        JWT_SECRET: "a-secret-that-is-longer-than-thirty-two-characters",
      }),
    /CORS_ORIGINS must use HTTPS/,
  );

  assert.throws(
    () => loadConfig({ CORS_ORIGINS: "https://app.example.com/path" }),
    /CORS_ORIGINS must contain origins only/,
  );
});

test("configured storage requires an explicit bucket", () => {
  assert.throws(
    () => loadConfig({ STORAGE_PROVIDER: "s3" }),
    /STORAGE_BUCKET is required/,
  );
});

test("proxy and payload settings are parsed with safe bounds", () => {
  const config = loadConfig({
    TRUST_PROXY: "true",
    REQUEST_BODY_LIMIT_BYTES: "2048",
  });
  assert.equal(config.trustProxy, true);
  assert.equal(config.requestBodyLimitBytes, 2048);
  assert.throws(() => loadConfig({ RATE_LIMIT_MAX: "0" }), ConfigurationError);
  assert.throws(
    () => loadConfig({ FILE_UPLOAD_LIMIT_BYTES: "999999999" }),
    ConfigurationError,
  );
});

test("URL-like configuration values use the expected protocols", () => {
  assert.throws(
    () => loadConfig({ API_BASE_URL: "ftp://api.example.com" }),
    ConfigurationError,
  );
  assert.throws(
    () => loadConfig({ DATABASE_URL: "mysql://user:password@localhost/db" }),
    ConfigurationError,
  );
  assert.throws(
    () => loadConfig({ JWT_EXPIRES_IN: "forever" }),
    ConfigurationError,
  );
});
