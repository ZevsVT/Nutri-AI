# Packaged foods and barcodes

Issue #17 adds a local, reviewed packaged-food catalog to the authenticated
`POST /api/v1/barcode/scan` endpoint. No external credentials are required.
The frontend `BarcodeScannerModal` still simulates scanning with a hardcoded
product; camera decoding and frontend API integration remain separate work.

## Runtime and identity

The route authenticates and validates input, the business API delegates to
`BarcodeService`, and `PrismaBarcodeProvider` performs a unique local lookup.
Controllers contain no SQL or provider parsing. The no-database development
service uses the same reviewed catalog and normalization through
`InMemoryBarcodeProvider`; it is not a substitute for PostgreSQL tests.

`Food.id` remains the canonical UUID for search, meals, and nutrition.
`PackagedProduct` has one record per food, with a unique, immutable `importKey`,
brand, meaningful formulation/variant, lifecycle state, and source reference.
Allocate a UUID once when reviewing a new identity and commit it with its import
key; neither identity is recomputed from a mutable display name or barcode.
Different brands or formulations require different food IDs. The importer
rejects attempts to change the brand, variant, food ID, or canonical name under
an existing identity. Names may be corrected; existing slugs, normalized names,
aliases and historical references are preserved. Newly reviewed aliases are
added without transferring aliases owned by another food.

Equivalent formulations can share a food ID across package sizes. Each
`FoodBarcode` carries its own total package quantity/unit, `unitsPerPack`, labeled
serving, evidence URL and lifecycle state. For example, six 500 ml units have a
3000 ml total package quantity and `unitsPerPack: 6`; they are not a single
500 ml item. A different GTIN-14 packaging indicator is a separate identifier.
Changing a package's formulation requires a new reviewed product identity,
not silent barcode reassignment.

Only mappings, products and foods with `status: ACTIVE` and foods with
`isActive: true` resolve. Inactive/deprecated records return `UNRESOLVED` without
product or source data. They remain stored, and their keys cannot be reassigned.
Inactive/deprecated foods and products are excluded from new search and meal
resolution; existing diary snapshots remain readable. Omitted mappings and
aliases are retained by imports. Deactivate a mapping explicitly in the manifest.
Imports preserve independent food deactivation; reactivation of a canonical
food requires a separate reviewed edit.

## Identifiers

Supported strings are EAN-8, UPC-A/GTIN-12, EAN-13, and GTIN-14. Input must contain
ASCII decimal digits and the valid GS1 modulo-10 check digit. Surrounding
whitespace is trimmed. The untrimmed input limit is 64 characters. Empty values,
numbers, punctuation, QR data, and scanner symbology prefixes such as `]E0` are
rejected; scanner clients must remove a known prefix before submission.

The lookup key is the validated string left-padded to exactly 14 digits. Thus
`036000291452`, `0036000291452`, and `00036000291452` share one key; leading zeros
are retained in the submitted `barcode` response and in the mapping's stored
representation. No numeric conversion or arbitrary zero removal is used.
The normalized key is a PostgreSQL primary key; database checks also enforce
the digits, check digit and normalization relationship. Matching is exact;
unknown identifiers never fall back to fuzzy food-name search.

## Reviewed starter coverage

The manifest is
[`backend/src/modules/foods/data/packaged-foods.json`](../backend/src/modules/foods/data/packaged-foods.json).
Version `2026.10.14` was reviewed on 14 October 2026. It includes three real
Vietnam-market identities across beverages, snacks and condiments:

