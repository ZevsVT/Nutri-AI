# Food data reviews (issue #18)

The staff workspace stages food-data changes in PostgreSQL and publishes the exact
submitted revision after independent approval. Open **Staff sign in** from the
application, then use **Food data reviews** with a provisioned staff account.
The consumer prototype still uses its existing local data; the administrative
workspace uses real session-authenticated backend endpoints.

## Checkout findings and scope

The flow before this change was React services → Fastify controllers → business
service → Prisma catalog/meal tables. Sessions resolve an active user on every
request. Public food search filters `isActive`; manual meal creation and analysis
confirmation copy the selected nutrition into `MealItemNutrition`. Barcode lookup
previously used only an optional provider. Session serialization supplied no
permissions.

This checkout does **not** contain the issue #17 packaged-food models,
`packaged-food-import.ts`, or `docs/packaged-foods.md` mentioned in the issue.
This change adds one packaged-product table and one barcode table alongside the
existing food/nutrition models. It does not add a CLI importer or claim compatibility
with an implementation absent from this branch. See [packaged foods](packaged-foods.md).

The change reaches the review controller/service/repository, additive migration,
session permission serialization, public catalog/nutrition/barcode readers, React
workspace, tests, CI, and documentation. Canonical IDs, existing API paths, seed
values and historical meal snapshots are preserved. Migration defaults make all
existing aliases and nutrition records available as before.

## Access and provisioning

| Role | Browse catalog/reviews | Create/edit own drafts | Submit/withdraw own | Approve/reject |
| --- | --- | --- | --- | --- |
| ADMIN | Yes | Yes | Yes | Yes; no self-approval |
| NUTRITION_EDITOR | Yes | Yes | Yes | No |
| MODERATOR | Yes | No | No | No |
| USER, SUPPORT | No | No | No | No |

`common/types/permissions.ts` owns this policy. Login and `/auth/me` return those
permissions; review services enforce the role policy again. Even an administrator
cannot edit another author's draft or approve their own submission. Administrators
may reject their own submission with a reason.

All administrative endpoints require a real cookie session, including when
`AUTH_DEV_MODE=true`. Development identity/permission headers cannot grant review
access. Suspended/deleted users and expired/revoked sessions fail authentication.
Registration is strict and always creates a USER; actor IDs and roles are never
accepted in review bodies.

A database operator provisions staff after the two people register normally.
Verify both account identities and use their actual distinct UUIDs. On an approved
maintenance connection, run the following transaction, replacing the example IDs:

```sql
BEGIN;
-- Confirm exactly two distinct ACTIVE accounts before changing roles.
SELECT id, email, status, role FROM "User"
WHERE id IN ('11111111-1111-4111-8111-111111111111',
             '22222222-2222-4222-8222-222222222222') FOR UPDATE;
UPDATE "User" SET role = 'NUTRITION_EDITOR', "updatedAt" = NOW()
WHERE id = '11111111-1111-4111-8111-111111111111' AND status = 'ACTIVE';
UPDATE "User" SET role = 'ADMIN', "updatedAt" = NOW()
WHERE id = '22222222-2222-4222-8222-222222222222' AND status = 'ACTIVE';
COMMIT;
```

Require one updated row for each statement; roll back if identity verification or
row counts fail. Record this provisioning in the operator's maintenance log. No
default privileged account or password is shipped. Sign in again to refresh the
displayed permissions; the server resolves current roles on every request.

Mutations require `X-Food-Review-Request: 1` and JSON. Together with the configured
CORS allowlist and HttpOnly SameSite cookies, the non-simple custom header prevents
cross-origin form submissions. Configure `CORS_ORIGINS` to trusted application
origins only; never grant an untrusted origin credentialed access.

## Supported operations

| Operation | Payload beyond `type` | Protected identity |
| --- | --- | --- |
| CREATE_FOOD | `canonicalName`, `fields` (required `nameVi`), optional `product` | Reserves canonical name, generated slug and normalized display name; no Food row until approval |
| UPDATE_FOOD | `fields` | Display names, description, taxonomy, serving metadata only; no canonical name, slug or ID edits |
| ADD_ALIAS | `alias`, `language` (default vi) | Normalized alias/language ownership is unique and retained |
| REMOVE_ALIAS | `aliasId` | Deactivates the alias; keeps its ownership row |
| PUBLISH_NUTRITION | `sourceId`, new `sourceVersion`, `referenceQuantity`, `referenceUnit`, `preparationState`, `values` | Creates a new version and record; preserves all previous records |
| WITHDRAW_NUTRITION | none | Deactivates every nutrition record for this food; no fallback to an older withdrawn record |
| UPDATE_PRODUCT | `fields`: productName, packageQuantity, packageUnit | Cannot edit brand, formulation, source or food ownership |
| ADD_BARCODE | `barcode` | Requires a packaged product; global GTIN ownership |
| SET_BARCODE_STATUS | `barcode`, `status` | ACTIVE, INACTIVE or DEPRECATED; no transfer |
| SET_FOOD_STATUS | `status` | ACTIVE, INACTIVE or DEPRECATED; never deletes historical data |

