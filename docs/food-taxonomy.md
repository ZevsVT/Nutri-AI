# Vietnamese food taxonomy

`Food.id` (UUID) is the permanent identity of a food. Names, translations,
slugs, and aliases are presentation/search data and may change without
changing that ID.

`Food` is the canonical entity. `FoodAlias` stores alternate spellings and
English names; normalized values use lowercase, whitespace collapse, and
Vietnamese diacritic removal while the original display values are retained.
`FoodComponent` is a small relation for a meal or prepared dish to reference
ingredient foods; it is not a recipe engine.

Food uses controlled values for `foodType` (`INGREDIENT`, `DISH`, `MEAL`,
`BEVERAGE`, `CONDIMENT`, `SNACK`, `DESSERT`, `PACKAGED_FOOD`), category,
region, cooking method, and serving unit. The vocabularies are defined in
`backend/src/modules/foods/food-taxonomy.ts` and database checks enforce them.
`subcategory` is descriptive metadata beneath a controlled category.

Nutrition remains separate in `FoodNutrition`, linked to `FoodSource` and
`NutritionVersion`; provider/source ID, version, optional confidence, and
`mappingType` (`EXACT_MATCH`, `CLOSE_MATCH`, `DERIVED_ESTIMATE`, or
`UNAVAILABLE`) can be attached without coupling taxonomy identity to one
provider. AI predictions
and diary items store canonical `Food.id`; their confidence belongs to the
prediction/item, not the food identity.

## Contribution rules

Choose an existing canonical food before adding one. A missing diacritic,
capitalization, translation, or common alias is not a new food. Preserve the
Vietnamese spelling in `nameVi`, add alternate forms as aliases, select one
controlled type/category, and use `region` for regional variation rather than
duplicating a food. Do not add nutrition numbers without a reviewed,
versioned source. Seed entries use deterministic UUIDs and upserts, so
`npm run db:seed` is repeatable.

`GET /api/v1/foods/search?q=` matches names and aliases case-insensitively and
also performs diacritic-insensitive normalized matching. Clients should store
the returned canonical ID rather than AI-generated text.

## Vietnamese catalog

The initial catalog is maintained in `backend/prisma/vietnamese-foods.ts`.
Each entry has a stable UUID derived from its ASCII canonical slug, a
diacritic-preserving Vietnamese name, English name, controlled taxonomy
values, serving basis, and reviewed aliases. The seed validates required
fields and alias collisions before opening its transaction, then upserts by
stable ID while also reconciling an existing canonical name or slug.

Nutrition mappings are intentionally separate from the catalog. The current
seed creates source/version records but does not insert numeric nutrition
values, because no source-reviewed Vietnamese mappings are bundled yet. Add a
`FoodNutrition` row only when the source, version, serving basis, and confidence
are known; use `FoodComponent` for a small set of ingredient links when a dish
needs decomposition. Do not use a dish estimate as an exact match.

To add a food, add one `food(...)` entry, choose an existing controlled value,
add only useful aliases, and run `npm test` plus `npm run db:seed`. The
validator rejects duplicate slugs, duplicate stable IDs, and ambiguous alias
normalizations. Regional specialties use `NORTH`, `CENTRAL`, or `SOUTH`;
shared foods use `NATIONWIDE` rather than duplicated records.