| Product | Barcode | Package | Evidence |
| --- | --- | --- | --- |
| Vinamilk sweetened UHT milk | `8934673573399` | 1000 ml, one carton | [7-Eleven Vietnam listing](https://7-eleven.vn/san-pham/sttt-vinamilk-co-duong-hop-1-l) |
| Oishi spicy prawn snack | `8934803042276` | Unknown, one packet | [7-Eleven Vietnam listing](https://7-eleven.vn/san-pham/snack-oishi-tom-cay-dac-biet-68g) |
| Chin-su garlic/chilli soy sauce | `8936136163734` | 330 ml, one bottle | [7-Eleven Vietnam listing](https://7-eleven.vn/san-pham/nuoc-tuong-chinsu-toi-ot-330ml) |

The retailer's Oishi heading says 68 g while its responsibility text says 75 g;
the manifest records the discrepancy and leaves quantity/unit null. No weight
was chosen by inference. Source-backed English names are not available and
remain null. Aliases are reviewed brand-inclusive shortened names.

These are retailer-reviewed identity records, not manufacturer-verified
nutrition. All three explicitly have `nutrition: null` because a readable
nutrition label matching the barcode and formulation was not available from
the reviewed listings. To add nutrition, supply a matching label or licensed
source with reference basis, preparation state, values, and evidence URL.
Do not borrow facts from another flavor, package formulation, or generic food.
The synthetic numeric products in `backend/tests/fixtures` are test-only.

Only factual identity metadata is bundled. Retailer images, prices and
descriptions are not reproduced, and no dataset redistribution license is
asserted. Each source retains its usage conditions, URL, review date, version,
and reference; confirm applicable source terms before broader redistribution.

## Import and update commands

From `backend`, point `DATABASE_URL` at the intended isolated development/test
database, then:

```bash
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:import:packaged
# Or import another source-reviewed manifest with the same schema:
npm run db:import:packaged -- path/to/reviewed-products.json
```

Production refreshes use the focused importer after normal database review;
do not use `db:seed` for catalog refresh. The existing general seed deletes
legacy curated nutrition and snapshots and changes demo data.

The importer validates all entries before writing. Ambiguous batch identities
reject both affected entries. Valid entries run in individual transactions,
serialized across importer processes by a PostgreSQL advisory lock. Uniqueness
and foreign keys protect other writers. Invalid entries and conflicts are
reported without partial product writes; independent valid entries may succeed.
CLI input is capped at 2000 products. Reports contain `inserted`, `updated`,
`skipped`, `rejected`, and indexed reasons. Any rejection produces a nonzero CLI
exit status. Unchanged manifests skip writes, including timestamps and lineage.
No user data or unrelated food is changed.

Fix a conflict by reviewing the manifest and existing assignment. The importer
never transfers a barcode, food identity, or alias to another owner, even when
inactive. Brand/formulation or provider changes require explicit data review.
A review older than the current catalog revision is rejected.

Nutrition facts are immutable within one source version: a changed nutrition
payload, preparation state, or evidence URL requires a new `source.version`.
The importer creates new `NutritionVersion`/`FoodNutrition` records and retains
old ones. Version metadata retains review information, evidence URL and a
nutrition fingerprint. The product points to the reviewed current version;
withdrawing nutrition sets that pointer to null, without exposing older facts
as current or deleting them. Future/expired versions are unavailable until
their effective window is applicable.

## Nutrition and consumption

Nutrition stays in `FoodNutrition`, with `FoodSource` and `NutritionVersion`.
Imports call `normalizeNutrition()` and reject negative/non-finite or
incompatible values. kcal is the energy unit; protein/carbohydrates/fat/fiber/
sugar are g, sodium is mg. kJ and mass units use the existing conversions.
`salt` is not accepted as a sodium field.

Nutrition reference quantity/unit (`servingAmount`, `servingUnit`) and
`PER_100_G`, `PER_100_ML`, or `PER_SERVING` describe the source basis. They are
independent of the package total, labeled serving, and amount consumed.
`preparation` explicitly distinguishes `AS_SOLD` from `AS_PREPARED`.
Prepared facts may be returned with their label, but the current meal path
rejects them rather than applying them to an as-sold quantity.

`AVAILABLE` means all seven modeled nutrients are present, `PARTIAL` means at
least one is present, and `UNAVAILABLE` means no applicable current record or no
known values. These states measure availability, not correctness or confidence.
Missing nutrients remain null in food responses, confirmed snapshots and totals;
a total is null when any included item has unknown data for that nutrient.
A confirmed item without a snapshot also produces unknown totals.

Meals must supply a compatible consumed unit. g/gram/grams/GRAM and
ml/milliliter/milliliters/MILLILITER are equivalent; kg and l convert within the
same dimension. Existing equal-unit dish references (for example bowl) still
work. A serving-based reference requires `serving`. No density, bottle-to-volume,
labeled-serving-to-mass, or gram-to-milliliter conversion is assumed.
Incompatible units produce HTTP 400 `VALIDATION_ERROR`. Entirely unavailable
or prepared-only nutrition produces `NUTRITION_DATA_UNAVAILABLE` on confirmation.
Scanning itself never saves a meal, invents a confidence score, or verifies
nutrition. Confirmed snapshots retain their source/version and values after
all subsequent catalog updates.

## API example and errors

```http
POST /api/v1/barcode/scan
Content-Type: application/json
Cookie: nutri_ai_session=<session>

{"barcode":"8934673573399"}
```

```json
{
  "success": true,
  "data": {
    "barcode": "8934673573399",
    "normalizedBarcode": "08934673573399",
    "status": "RESOLVED",
    "foodId": "ec8bd36c-cb32-4a95-8d71-923750017001",
    "product": {
      "barcode": "8934673573399",
      "foodId": "ec8bd36c-cb32-4a95-8d71-923750017001",
      "productName": "Sữa tươi tiệt trùng Vinamilk có đường",
      "brand": "Vinamilk",
      "variant": "Có đường",
      "package": {"quantity": 1000, "unit": "ml", "unitsPerPack": 1},
      "labeledServing": null,
      "nutritionAvailability": "UNAVAILABLE",
      "nutrition": null,
      "source": {
        "provider": "7-Eleven Vietnam",
        "name": "vn:vinamilk:uht-sweetened-milk",
        "version": "2026.10.14",
        "reference": "sttt-vinamilk-co-duong-hop-1-l",
        "url": "https://7-eleven.vn/san-pham/sttt-vinamilk-co-duong-hop-1-l",
        "reviewedAt": "2026-10-14T00:00:00.000Z",
        "usageConditions": "Factual identity metadata only; no images or descriptions reproduced; no dataset redistribution license asserted."
      }
    },
    "source": {
      "provider": "7-Eleven Vietnam",
      "name": "vn:vinamilk:uht-sweetened-milk",
      "version": "2026.10.14",
      "reference": "sttt-vinamilk-co-duong-hop-1-l",
      "url": "https://7-eleven.vn/san-pham/sttt-vinamilk-co-duong-hop-1-l",
      "reviewedAt": "2026-10-14T00:00:00.000Z",
      "usageConditions": "Factual identity metadata only; no images or descriptions reproduced; no dataset redistribution license asserted."
    }
  }
}
```

The existing `barcode`, `status`, `product`, `source` and `{success,data}` envelope
are retained. Known products with missing nutrition still resolve. Unknown or
inactive identifiers return HTTP 200 with `UNRESOLVED`, `foodId: null`,
`product: null`, and `source: null`. Malformed input gives 400 `VALIDATION_ERROR`,
missing authentication gives 401, and database failures give 503
`DATABASE_ERROR` with no connection or Prisma details. An injected provider
failure gives 503 `EXTERNAL_SERVICE_ERROR`. No live provider or new provider
configuration is installed by this issue.

## Migration and tests

`20261014090000_add_packaged_food_barcodes` creates the product and mapping
tables, constraints and indexes; adds preparation/version metadata; and allows
unknown nutrients in `MealItemNutrition`. It rewrites no existing rows and
requires no reset. Generate the updated Prisma client before running the backend.

`npm test` registers validation/API tests, Prisma endpoint/import tests, and a
migration test that creates unique PostgreSQL schemas for clean and populated
cases and drops only those schemas afterward. The populated case preserves
food UUIDs, slugs, aliases, source/version nutrition and a confirmed snapshot.
Database tests skip only when `DATABASE_URL` is absent; configured connection or
migration failures fail the tests. The existing CI PostgreSQL service runs them
through the normal backend test command. All network provider behavior uses
controlled fixtures; source review is not repeated over the network in CI.

## Acceptance checklist

- [x] Packaged products reuse stable canonical `Food` IDs.
- [x] Product metadata and barcode mappings are persisted.
- [x] Leading zeros are preserved.
- [x] Supported formats and check digits are validated.
- [x] Barcode lookup keys are unique and indexed.
- [x] A reviewed three-product starter dataset is included.
- [x] Dataset sources and usage conditions are documented.
- [x] Known barcodes resolve to canonical IDs.
- [x] Unknown barcodes remain unresolved without fabricated data.
- [x] Nutrition imports reuse normalization and provenance models.
- [x] Missing nutrients remain unknown in responses, totals and snapshots.
- [x] Package, serving, mass, volume and preparation are explicit.
- [x] Existing barcode API fields, authentication and envelope are retained.
- [x] Lookup is reusable without HTTP.
- [x] Packaged products use existing food search and filters.
- [x] Imports are deterministic, repeatable, transactional and conflict-aware.
- [x] Nutrition updates preserve confirmed snapshots and source/version lineage.
- [x] Migrations work on clean and populated isolated PostgreSQL schemas.
- [x] Automated tests cover validation, lookup, imports, nutrition and API behavior.
- [x] Documentation describes the implemented behavior.
- [x] Frontend camera scanning remains explicitly simulated.
- [x] Hosted CI passed for implementation commit `76b7b5d`:
      [GitHub Actions run 38592959307](https://github.com/ZevsVT/Nutri-AI/actions/runs/38592959307).
      Frontend and backend validation passed, including 64 tests with zero
      failures and zero skips, PostgreSQL migrations, and dependency audit.

## Local verification on 14 October 2026

All required backend commands ran successfully: `db:generate`, `db:validate`,
`typecheck`, `lint`, `format:check`, `test`, and `build`. The full suite passed
64 tests with zero failures and zero skips against PostgreSQL 16 in a disposable
container. The migration test verified both clean and populated isolated schemas.
The existing dependency audit found zero vulnerabilities. Frontend `typecheck`
and `build` also passed, and `git diff --check` reported no whitespace errors.

The bundled import command inserted three products with no rejections on its
first run and skipped all three on its second run, with no duplicates. No
production database, deployment, push, issue closure, or hosted CI run was used.
