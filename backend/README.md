# Nutri-AI backend

This directory contains the production backend foundation from Issue #6 and
the PostgreSQL + Prisma persistence foundation from Issue #7. It provides a
versioned Fastify REST API, security and operational middleware, typed error and
response contracts, health/readiness checks, Prisma migrations/seeds, focused
data-access repositories, and private image storage for meal analysis.

## Local setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env`. If PostgreSQL is
enabled, replace the local password placeholder and set `DATABASE_URL` to the
same credentials before starting the API. Apply the schema with
`npm run db:migrate` and load development data with `npm run db:seed`.

The API listens on `http://localhost:4000` by default. The frontend remains at `http://localhost:5173`; add its origin to `CORS_ORIGINS` when using a different frontend URL. Server secrets stay in the backend environment and are never exposed to the frontend.

## Environment variables

| Variable                                                | Purpose                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                              | `development`, `staging`, or `production`.                                                     |
| `PORT`                                                  | HTTP port; defaults to `4000`.                                                                 |
| `API_BASE_URL`                                          | Base URL used in OpenAPI metadata; staging and production require HTTPS.                       |
| `DATABASE_URL`                                          | PostgreSQL connection string used by Prisma, migrations, seed, and readiness checks.           |
| `POSTGRES_DB`, `POSTGRES_USER`                          | Local PostgreSQL database and role names.                                                      |
| `POSTGRES_PASSWORD`, `POSTGRES_PORT`                    | Local PostgreSQL credentials and role names.                                                   |
| `JWT_SECRET`, `JWT_EXPIRES_IN`                          | Legacy token configuration retained for compatibility; sessions are used by Issue #8.          |
| `AUTH_SESSION_TTL_HOURS`                                | Server-managed session lifetime; defaults to 30 days.                                          |
| `PASSWORD_RESET_TTL_MINUTES`                            | Password-reset credential lifetime; defaults to 30 minutes.                                    |
| `CORS_ORIGINS`                                          | Comma-separated allowlist. Wildcard CORS is rejected in production.                            |
| `STORAGE_PROVIDER`, `STORAGE_BUCKET`                    | `local` for development or `s3` for private S3-compatible object storage.                      |
| `STORAGE_REGION`, `STORAGE_ENDPOINT`                    | S3 region and optional S3-compatible endpoint.                                                 |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`              | Server-only S3 credentials; never expose them to the frontend.                                 |
| `STORAGE_LOCAL_ROOT`                                    | Private filesystem root used by the local provider.                                            |
| `STORAGE_READ_URL_TTL_SECONDS`                          | Short-lived S3 read URL lifetime; local reads remain authenticated API requests.               |
| `STORAGE_TEMPORARY_TTL_HOURS`, `STORAGE_RETENTION_DAYS` | Abandoned upload and soft-deleted meal retention windows.                                      |
| `AI_PROVIDER`, `AI_API_KEY`                             | Future provider configuration. A key is required when a provider is selected.                  |
| `NUTRITION_PROVIDER`, `NUTRITION_API_KEY`               | Future nutrition provider configuration.                                                       |
| `LOG_LEVEL`                                             | Pino log level. Production logs are JSON.                                                      |
| `AUTH_DEV_MODE`                                         | Development-only mock identity headers for foundation tests; keep `false` outside development. |
| `REQUEST_BODY_LIMIT_BYTES`                              | Maximum HTTP request body size.                                                                |
| `FILE_UPLOAD_LIMIT_BYTES`                               | Fastify multipart file size limit.                                                             |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`                | Global rate-limit ceiling and fixed-window duration.                                           |
| `RATE_LIMIT_ENABLED`                                    | Enables the in-process limiter; defaults to `true`.                                            |
| `RATE_LIMIT_AUTH_MAX`                                   | Authentication-route ceiling, bounded by `RATE_LIMIT_MAX`; defaults to `10`.                   |
| `RATE_LIMIT_EXPENSIVE_MAX`                              | AI, meal-analysis, and barcode ceiling, bounded by the global maximum; defaults to `20`.       |
| `RATE_LIMIT_UPLOAD_MAX`                                 | Image-upload ceiling, bounded by the global maximum; defaults to `10`.                         |
| `EXTERNAL_REQUEST_TIMEOUT_MS`                           | Default timeout for future provider calls.                                                     |
| `EXTERNAL_RETRY_LIMIT`                                  | Maximum retry budget for explicitly safe/idempotent operations.                                |
| `SHUTDOWN_TIMEOUT_MS`                                   | Maximum graceful-shutdown window.                                                              |
| `TRUST_PROXY`                                           | Enables proxy-aware client IP handling; only enable when the deployment proxy is trusted.      |

Configuration is parsed with Zod during startup. Invalid staging/production configuration fails fast.

## Development commands

```bash
npm run dev
npm run build
npm run start
npm run test
npm run lint
npm run typecheck
npm run format:check
npm run audit
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
```

## API contract

Operational endpoints:

```text
GET /health
GET /ready
GET /health/live
GET /health/ready
GET /metrics
GET /api/v1
GET /docs
```

`/health/live` is a small process liveness response. `/health/ready` and the
legacy `/ready` endpoint return `200 {"status":"ready"}` only after the app
has initialized and all configured mandatory dependency checks pass; otherwise
they return `503 {"status":"not_ready"}`. Dependency names and failure
details are logged server-side and are not returned by health endpoints.

