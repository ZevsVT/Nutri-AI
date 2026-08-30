# CI/CD and environments

## Environments

Development uses the Vite demo frontend and the backend's local `.env` plus
the PostgreSQL service in `backend/docker-compose.yml`. Copy
`.env.example` (and `backend/.env.example`) locally; backend credentials and
provider keys stay server-side.

Staging and production are separate GitHub Environments with separate
`DATABASE_URL` and `DEPLOY_WEBHOOK_URL` secrets and `HEALTHCHECK_URL` variables.
Both must use HTTPS, an independent PostgreSQL database, private S3-compatible
storage, and `AUTH_DEV_MODE=false`. Configure the frontend's public API URL at
the hosting platform; never put backend secrets in `VITE_*` variables.

## CI

Pull requests and pushes to `main` run `.github/workflows/ci.yml`. Frontend
CI runs `npm ci`, type checking, and the production build. Backend CI runs
against an ephemeral PostgreSQL 16 service, generates and validates Prisma,
deploys the committed migrations, then runs type checking, lint, formatting,
tests, build, and `npm audit --audit-level=high`.

Successful CI runs for `main` then run `build-package.yml`, which produces
frontend and backend artifacts retained for 14 days. Deployment consumes that
run's artifacts so staging and production promote the same commit/package.

## Deployment and migrations

Staging deploys automatically after a successful main build. Production is a
manual `workflow_dispatch` deployment and must be protected with required
reviewers in the `production` GitHub Environment. The deployment webhook must
deploy the named artifacts for the supplied `artifacts_run_id`; its platform
configuration owns runtime secrets and HTTPS. The workflow runs
`prisma migrate deploy` against the selected environment before requesting the
application rollout, then checks `/health/ready`. It never uses `migrate dev`.

If a deployment fails, stop promotion and restore the last known-good
application artifact through the hosting provider, then verify readiness.
Database migrations are not automatically rolled back: use additive
expand/contract migrations, repair forward, or restore from a provider backup
only under the database recovery procedure.

## Required GitHub configuration

Create `staging` and `production` environments. Each requires the secret names
`DATABASE_URL` and `DEPLOY_WEBHOOK_URL`; each requires the variable
`HEALTHCHECK_URL`. Production should additionally require reviewers and restrict
deployment branches to `main`. The webhook/deployment platform must be
configured to fetch the GitHub artifacts using its own least-privilege GitHub
integration. Do not place credentials in workflow files or commit `.env` files.