`fields` accept existing taxonomy values. Optional nullable metadata fields can
be explicitly cleared with null. Empty edits and unknown keys are rejected.
New packaged foods require `foodType=PACKAGED_FOOD` and a product with brand,
formulation, productName, positive packageQuantity, packageUnit (g/ml/piece), and
an existing trusted sourceId. Metadata edits cannot convert a canonical food into
or out of a packaged product. Distinct brands/formulations require distinct foods;
brand/formulation pairs are unique.

GTIN-8, UPC-A, EAN-13 and GTIN-14 must have valid check digits. Review storage and
lookup use a 14-digit zero-padded GTIN so equivalent representations collide.
The existing external-provider scan contract remains available for unknown codes;
an inactive catalog mapping blocks provider fallback for that mapping.

## State and revision rules

```text
DRAFT -> SUBMITTED -> APPROVED
  |          |    -> REJECTED
  v          v
WITHDRAWN  WITHDRAWN
```

Draft edits append immutable `FoodReviewRevision` rows and increment the integer
revision. Submission and decisions retain the content revision number; the state
is checked independently. Every mutation after creation requires the expected
revision. Only the author can edit/submit/withdraw, and only submitted proposals
can be decided. Rejection requires a nonblank reason. Terminal proposals cannot
be reopened. Decision bodies contain the revision and optional rejection reason,
never replacement proposed values.

Withdraw a submitted proposal before correcting it. Create a successor with
`predecessorId` referencing your terminal proposal for the same target. A proposal
has at most one direct successor; history can form a chain. A new-food proposal
may have a successor after rejection/withdrawal. After new-food approval, a linked
successor targets the published food ID from the publication event; the workspace
starts a metadata correction for that food.

Draft edits retain the original food baseline. Changing the proposed source
captures the newly selected source without silently rebasing the target food.
If published data changed, withdraw and create a successor to capture a fresh
baseline. The frontend retains editor values on a 409 and offers review-state
reload; it never silently resubmits an approval.

## Evidence and comparison

Every proposal requires an explanation (1–4000 characters) and 1–20 evidence
references. Evidence is retained as text and optional HTTP(S) URLs. The server
does not fetch arbitrary URLs, run OCR, or attach private meal images.

Evidence kinds are CATALOG, PRODUCT and NUTRITION. Nutrition publication requires
NUTRITION evidence matching the target foodId, sourceId and sourceVersion.
Withdrawal requires evidence for a currently available source version. Product
creation/correction, packaged nutrition, and barcode operations require separate
PRODUCT evidence matching brand, formulation and source; existing targets require
foodId and barcode operations also require the exact barcode. An AI prediction
or product-identity reference alone does not qualify as nutrition evidence.
Reviewers must inspect source references manually; matching IDs do not establish
that the cited facts are accurate.

Queue/detail APIs retain author IDs, submission time, baseline snapshot, proposed
payload, warnings, reviewer IDs/reasons, and publication references. Detail includes
current/baseline/proposed comparisons, added/changed/removed fields and a stale
flag. History is paginated and includes the exact immutable revision for each
event. No account emails, password hashes or session secrets are returned.

## Publication, conflicts and retention

Each review mutation uses one database transaction. Before catalog reads, it
acquires PostgreSQL SHARE ROW EXCLUSIVE locks on the seven affected catalog
tables. Normal reads continue; direct catalog writes and other review mutations
wait. This deliberately coarse strategy is appropriate to a low-volume staff
queue and also coordinates with direct SQL/maintenance writes using ordinary
PostgreSQL locks. For higher write volumes, replace it with per-entity revision
triggers and ordered row locks, preserving the same tests and conflict contract.

Approval verifies role, submitted state, independent reviewer, expected revision,
and a SHA-256 fingerprint of the full food graph: metadata, active/inactive aliases,
all nutrition records, their versions/sources, product fields/current pointer, and
barcode mappings. Relevant proposed source metadata is also captured. It then
revalidates evidence/domain rules, publishes the saved payload, updates applicable
current pointers, appends an approval event with publication IDs, and changes state
in the same transaction. Unique constraints, retained ownership rows and state
checks prevent duplicate or conflicting publication. Conflicting identity/state/
revision changes return 409; failure rolls back publication, versions and audit.

Fingerprints are intentionally conservative: even an unrelated change in the
target food graph can require a successor. A successful approval is not replayed
on retry; repeat requests return 409 and the client should GET the review.

`normalizeNutrition()` preserves unknown nutrients as null and reference quantity,
unit and preparation state. Each publication requires a new source version string,
unique for that source (use a food-specific suffix when needed). Previous facts
are retained, with availability flags deactivated. Packaged nutrition must use
the product's fixed source; its currentNutritionVersionId is updated atomically.
Withdrawal clears that pointer and all current availability.

Public food responses preserve nulls. Existing numeric meal snapshots cannot
represent unknown nutrients, so confirming incomplete nutrition returns
NUTRITION_DATA_UNAVAILABLE instead of storing false zeros. New requests cannot
use deactivated foods; old meals continue reading their existing display names
and snapshots. No review operation updates `MealItemNutrition`.

