-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'MODERATOR', 'NUTRITION_EDITOR', 'SUPPORT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PRIVACY_POLICY', 'TERMS', 'AI_PROCESSING', 'ANALYTICS', 'MARKETING', 'HEALTH_DATA');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "FoodSourceType" AS ENUM ('CURATED', 'GOVERNMENT', 'RESEARCH', 'PROVIDER', 'USER_SUBMITTED');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER');

-- CreateEnum
CREATE TYPE "MealStatus" AS ENUM ('DRAFT', 'ANALYZING', 'REVIEW', 'CONFIRMED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "NutritionAnalysisStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AIAnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AIInputType" AS ENUM ('IMAGE', 'TEXT', 'BARCODE', 'MANUAL');

-- CreateEnum
CREATE TYPE "AICorrectionType" AS ENUM ('FOOD_REPLACED', 'FOOD_REMOVED', 'FOOD_ADDED', 'PORTION_CHANGED', 'NAME_CORRECTED');

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'POSITIVE', 'WARNING');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(120),
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "language" VARCHAR(10) NOT NULL DEFAULT 'vi',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "dietaryPreference" VARCHAR(120),
    "activityContext" VARCHAR(120),
    "foodPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "foodExclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "grantedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Food" (
    "id" UUID NOT NULL,
    "canonicalName" VARCHAR(160) NOT NULL,
    "nameVi" VARCHAR(160) NOT NULL,
    "nameEn" VARCHAR(160),
    "description" TEXT,
    "category" VARCHAR(100),
    "cuisine" VARCHAR(100),
    "foodType" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodAlias" (
    "id" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "alias" VARCHAR(200) NOT NULL,
    "normalizedAlias" VARCHAR(200) NOT NULL,
    "language" VARCHAR(10) NOT NULL DEFAULT 'vi',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSource" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "provider" VARCHAR(120) NOT NULL,
    "sourceType" "FoodSourceType" NOT NULL,
    "sourceUrl" TEXT,
    "sourceReference" VARCHAR(240),
    "license" VARCHAR(160),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoodSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionVersion" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "version" VARCHAR(80) NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodNutrition" (
    "id" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "nutritionVersionId" UUID NOT NULL,
    "servingAmount" DECIMAL(12,3) NOT NULL,
    "servingUnit" VARCHAR(32) NOT NULL,
    "calories" DECIMAL(12,2) NOT NULL,
    "protein" DECIMAL(12,3) NOT NULL,
    "carbohydrates" DECIMAL(12,3) NOT NULL,
    "fat" DECIMAL(12,3) NOT NULL,
    "fiber" DECIMAL(12,3) NOT NULL,
    "sugar" DECIMAL(12,3) NOT NULL,
    "sodium" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FoodNutrition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mealType" "MealType" NOT NULL,
    "name" VARCHAR(160) NOT NULL DEFAULT 'Untitled meal',
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "status" "MealStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "imageUrl" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealItem" (
    "id" UUID NOT NULL,
    "mealId" UUID NOT NULL,
    "foodId" UUID,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" VARCHAR(32) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "confidence" DECIMAL(4,3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealItemNutrition" (
    "id" UUID NOT NULL,
    "mealItemId" UUID NOT NULL,
    "nutritionVersionId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "servingAmount" DECIMAL(12,3) NOT NULL,
    "servingUnit" VARCHAR(32) NOT NULL,
    "calories" DECIMAL(12,2) NOT NULL,
    "protein" DECIMAL(12,3) NOT NULL,
    "carbohydrates" DECIMAL(12,3) NOT NULL,
    "fat" DECIMAL(12,3) NOT NULL,
    "fiber" DECIMAL(12,3) NOT NULL,
    "sugar" DECIMAL(12,3) NOT NULL,
    "sodium" DECIMAL(12,3) NOT NULL,
    "estimated" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DECIMAL(4,3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealItemNutrition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionAnalysis" (
    "id" UUID NOT NULL,
    "mealId" UUID NOT NULL,
    "status" "NutritionAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "totalCalories" DECIMAL(12,2),
    "totalProtein" DECIMAL(12,3),
    "totalCarbohydrates" DECIMAL(12,3),
    "totalFat" DECIMAL(12,3),
    "totalFiber" DECIMAL(12,3),
    "confidence" DECIMAL(4,3),
    "method" VARCHAR(80),
    "version" VARCHAR(80),
    "explanation" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NutritionAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAnalysis" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mealId" UUID NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "modelVersion" VARCHAR(80),
    "status" "AIAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "inputType" "AIInputType" NOT NULL,
    "inputReference" TEXT,
    "confidence" DECIMAL(4,3),
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "errorCode" VARCHAR(80),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AIAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFoodPrediction" (
    "id" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "foodId" UUID,
    "predictedName" VARCHAR(160) NOT NULL,
    "confidence" DECIMAL(4,3),
    "estimatedQuantity" DECIMAL(12,3),
    "estimatedUnit" VARCHAR(32),
    "modelMetadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFoodPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AICorrection" (
    "id" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "predictionId" UUID,
    "userId" UUID NOT NULL,
    "correctionType" "AICorrectionType" NOT NULL,
    "originalFoodId" UUID,
    "correctedFoodId" UUID,
    "originalQuantity" DECIMAL(12,3),
    "correctedQuantity" DECIMAL(12,3),
    "originalUnit" VARCHAR(32),
    "correctedUnit" VARCHAR(32),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AICorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" UUID NOT NULL,
    "nameVi" VARCHAR(160) NOT NULL,
    "nameEn" VARCHAR(160),
    "description" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "prepTime" INTEGER,
    "cookTime" INTEGER,
    "difficulty" "RecipeDifficulty" NOT NULL DEFAULT 'EASY',
    "status" "RecipeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" VARCHAR(32) NOT NULL,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeNutrition" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "calories" DECIMAL(12,2) NOT NULL,
    "protein" DECIMAL(12,3) NOT NULL,
    "carbohydrates" DECIMAL(12,3) NOT NULL,
    "fat" DECIMAL(12,3) NOT NULL,
    "fiber" DECIMAL(12,3) NOT NULL,
    "sugar" DECIMAL(12,3) NOT NULL,
    "sodium" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecipeNutrition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "loggedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WaterLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionInsight" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "periodStart" TIMESTAMPTZ(3) NOT NULL,
    "periodEnd" TIMESTAMPTZ(3) NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" "InsightSeverity" NOT NULL DEFAULT 'INFO',
    "confidence" DECIMAL(4,3),
    "data" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "NutritionInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "UserConsent_userId_consentType_createdAt_idx" ON "UserConsent"("userId", "consentType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Food_canonicalName_key" ON "Food"("canonicalName");

-- CreateIndex
CREATE INDEX "Food_nameVi_idx" ON "Food"("nameVi");

-- CreateIndex
CREATE INDEX "Food_isActive_idx" ON "Food"("isActive");

-- CreateIndex
CREATE INDEX "FoodAlias_foodId_idx" ON "FoodAlias"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodAlias_normalizedAlias_language_key" ON "FoodAlias"("normalizedAlias", "language");

-- CreateIndex
CREATE INDEX "FoodSource_provider_idx" ON "FoodSource"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSource_provider_name_key" ON "FoodSource"("provider", "name");

-- CreateIndex
CREATE INDEX "NutritionVersion_sourceId_effectiveFrom_idx" ON "NutritionVersion"("sourceId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionVersion_sourceId_version_key" ON "NutritionVersion"("sourceId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionVersion_id_sourceId_key" ON "NutritionVersion"("id", "sourceId");

-- CreateIndex
CREATE INDEX "FoodNutrition_nutritionVersionId_idx" ON "FoodNutrition"("nutritionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodNutrition_foodId_nutritionVersionId_key" ON "FoodNutrition"("foodId", "nutritionVersionId");

-- CreateIndex
CREATE INDEX "Meal_userId_capturedAt_idx" ON "Meal"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "Meal_userId_status_idx" ON "Meal"("userId", "status");

-- CreateIndex
CREATE INDEX "MealItem_mealId_idx" ON "MealItem"("mealId");

-- CreateIndex
CREATE INDEX "MealItem_foodId_idx" ON "MealItem"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "MealItemNutrition_mealItemId_key" ON "MealItemNutrition"("mealItemId");

-- CreateIndex
CREATE INDEX "MealItemNutrition_nutritionVersionId_idx" ON "MealItemNutrition"("nutritionVersionId");

-- CreateIndex
CREATE INDEX "MealItemNutrition_sourceId_idx" ON "MealItemNutrition"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionAnalysis_mealId_key" ON "NutritionAnalysis"("mealId");

-- CreateIndex
CREATE INDEX "AIAnalysis_userId_idx" ON "AIAnalysis"("userId");

-- CreateIndex
CREATE INDEX "AIAnalysis_mealId_idx" ON "AIAnalysis"("mealId");

-- CreateIndex
CREATE INDEX "AIAnalysis_status_idx" ON "AIAnalysis"("status");

-- CreateIndex
CREATE INDEX "AIAnalysis_createdAt_idx" ON "AIAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "AIFoodPrediction_analysisId_idx" ON "AIFoodPrediction"("analysisId");

-- CreateIndex
CREATE INDEX "AIFoodPrediction_foodId_idx" ON "AIFoodPrediction"("foodId");

-- CreateIndex
CREATE INDEX "AICorrection_analysisId_idx" ON "AICorrection"("analysisId");

-- CreateIndex
CREATE INDEX "AICorrection_userId_createdAt_idx" ON "AICorrection"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Recipe_status_idx" ON "Recipe"("status");

-- CreateIndex
CREATE INDEX "RecipeIngredient_foodId_idx" ON "RecipeIngredient"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_foodId_key" ON "RecipeIngredient"("recipeId", "foodId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeNutrition_recipeId_key" ON "RecipeNutrition"("recipeId");

-- CreateIndex
CREATE INDEX "WaterLog_userId_loggedAt_idx" ON "WaterLog"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "NutritionInsight_userId_periodStart_periodEnd_idx" ON "NutritionInsight"("userId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodAlias" ADD CONSTRAINT "FoodAlias_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionVersion" ADD CONSTRAINT "NutritionVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "FoodSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodNutrition" ADD CONSTRAINT "FoodNutrition_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodNutrition" ADD CONSTRAINT "FoodNutrition_nutritionVersionId_fkey" FOREIGN KEY ("nutritionVersionId") REFERENCES "NutritionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItemNutrition" ADD CONSTRAINT "MealItemNutrition_mealItemId_fkey" FOREIGN KEY ("mealItemId") REFERENCES "MealItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItemNutrition" ADD CONSTRAINT "MealItemNutrition_nutritionVersionId_sourceId_fkey" FOREIGN KEY ("nutritionVersionId", "sourceId") REFERENCES "NutritionVersion"("id", "sourceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItemNutrition" ADD CONSTRAINT "MealItemNutrition_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "FoodSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionAnalysis" ADD CONSTRAINT "NutritionAnalysis_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFoodPrediction" ADD CONSTRAINT "AIFoodPrediction_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFoodPrediction" ADD CONSTRAINT "AIFoodPrediction_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICorrection" ADD CONSTRAINT "AICorrection_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICorrection" ADD CONSTRAINT "AICorrection_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "AIFoodPrediction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICorrection" ADD CONSTRAINT "AICorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICorrection" ADD CONSTRAINT "AICorrection_originalFoodId_fkey" FOREIGN KEY ("originalFoodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICorrection" ADD CONSTRAINT "AICorrection_correctedFoodId_fkey" FOREIGN KEY ("correctedFoodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeNutrition" ADD CONSTRAINT "RecipeNutrition_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterLog" ADD CONSTRAINT "WaterLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionInsight" ADD CONSTRAINT "NutritionInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Basic integrity constraints are kept in SQL because Prisma's schema DSL
-- cannot express PostgreSQL CHECK constraints.
ALTER TABLE "UserConsent"
  ADD CONSTRAINT "UserConsent_valid_dates_check"
  CHECK (
    ("status" = 'GRANTED' AND "grantedAt" IS NOT NULL AND "revokedAt" IS NULL)
    OR
    ("status" = 'REVOKED' AND "grantedAt" IS NOT NULL AND "revokedAt" IS NOT NULL)
  );

ALTER TABLE "NutritionVersion"
  ADD CONSTRAINT "NutritionVersion_valid_period_check"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");

ALTER TABLE "FoodAlias"
  ADD CONSTRAINT "FoodAlias_non_empty_alias_check"
  CHECK (btrim("alias") <> '' AND btrim("normalizedAlias") <> '');

ALTER TABLE "FoodNutrition"
  ADD CONSTRAINT "FoodNutrition_positive_serving_check"
  CHECK ("servingAmount" > 0),
  ADD CONSTRAINT "FoodNutrition_non_negative_values_check"
  CHECK (
    "calories" >= 0 AND "protein" >= 0 AND "carbohydrates" >= 0
    AND "fat" >= 0 AND "fiber" >= 0 AND "sugar" >= 0 AND "sodium" >= 0
  );

ALTER TABLE "Meal"
  ADD CONSTRAINT "Meal_valid_dates_check"
  CHECK (
    ("confirmedAt" IS NULL OR "confirmedAt" >= "capturedAt")
    AND ("status" <> 'DELETED' OR "deletedAt" IS NOT NULL)
  );

ALTER TABLE "MealItem"
  ADD CONSTRAINT "MealItem_positive_quantity_check"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "MealItem_confidence_range_check"
  CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

ALTER TABLE "MealItemNutrition"
  ADD CONSTRAINT "MealItemNutrition_positive_serving_check"
  CHECK ("servingAmount" > 0),
  ADD CONSTRAINT "MealItemNutrition_non_negative_values_check"
  CHECK (
    "calories" >= 0 AND "protein" >= 0 AND "carbohydrates" >= 0
    AND "fat" >= 0 AND "fiber" >= 0 AND "sugar" >= 0 AND "sodium" >= 0
  ),
  ADD CONSTRAINT "MealItemNutrition_confidence_range_check"
  CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

ALTER TABLE "NutritionAnalysis"
  ADD CONSTRAINT "NutritionAnalysis_non_negative_values_check"
  CHECK (
    ("totalCalories" IS NULL OR "totalCalories" >= 0)
    AND ("totalProtein" IS NULL OR "totalProtein" >= 0)
    AND ("totalCarbohydrates" IS NULL OR "totalCarbohydrates" >= 0)
    AND ("totalFat" IS NULL OR "totalFat" >= 0)
    AND ("totalFiber" IS NULL OR "totalFiber" >= 0)
  ),
  ADD CONSTRAINT "NutritionAnalysis_confidence_range_check"
  CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

ALTER TABLE "AIFoodPrediction"
  ADD CONSTRAINT "AIFoodPrediction_confidence_range_check"
  CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  ADD CONSTRAINT "AIFoodPrediction_positive_quantity_check"
  CHECK ("estimatedQuantity" IS NULL OR "estimatedQuantity" > 0);

ALTER TABLE "AIAnalysis"
  ADD CONSTRAINT "AIAnalysis_confidence_range_check"
  CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  ADD CONSTRAINT "AIAnalysis_valid_dates_check"
  CHECK ("completedAt" IS NULL OR "startedAt" IS NULL OR "completedAt" >= "startedAt");

ALTER TABLE "AICorrection"
  ADD CONSTRAINT "AICorrection_positive_quantities_check"
  CHECK (
    ("originalQuantity" IS NULL OR "originalQuantity" > 0)
    AND ("correctedQuantity" IS NULL OR "correctedQuantity" > 0)
  );

ALTER TABLE "Recipe"
  ADD CONSTRAINT "Recipe_positive_servings_check"
  CHECK ("servings" > 0 AND ("prepTime" IS NULL OR "prepTime" >= 0) AND ("cookTime" IS NULL OR "cookTime" >= 0));

ALTER TABLE "RecipeIngredient"
  ADD CONSTRAINT "RecipeIngredient_positive_quantity_check"
  CHECK ("quantity" > 0);

ALTER TABLE "RecipeNutrition"
  ADD CONSTRAINT "RecipeNutrition_non_negative_values_check"
  CHECK (
    "calories" >= 0 AND "protein" >= 0 AND "carbohydrates" >= 0
    AND "fat" >= 0 AND "fiber" >= 0 AND "sugar" >= 0 AND "sodium" >= 0
  );

ALTER TABLE "WaterLog"
  ADD CONSTRAINT "WaterLog_positive_amount_check"
  CHECK ("amountMl" > 0);

ALTER TABLE "NutritionInsight"
  ADD CONSTRAINT "NutritionInsight_valid_period_check"
  CHECK ("periodEnd" >= "periodStart"),
  ADD CONSTRAINT "NutritionInsight_confidence_range_check"
  CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));
