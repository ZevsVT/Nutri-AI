CREATE TYPE "NutritionMappingType" AS ENUM ('EXACT_MATCH', 'CLOSE_MATCH', 'DERIVED_ESTIMATE', 'UNAVAILABLE');

ALTER TABLE "FoodNutrition"
  ADD COLUMN "mappingType" "NutritionMappingType" NOT NULL DEFAULT 'EXACT_MATCH';

CREATE INDEX "FoodNutrition_mappingType_idx" ON "FoodNutrition"("mappingType");
