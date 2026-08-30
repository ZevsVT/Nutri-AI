-- Additive taxonomy foundation. Existing Food rows remain valid and can be
-- enriched incrementally; nullable metadata preserves backward compatibility.
ALTER TABLE "Food"
  ADD COLUMN "slug" VARCHAR(160),
  ADD COLUMN "normalizedName" VARCHAR(160),
  ADD COLUMN "subcategory" VARCHAR(100),
  ADD COLUMN "region" VARCHAR(32),
  ADD COLUMN "cookingMethod" VARCHAR(32),
  ADD COLUMN "servingUnit" VARCHAR(32),
  ADD COLUMN "defaultServingSize" DECIMAL(12,3),
  ADD COLUMN "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE';

UPDATE "Food"
SET "slug" = "canonicalName",
    "normalizedName" = lower(regexp_replace(trim("canonicalName"), '\\s+', ' ', 'g'))
WHERE "slug" IS NULL;

CREATE UNIQUE INDEX "Food_slug_key" ON "Food"("slug");
CREATE UNIQUE INDEX "Food_normalizedName_key" ON "Food"("normalizedName");
CREATE INDEX "Food_foodType_idx" ON "Food"("foodType");
CREATE INDEX "Food_category_idx" ON "Food"("category");
CREATE INDEX "Food_region_idx" ON "Food"("region");
CREATE INDEX "Food_status_idx" ON "Food"("status");

-- Normalize the original MVP labels before adding controlled-vocabulary checks.
UPDATE "Food" SET "foodType" = CASE lower("foodType")
  WHEN 'main dish' THEN 'DISH' WHEN 'side dish' THEN 'DISH'
  WHEN 'breakfast' THEN 'MEAL' ELSE "foodType" END
WHERE "foodType" IS NOT NULL;
UPDATE "Food" SET "category" = CASE lower("category")
  WHEN 'noodle soup' THEN 'NOODLES' WHEN 'rice noodle' THEN 'NOODLES'
  WHEN 'rice plate' THEN 'RICE' WHEN 'rice dish' THEN 'RICE'
  WHEN 'rice porridge' THEN 'RICE' WHEN 'sandwich' THEN 'STAPLE'
  WHEN 'fresh roll' THEN 'SNACK' WHEN 'savory pancake' THEN 'SNACK'
  ELSE "category" END
WHERE "category" IS NOT NULL;

ALTER TABLE "Food"
  ADD CONSTRAINT "Food_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'DEPRECATED')),
  ADD CONSTRAINT "Food_foodType_check" CHECK ("foodType" IS NULL OR "foodType" IN ('INGREDIENT', 'DISH', 'MEAL', 'BEVERAGE', 'CONDIMENT', 'SNACK', 'DESSERT', 'PACKAGED_FOOD')),
  ADD CONSTRAINT "Food_category_check" CHECK ("category" IS NULL OR "category" IN ('STAPLE', 'RICE', 'NOODLES', 'MAIN_DISH', 'SOUP', 'MEAT', 'POULTRY', 'SEAFOOD', 'EGGS', 'VEGETABLES', 'FRUITS', 'PLANT_PROTEIN', 'SNACK', 'DESSERT', 'BEVERAGE', 'CONDIMENT', 'PACKAGED_FOOD')),
  ADD CONSTRAINT "Food_region_check" CHECK ("region" IS NULL OR "region" IN ('NORTH', 'CENTRAL', 'SOUTH', 'NATIONWIDE')),
  ADD CONSTRAINT "Food_cookingMethod_check" CHECK ("cookingMethod" IS NULL OR "cookingMethod" IN ('RAW', 'BOILED', 'STEAMED', 'GRILLED', 'BAKED', 'FRIED', 'STIR_FRIED', 'BRAISED', 'SIMMERED', 'FERMENTED', 'DRIED', 'OTHER')),
  ADD CONSTRAINT "Food_servingUnit_check" CHECK ("servingUnit" IS NULL OR "servingUnit" IN ('GRAM', 'MILLILITER', 'BOWL', 'PLATE', 'PIECE', 'SLICE', 'CUP', 'TABLESPOON', 'TEASPOON', 'SERVING')),
  ADD CONSTRAINT "Food_defaultServingSize_check" CHECK ("defaultServingSize" IS NULL OR "defaultServingSize" > 0);

ALTER TABLE "FoodNutrition" ADD COLUMN "confidence" DECIMAL(4,3);
ALTER TABLE "FoodNutrition" ADD CONSTRAINT "FoodNutrition_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

CREATE TABLE "FoodComponent" (
  "id" UUID NOT NULL,
  "foodId" UUID NOT NULL,
  "componentFoodId" UUID NOT NULL,
  "quantity" DECIMAL(12,3),
  "unit" VARCHAR(32),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FoodComponent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FoodComponent_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FoodComponent_componentFoodId_fkey" FOREIGN KEY ("componentFoodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FoodComponent_quantity_check" CHECK ("quantity" IS NULL OR "quantity" > 0)
);
CREATE UNIQUE INDEX "FoodComponent_foodId_componentFoodId_key" ON "FoodComponent"("foodId", "componentFoodId");
CREATE INDEX "FoodComponent_componentFoodId_idx" ON "FoodComponent"("componentFoodId");
