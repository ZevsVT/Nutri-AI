# NutriAI

NutriAI is a responsive AI nutrition assistant prototype focused on one trustworthy loop: capture food, confirm recognition, see sourced estimates, and understand what to do next.

## Run locally

```bash
npm install
npm run dev
```

The first version uses local demo data and a simulated AI recognition flow. No API keys are needed. See [`docs/architecture.md`](docs/architecture.md) for the information architecture, schema, API contracts, and production integration boundary.

The production backend foundation lives in [`backend/`](backend/README.md). Run it independently with `cd backend && npm install && npm run dev`.

CI/CD, environment separation, deployment prerequisites, migrations, health
checks, and rollback guidance are documented in [`docs/ci-cd.md`](docs/ci-cd.md).

## Production integration notes

Issue #7 now provides the PostgreSQL/Prisma schema, migrations, seed workflow,
and persistence repositories under `backend/`. Authentication, server-side
meal-analysis routes, storage, and USDA FoodData Central integration still need
to be added behind the API boundary before using real user data. Keep AI and
nutrition-provider keys on the server and retain source/version/confidence
metadata with every result.
