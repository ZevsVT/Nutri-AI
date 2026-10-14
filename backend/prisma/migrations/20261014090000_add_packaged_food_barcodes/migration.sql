-- Additive product catalog; no existing identities, values, or snapshots are rewritten.
ALTER TABLE "NutritionVersion" ADD COLUMN "metadata" JSONB;
ALTER TABLE "FoodNutrition" ADD COLUMN "preparation" VARCHAR(24) NOT NULL DEFAULT 'AS_SOLD';
ALTER TABLE "FoodNutrition" ADD CONSTRAINT "FoodNutrition_preparation_check" CHECK ("preparation" IN ('AS_SOLD', 'AS_PREPARED'));

CREATE TABLE "PackagedProduct" (
  "foodId" UUID NOT NULL PRIMARY KEY,
  "importKey" VARCHAR(160) NOT NULL UNIQUE,
  "brand" VARCHAR(120) NOT NULL,
  "variant" VARCHAR(160) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  "sourceId" UUID NOT NULL UNIQUE,
  "sourceReference" VARCHAR(240) NOT NULL,
  "sourceVersion" VARCHAR(80) NOT NULL,
  "reviewedAt" TIMESTAMPTZ(3) NOT NULL,
  "manifestHash" VARCHAR(64) NOT NULL,
  "currentNutritionVersionId" UUID,
  CONSTRAINT "PackagedProduct_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagedProduct_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "FoodSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagedProduct_currentNutritionVersionId_sourceId_fkey" FOREIGN KEY ("currentNutritionVersionId", "sourceId") REFERENCES "NutritionVersion"("id", "sourceId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagedProduct_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'DEPRECATED')),
  CONSTRAINT "PackagedProduct_identity_check" CHECK (length(trim("brand")) > 0 AND length(trim("variant")) > 0 AND length(trim("importKey")) > 0),
  CONSTRAINT "PackagedProduct_manifestHash_check" CHECK ("manifestHash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "FoodBarcode" (
  "normalizedBarcode" VARCHAR(14) NOT NULL PRIMARY KEY,
  "barcode" VARCHAR(14) NOT NULL,
  "foodId" UUID NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  "packageQuantity" DECIMAL(12,3),
  "packageUnit" VARCHAR(32),
  "unitsPerPack" INTEGER NOT NULL DEFAULT 1,
  "labeledServingQuantity" DECIMAL(12,3),
  "labeledServingUnit" VARCHAR(32),
  "sourceUrl" TEXT NOT NULL,
  CONSTRAINT "FoodBarcode_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "PackagedProduct"("foodId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FoodBarcode_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'DEPRECATED')),
  CONSTRAINT "FoodBarcode_key_check" CHECK (
    "barcode" ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'
    AND "normalizedBarcode" = lpad("barcode", 14, '0')
    AND "normalizedBarcode" ~ '^[0-9]{14}$'
    AND ((10 - ((substring("normalizedBarcode", 1, 1)::integer * 3 + substring("normalizedBarcode", 2, 1)::integer * 1 + substring("normalizedBarcode", 3, 1)::integer * 3 + substring("normalizedBarcode", 4, 1)::integer * 1 + substring("normalizedBarcode", 5, 1)::integer * 3 + substring("normalizedBarcode", 6, 1)::integer * 1 + substring("normalizedBarcode", 7, 1)::integer * 3 + substring("normalizedBarcode", 8, 1)::integer * 1 + substring("normalizedBarcode", 9, 1)::integer * 3 + substring("normalizedBarcode", 10, 1)::integer * 1 + substring("normalizedBarcode", 11, 1)::integer * 3 + substring("normalizedBarcode", 12, 1)::integer * 1 + substring("normalizedBarcode", 13, 1)::integer * 3) % 10)) % 10 = substring("normalizedBarcode", 14, 1)::integer)
  ),
  CONSTRAINT "FoodBarcode_package_check" CHECK (("packageQuantity" IS NULL AND "packageUnit" IS NULL) OR ("packageQuantity" IS NOT NULL AND "packageQuantity" > 0 AND "packageUnit" IS NOT NULL AND "packageUnit" IN ('g', 'ml', 'piece'))),
  CONSTRAINT "FoodBarcode_serving_check" CHECK (("labeledServingQuantity" IS NULL AND "labeledServingUnit" IS NULL) OR ("labeledServingQuantity" IS NOT NULL AND "labeledServingQuantity" > 0 AND "labeledServingUnit" IS NOT NULL AND "labeledServingUnit" IN ('g', 'ml', 'serving'))),
  CONSTRAINT "FoodBarcode_unitsPerPack_check" CHECK ("unitsPerPack" > 0)
);
CREATE INDEX "FoodBarcode_foodId_idx" ON "FoodBarcode"("foodId");

-- Unknown nutrients must also remain unknown after confirmation.
ALTER TABLE "MealItemNutrition"
  ALTER COLUMN "calories" DROP NOT NULL,
  ALTER COLUMN "protein" DROP NOT NULL,
  ALTER COLUMN "carbohydrates" DROP NOT NULL,
  ALTER COLUMN "fat" DROP NOT NULL,
  ALTER COLUMN "fiber" DROP NOT NULL,
  ALTER COLUMN "sugar" DROP NOT NULL,
  ALTER COLUMN "sodium" DROP NOT NULL;
