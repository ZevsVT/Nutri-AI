# Issue #18 change record

Before: cookie sessions resolved users with empty permissions; food search and
nutrition read directly from published Prisma tables; barcode lookup had only a
provider boundary. No review or packaged-product persistence existed in this checkout.

After: real staff sessions prepare separately persisted proposals; an independent
administrator publishes the exact submitted revision with audit in one transaction.
The React staff workspace consumes those APIs. Existing public readers honor alias,
nutrition, food and barcode lifecycle without changing historical meal snapshots.

Required files: review schema/migration and backend module; permission policy and
session serialization; application composition; affected public readers; React
workspace and API client; backend/frontend tests and CI scripts; API/database/setup
documentation. The validation helper's type signature now infers parsed defaults
correctly; runtime behavior is unchanged. No dependencies were added or upgraded.

Data impact: additive tables and availability/preparation columns. Existing IDs,
facts and historical snapshots remain unchanged by migration. Publication alone
changes selected catalog data. Database triggers preserve identity and append-only
review history. The absent issue #17 importer was not invented or rewritten.

See the [acceptance checklist](../food-reviews.md#acceptance-checklist-and-verification-record)
and the task completion report for checks actually run and remaining limitations.

## Files

| Area | Paths |
| --- | --- |
| Database | `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261014090000_food_reviews/migration.sql` |
| Review module | `backend/src/modules/food-reviews/review.schemas.ts`, `review.repository.ts`, `review.service.ts`, `review.controller.ts` |
| Authorization/composition | `backend/src/common/types/permissions.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/common/middleware/request-validation.ts`, `backend/src/app/app.ts`, `backend/src/main.ts` |
| Published readers | `backend/src/modules/foods/barcode.ts`, `backend/src/modules/foods/food.repository.ts`, `backend/src/modules/api/api.service.ts` |
| Frontend | `src/components/admin/ReviewWorkspace.tsx`, `DraftEditor.tsx`, `review.css`, `src/services/reviewService.ts`, `src/services/authService.ts`, `src/components/layout/AppShell.tsx`, `src/types.ts` |
| Verification | `backend/tests/food-reviews.test.ts`, `backend/tests/database.test.ts`, `scripts/review-ui.test.mjs`, both `package.json` files, `.github/workflows/ci.yml` |
| Documentation | `README.md`, `docs/api.md`, `docs/database.md`, `docs/food-reviews.md`, `docs/packaged-foods.md`, this change record |

## Checks run on 2026-10-15

- Backend Prisma generation and schema validation passed.
- Backend typecheck, lint and production build passed.
- All 66 backend tests passed against isolated PostgreSQL; none skipped.
- Clean migration deploy and representative populated migration preservation passed.
- Schema-to-database comparison reported no differences. Two indexes already
  present in older migrations are now declared in Prisma so future schema changes
  preserve them; this adds no new migration work or data changes.
- All 5 frontend component/API-client tests, frontend typecheck and build passed.
- Repository-wide backend formatting reported existing issues in untouched
  `backend/README.md`, `src/integrations/barcode/barcode-provider.ts`,
  `src/modules/api/api.schemas.ts`, `src/modules/nutrition/nutrition.repository.ts`,
  and `tests/api.test.ts`. Unrelated reformatting was excluded.
- No browser was connected to the UI tool, so visual and browser interaction
  verification remains outstanding. No production/shared database was migrated.
