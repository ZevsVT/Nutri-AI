-- Additive normalization metadata. Existing servingAmount/servingUnit values
-- remain intact and are treated as an explicit reference basis.
CREATE TYPE "NutritionReferenceBasis" AS ENUM ('PER_100_G', 'PER_100_ML', 'PER_SERVING');

ALTER TYPE "NutritionMappingType" ADD VALUE 'ESTIMATED';

ALTER TABLE "FoodNutrition"
  ADD COLUMN "referenceBasis" "NutritionReferenceBasis" NOT NULL DEFAULT 'PER_SERVING',
  ALTER COLUMN "calories" DROP NOT NULL,
  ALTER COLUMN "protein" DROP NOT NULL,
  ALTER COLUMN "carbohydrates" DROP NOT NULL,
  ALTER COLUMN "fat" DROP NOT NULL,
  ALTER COLUMN "fiber" DROP NOT NULL,
  ALTER COLUMN "sugar" DROP NOT NULL,
  ALTER COLUMN "sodium" DROP NOT NULL;

-- CHECK expressions remain valid for NULL values: SQL CHECK constraints pass
-- when the expression is unknown, preserving unknown != zero semantics.
CREATE INDEX "FoodNutrition_referenceBasis_idx" ON "FoodNutrition"("referenceBasis");
