# Nutri-AI backend

This directory contains the production backend foundation from Issue #6 and
the PostgreSQL + Prisma persistence foundation from Issue #7. It provides a
versioned Fastify REST API, security and operational middleware, typed error and
response contracts, health/readiness checks, Prisma migrations/seeds, and
focused data-access repositories. Product HTTP routes, full authentication,
storage, billing, and provider integrations remain subsequent issues.

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

| Variable                                  | Purpose                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                                | `development`, `staging`, or `production`.                                                             |
| `PORT`                                    | HTTP port; defaults to `4000`.                                                                         |
| `API_BASE_URL`                            | Base URL used in OpenAPI metadata; staging and production require HTTPS.                               |
| `DATABASE_URL`                            | PostgreSQL connection string used by Prisma, migrations, seed, and readiness checks.                   |
| `POSTGRES_DB`, `POSTGRES_USER`            | Local PostgreSQL database and role names.                                                              |
| `POSTGRES_PASSWORD`, `POSTGRES_PORT`      | Local PostgreSQL credentials and host port.                                                            |
| `JWT_SECRET`, `JWT_EXPIRES_IN`            | Authentication configuration reserved for Issue #8. A strong secret is required in staging/production. |
| `CORS_ORIGINS`                            | Comma-separated allowlist. Wildcard CORS is rejected in production.                                    |
| `STORAGE_PROVIDER`, `STORAGE_BUCKET`      | Future storage provider configuration.                                                                 |
| `AI_PROVIDER`, `AI_API_KEY`               | Future AI provider configuration. A key is required when a provider is selected.                       |
| `NUTRITION_PROVIDER`, `NUTRITION_API_KEY` | Future nutrition provider configuration.                                                               |
| `LOG_LEVEL`                               | Pino log level. Production logs are JSON.                                                              |
| `AUTH_DEV_MODE`                           | Development-only mock identity headers for foundation tests; keep `false` outside development.         |
| `REQUEST_BODY_LIMIT_BYTES`                | Maximum HTTP request body size.                                                                        |
| `FILE_UPLOAD_LIMIT_BYTES`                 | Fastify multipart file size limit.                                                                     |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`  | Global rate-limit defaults. Route-specific limits can be added later.                                  |
| `EXTERNAL_REQUEST_TIMEOUT_MS`             | Default timeout for future provider calls.                                                             |
| `EXTERNAL_RETRY_LIMIT`                    | Maximum retry budget for explicitly safe/idempotent operations.                                        |
| `SHUTDOWN_TIMEOUT_MS`                     | Maximum graceful-shutdown window.                                                                      |
| `TRUST_PROXY`                             | Enables proxy-aware client IP handling; only enable when the deployment proxy is trusted.              |

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
GET /api/v1
GET /docs
```

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

Authentication is deliberately a foundation only. In development, `AUTH_DEV_MODE=true` enables test-only `X-Development-User-*` headers. Production does not accept those headers and has no fake authentication. Issue #8 can connect a secure session or access/refresh-token implementation through `SessionTokenProvider` and the authentication middleware. Authorization uses server-side roles and permissions and already includes `USER`, `ADMIN`, `MODERATOR`, `NUTRITION_EDITOR`, and `SUPPORT` role types.

Readiness starts with application initialization and accepts injected dependency checks. When `DATABASE_URL` is configured, the backend creates one shared Prisma client and `/ready` verifies it with `SELECT 1`. Shutdown handles `SIGTERM` and `SIGINT`, closes Fastify first, then disconnects Prisma within a bounded timeout. Domain tables, migrations, seed data, and focused repositories live under `prisma/` and `src/modules/`.

The global rate limiter currently uses Fastify's in-memory store. This is
appropriate for local development and a single API instance; before deploying
multiple API replicas, replace it with a shared store (for example Redis) and
keep `TRUST_PROXY` aligned with the actual load balancer so client IPs cannot
be spoofed.

## Docker

```bash
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d postgres
docker build -t nutri-ai-api ./backend
docker run --rm -p 4000:4000 --env-file backend/.env nutri-ai-api
```

The image uses a multi-stage build, installs only production dependencies in the final stage, runs as a non-root user, contains no secrets, and has a `/health` Docker health check.

## Security and scope

Inputs are validated before controllers run. CORS uses a configured allowlist, headers are hardened with Helmet, request and multipart payloads are bounded, and rate limiting is global by default. Logs intentionally exclude request bodies, credentials, tokens, API keys, and image bytes. Error responses never include provider exceptions or stack traces.

Full authentication, production image storage, meal CRUD HTTP routes, AI recognition/chat providers, subscriptions, dashboards, and CI/CD remain intentionally deferred to their respective issues. See [`docs/database.md`](../docs/database.md) for the database design and workflow. `npm run audit` checks all locked dependencies; if the registry audit service is unavailable, the command is reported as not verified rather than treated as a clean result.