`/metrics` is an in-process Prometheus-compatible snapshot intended for a
single API instance. It reports `http_requests_total`, request duration and
error counters, `rate_limit_rejections_total`, and
`dependency_errors_total`. Labels are limited to method, route template,
status, dependency, operation, or limiter category; request IDs, user IDs,
resource IDs, query strings, and private URLs are never metric labels.

Successful business-style responses use `{ "success": true, "data": ... }`. Errors use:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid request body" },
  "requestId": "req_..."
}
```

All errors include the correlation ID. `X-Request-ID` is accepted when it matches the safe ID format and is generated otherwise; the response and structured logs use the same ID. The foundation demo routes under `/api/v1/foundation` exist only to exercise validation, authentication, and authorization contracts and are not product APIs.

OpenAPI is available at `/docs` and `/docs/json`.

## Architecture

```text
Route
  -> Controller
  -> Application service
  -> Repository/provider interface
  -> Database, AI, nutrition, or storage adapter
```

Fastify was selected because no backend existed, and its plugin lifecycle, request hooks, and TypeScript support fit this small SaaS foundation. Zod validates environment and external request data. Fastify's Pino logger emits structured JSON, including request events and latency. CORS, Helmet, multipart limits, rate limiting, request IDs, and sanitized centralized errors are installed in the application bootstrap.

The AI, nutrition, storage, session-token, and repository interfaces in `src/integrations` and `src/modules` are dependency-inversion boundaries. `withTimeout`, `withRetry`, and `executeExternal` provide shared provider failure handling. Retries are opt-in and therefore cannot accidentally retry non-idempotent future writes.

Authentication uses server-managed sessions. Only a scrypt password hash, a SHA-256 hash of each random session secret, and a SHA-256 hash of each reset secret are persisted. The raw session secret is sent in an HttpOnly, SameSite=Lax cookie and is Secure outside development. Sessions are revoked on logout and password reset. In development, `AUTH_DEV_MODE=true` continues to enable test-only `X-Development-User-*` headers for foundation routes; production does not accept those headers. Authorization uses server-side roles and permissions and includes `USER`, `ADMIN`, `MODERATOR`, `NUTRITION_EDITOR`, and `SUPPORT` role types.

Readiness starts with application initialization and accepts injected dependency checks. When `DATABASE_URL` is configured, the backend creates one shared Prisma client and `/ready` verifies it with `SELECT 1`. Shutdown handles `SIGTERM` and `SIGINT`, closes Fastify first, then disconnects Prisma within a bounded timeout. Domain tables, migrations, seed data, and focused repositories live under `prisma/` and `src/modules/`.

The rate limiter uses Fastify's in-memory store and a fixed window. General
traffic uses `RATE_LIMIT_MAX`; authentication, expensive operations
(`POST /api/v1/meal-analysis`, `POST /api/v1/ai/chat`, and barcode lookup),
and image uploads use their respective lower ceilings. Private routes are
keyed by the server-resolved authenticated user after authentication; public
and anonymous routes use the request IP. Forwarded IP headers are only trusted
when `TRUST_PROXY=true`. Before deploying multiple API replicas, replace the
in-memory store with a shared store (for example Redis) while keeping
`TRUST_PROXY` aligned with the actual load balancer.

## Docker

```bash
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d postgres
docker build -t nutri-ai-api ./backend
docker run --rm -p 4000:4000 --env-file backend/.env nutri-ai-api
```

The image uses a multi-stage build, installs only production dependencies in the final stage, runs as a non-root user, contains no secrets, and has a `/health` Docker health check.

## Security and scope

Inputs are validated before controllers run. CORS uses a configured allowlist, headers are hardened with Helmet, request and multipart payloads are bounded, and rate limiting is enabled by default. Every request receives a validated `X-Request-ID` or a server-generated ID, which is returned in the response and included in structured logs and errors. Logs intentionally exclude request bodies, credentials, tokens, API keys, signed URLs, and image bytes. Error responses never include provider exceptions or stack traces.

Operational troubleshooting:

- For repeated `429` responses, inspect the structured `route`, `limiterCategory`, and configured category/global ceilings. `Retry-After` is returned by the limiter.
- For `503` readiness responses, inspect `readiness_check_failed` events and the corresponding `dependency_errors_total` metric. Client responses stay coarse.
- Use the response `requestId` to correlate request completion, application error, provider, database, and storage events.
- Storage cleanup failures are emitted as `storage_cleanup_failed`; logs contain only safe object identifiers and error types, never object URLs or credentials.

Authentication endpoints are `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `POST /api/v1/auth/password-reset/request`, and `POST /api/v1/auth/password-reset/confirm`. Private storage endpoints and the image-analysis flow are documented in [`docs/storage.md`](../docs/storage.md). Password reset delivery is behind an email provider abstraction; the default local provider intentionally sends nothing and never returns reset credentials. Production deployment must provide a real mail provider before enabling password reset. See [`docs/database.md`](../docs/database.md) for the database design and workflow. `npm run audit` checks all locked dependencies; if the registry audit service is unavailable, the command is reported as not verified rather than treated as a clean result.
