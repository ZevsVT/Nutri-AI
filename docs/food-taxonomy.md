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
`NutritionVersion`; provider/source ID, version, and optional confidence can
be attached without coupling taxonomy identity to one provider. AI predictions
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