Audit and revision tables are append-only, enforced by database triggers. Ordinary
account deactivation retains decisions. Foreign keys prevent deleting referenced
authors/catalog history. There is no automatic purge or undo-by-deletion; correct
published data with another reviewed proposal. Database operators remain a trusted
maintenance boundary. Not all catalog writes require human review: existing seeds
and direct maintenance writes are still possible and invalidate captured baselines.

## API usage

All paths below are under `/api/v1`. Lists use standard success envelopes and
`meta: {page,pageSize,total,totalPages}`. Page defaults to 1 (max 100000), pageSize
to 20 (max 100). Evidence/source lists are bounded; identifiers must be UUIDs.

| Method | Path | Input / purpose |
| --- | --- | --- |
| GET | /admin/foods | q, status, foodType, category, region, page, pageSize |
| GET | /admin/foods/:id | Inspect active, inactive or deprecated data |
| GET | /admin/nutrition-sources | page/pageSize; existing trusted-source selection |
| GET | /admin/food-reviews | state, operation, authorId, targetFoodId, page, pageSize |
| POST | /admin/food-reviews | operation, optional targetFoodId/predecessorId, explanation, evidence |
| GET | /admin/food-reviews/:id | Detail and comparison |
| PATCH | /admin/food-reviews/:id | revision, operation, explanation, evidence |
| POST | /admin/food-reviews/:id/submit | revision |
| POST | /admin/food-reviews/:id/withdraw | revision |
| POST | /admin/food-reviews/:id/approve | revision |
| POST | /admin/food-reviews/:id/reject | revision, reason |
| GET | /admin/food-reviews/:id/history | page/pageSize; events and saved revisions |

Example draft body:

```json
{
  "targetFoodId": "33333333-3333-4333-8333-333333333333",
  "operation": {"type":"UPDATE_FOOD","fields":{"description":"Corrected food description"}},
  "explanation": "Corrected from the verified food table.",
  "evidence": [{"kind":"CATALOG","reference":"Food composition table, page 18"}]
}
```

Authenticate with `/auth/login` and retain its cookie. Send it with the mutation
header and this JSON to POST `/admin/food-reviews` (201). Submit with
`{"revision":1}`. An independent administrator approves with `{"revision":1}`
or rejects with `{"revision":1,"reason":"Source does not match the formulation"}`.
401 means missing/invalid session; 403 means denied access/ownership/self-approval
or missing mutation header; 400 means invalid input/evidence; 404 means missing
resource; 409 means stale data, state/revision conflict or catalog collision.
SQL/provider errors and stack traces are never included in error responses.

## Local migrations and verification

Use an isolated development/test database. Never reset an existing catalog.

```sh
cd backend
# Set DATABASE_URL to your isolated PostgreSQL database first.
npm run db:generate
npm run db:validate
npm run db:migrate
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
cd ..
npm test
npm run typecheck
npm run build
```

The additive `20261014090000_food_reviews` migration adds review/revision/audit/
reservation, product and barcode tables, availability/preparation columns, foreign
keys, indexes and protection triggers. It does not rewrite applied migrations,
change food IDs, seed data, nutrition facts or meal snapshots.

The PostgreSQL tests create randomly named isolated schemas, apply migrations,
exercise real cookie sessions and HTTP routes, and drop only their own schemas.
The populated migration test applies previous migrations, inserts food, aliases,
nullable nutrition and a confirmed meal snapshot, then verifies preservation after
the additive migration. DATABASE_URL must permit schema creation. An unreachable
configured database fails tests; CI cannot silently skip database coverage.

Frontend `npm test` renders every operation form and verifies disabled editing,
session/header/revision requests, validation/permission/conflict errors and draft
preservation. This is component/API-client verification, not a browser interaction
test. Manually verify desktop/mobile navigation, keyboard use and a two-account
save → submit → compare → approve/reject flow before deployment.

## Acceptance checklist and verification record

- [x] Authorized catalog browsing, including inactive/deprecated records.
- [x] Own staged drafts, immutable submitted content, linked successors.
- [x] Current/baseline/proposed comparison, evidence, warnings and decision history.
- [x] Role/session authorization and independent review, enforced on the backend.
- [x] Valid submission, withdrawal, rejection and approval transitions.
- [x] Stale-data detection across metadata, aliases, nutrition, product and barcodes.
- [x] Atomic publication/audit and concurrent/retried approval protection.
- [x] Canonical identity and alias/barcode ownership retained.
- [x] Source/version lineage, nutrition withdrawal and historical meal preservation.
- [x] Real administrative frontend and API calls; bounded and validated inputs.
- [x] Additive migrations tested on clean and representative populated PostgreSQL.
- [x] Focused automated backend and frontend component/API-client coverage.
- [x] Importer absence and trusted direct-write boundary documented.
- [ ] Manual browser interaction and visual checks (no connected browser available).
- [ ] Repository-wide formatting check is fully clean (pre-existing formatting in
  untouched backend files remains; see the final task report for actual results).

No push, deployment or GitHub issue closure is part of this implementation.
