# Nutri-AI database

Issue #7 adds a PostgreSQL + Prisma persistence foundation to the modular
Fastify backend. The frontend prototype remains mock-data driven until the API
integration issues replace it; the database is designed to match the existing
capture → confirm → understand flow.

## Domain mapping

| Prototype concept | Database entity | Future API usage |
| --- | --- | --- |
| Account and profile | `User`, `UserPreference`, `UserConsent` | Issue #8 authentication and profile/privacy endpoints |
| Searchable Vietnamese food | `Food`, `FoodAlias` | `GET /api/foods/search` |
| Nutrition provenance | `FoodSource`, `NutritionVersion`, `FoodNutrition` | Food lookup and calculation services |
| Captured diary event | `Meal`, `MealItem` | Meal CRUD and diary endpoints |
| Confirmed nutrition | `MealItemNutrition`, `NutritionAnalysis` | Analysis confirmation and daily totals |
| Model recognition | `AIAnalysis`, `AIFoodPrediction` | Meal-analysis polling/retry flow |
| Human feedback | `AICorrection` | Evaluation and future personalization |
| Recipes, habits, insights | `Recipe*`, `WaterLog`, `NutritionInsight` | Recipe, habit, and insight endpoints |

AI recognition is intentionally separate from nutrition provenance. A model can
predict a label and portion, but the confirmed nutrition comes from a
versioned food source and is copied into `MealItemNutrition`.

## Relationships and historical behavior

```text
Food ──< FoodNutrition >── NutritionVersion ──> FoodSource
  │
  └──< MealItem ──> Meal ──> User
              │
              └── MealItemNutrition (write-once confirmation snapshot)

AIAnalysis ──< AIFoodPrediction
     │
     └──< AICorrection ──> User
```

`FoodNutrition` is versioned rather than overwritten. A confirmed meal stores
the numeric values, serving amount, source, and nutrition version used at that
time. Updating or adding a later `FoodNutrition` row therefore cannot change a
past diary result. The application/repository layer treats snapshots as
write-once; retries return the existing snapshot.

`NutritionAnalysis` totals are cached analysis output. The authoritative
historical values for a confirmed meal are the item snapshots, not a later
recalculation from the current food table.

Nutrition columns use fixed conventions: `calories` is kcal, protein/
carbohydrates/fat/fiber/sugar are grams, and `sodium` is milligrams. Decimal
columns are used for portions and nutrition values so calculations do not rely
on binary floating point.

## Local setup

From the repository root:

```powershell
cd backend
Copy-Item .env.example .env
# Set DATABASE_URL and matching POSTGRES_* values in .env
docker compose --env-file .env -f docker-compose.yml up -d postgres
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

Use `npm run db:migrate:dev -- --name <change-name>` only for a local schema
change. Deploy an already-reviewed migration with `npm run db:migrate` (which
runs `prisma migrate deploy`). Never point `migrate dev` at production.

The committed migration is
`20260825200000_init_nutrition_schema`.

## Seed data

`prisma/seed.ts` is deterministic and safe to run repeatedly. It includes a
clearly local-only `demo@nutri-ai.local` account, Vietnamese food aliases,
curated and USDA source records, nutrition version `2026.01`, nutrition rows,
one confirmed phở bò meal with an immutable snapshot, a demo AI prediction, an
insight, and a minimal published recipe. It does not create real production
accounts.

Aliases store both display text and a normalized form. The seed normalizer
lowercases, trims, collapses whitespace, and removes Vietnamese diacritics so
accent-insensitive lookup can be implemented by the future search service.

## Connection management and repositories

`src/integrations/database/prisma-database.ts` owns one shared `PrismaClient`,
supports development reload reuse, exposes the existing readiness `ping`, and
disconnects during graceful shutdown. Tests can opt out of the global client
for isolation.

Persistence access is separated into focused repositories:

- `PrismaUserRepository`
- `FoodRepository`
- `MealRepository`
- `NutritionRepository`
- `AIAnalysisRepository`

User-owned reads and writes use `findByIdForUser`, `listForUser`, or an
equivalent `(entityId, userId)` filter. Repositories do not implement
authorization or nutrition business rules.

## Delete strategy

- User-owned private data (`Meal`, `WaterLog`, `NutritionInsight`, AI records,
  and preferences) cascades when a user is removed.
- `UserConsent` uses `RESTRICT` so a deletion workflow must explicitly satisfy
  consent-retention policy instead of silently erasing the audit trail.
- Meals are soft-deleted by `MealRepository.softDeleteForUser`.
- Foods, food sources, nutrition versions, and nutrition references use
  `RESTRICT`; foods should be deactivated with `isActive = false`.
- Meal items and their snapshots cascade with the private meal. A food update
  cannot remove a snapshot independently.
- Recipe ingredients and recipe nutrition cascade with the recipe, while food
  references remain restricted.

## Constraints and indexes

The migration adds PostgreSQL `CHECK` constraints for positive amounts,
non-negative nutrition values, confidence in `[0, 1]`, valid periods, and
consent timestamps. Prisma supplies enum, unique, and foreign-key constraints.

Indexes reflect the current access paths: user/date and user/status meal
queries, food names and active state, normalized alias plus food, food/version
nutrition lookup, AI user/meal/status/time queries, water by user/time, and
insights by user and period. Unique indexes also cover normalized aliases,
food/version pairs, source/version pairs, and one snapshot per meal item.

All database timestamps use UTC `TIMESTAMPTZ`. Daily boundaries must be formed
using the user's `UserPreference.timezone`, which defaults to
`Asia/Ho_Chi_Minh`; the database must not infer a user's local day from UTC.

## Tests

```powershell
npm run db:validate
npm run db:generate
npm test
npm run lint
npm run typecheck
npm run build
```

`tests/database.test.ts` always verifies client construction and runs the
PostgreSQL integration checks when `DATABASE_URL` is reachable. Without a
running database, the integration checks are skipped with an explicit reason;
they do not pretend to validate migrations or historical behavior.
