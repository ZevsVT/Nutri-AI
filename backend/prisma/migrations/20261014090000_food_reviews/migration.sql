-- CreateEnum
CREATE TYPE "FoodReviewState" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "FoodReviewOperation" AS ENUM ('CREATE_FOOD', 'UPDATE_FOOD', 'ADD_ALIAS', 'REMOVE_ALIAS', 'PUBLISH_NUTRITION', 'WITHDRAW_NUTRITION', 'UPDATE_PRODUCT', 'ADD_BARCODE', 'SET_BARCODE_STATUS', 'SET_FOOD_STATUS');

-- AlterTable
ALTER TABLE "FoodAlias" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "FoodNutrition" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preparationState" VARCHAR(100);

-- Extend the packaged-food catalog instead of recreating its tables.
ALTER TABLE "PackagedProduct"
    ALTER COLUMN "brand" TYPE VARCHAR(160),
    ALTER COLUMN "importKey" DROP NOT NULL,
    ALTER COLUMN "sourceReference" DROP NOT NULL,
    ALTER COLUMN "sourceVersion" DROP NOT NULL,
    ALTER COLUMN "reviewedAt" DROP NOT NULL,
    ALTER COLUMN "manifestHash" DROP NOT NULL,
    ADD COLUMN "formulation" VARCHAR(160),
    ADD COLUMN "productName" VARCHAR(160),
    ADD COLUMN "packageQuantity" DECIMAL(12,3),
    ADD COLUMN "packageUnit" VARCHAR(16),
    ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PackagedProduct" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PackagedProduct" DROP CONSTRAINT "PackagedProduct_sourceId_key";

ALTER TABLE "FoodBarcode"
    ALTER COLUMN "sourceUrl" DROP NOT NULL,
    ADD COLUMN "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FoodBarcode" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "FoodReview" (
    "id" UUID NOT NULL,
    "operation" "FoodReviewOperation" NOT NULL,
    "targetFoodId" UUID,
    "authorId" UUID NOT NULL,
    "state" "FoodReviewState" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "predecessorId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "decidedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FoodReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodReviewRevision" (
    "reviewId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "baseline" JSONB NOT NULL,
    "baselineFingerprint" VARCHAR(64) NOT NULL,
    "evidence" JSONB NOT NULL,
    "explanation" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodReviewRevision_pkey" PRIMARY KEY ("reviewId","revision")
);

-- CreateTable
CREATE TABLE "FoodReviewReservation" (
    "key" VARCHAR(400) NOT NULL,
    "reviewId" UUID NOT NULL,

    CONSTRAINT "FoodReviewReservation_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FoodReviewAudit" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "actorId" UUID NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "reason" VARCHAR(4000),
    "publication" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodReviewAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackagedProduct_brand_formulation_key" ON "PackagedProduct"("brand", "formulation");

-- CreateIndex
CREATE UNIQUE INDEX "FoodReview_predecessorId_key" ON "FoodReview"("predecessorId");

-- CreateIndex
CREATE INDEX "FoodReview_state_createdAt_idx" ON "FoodReview"("state", "createdAt");

-- CreateIndex
CREATE INDEX "FoodReview_targetFoodId_createdAt_idx" ON "FoodReview"("targetFoodId", "createdAt");

-- CreateIndex
CREATE INDEX "FoodReview_authorId_createdAt_idx" ON "FoodReview"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "FoodReviewReservation_reviewId_idx" ON "FoodReviewReservation"("reviewId");

-- CreateIndex
CREATE INDEX "FoodReviewAudit_reviewId_createdAt_idx" ON "FoodReviewAudit"("reviewId", "createdAt");

-- AddForeignKey
ALTER TABLE "FoodReview" ADD CONSTRAINT "FoodReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodReview" ADD CONSTRAINT "FoodReview_targetFoodId_fkey" FOREIGN KEY ("targetFoodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodReview" ADD CONSTRAINT "FoodReview_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "FoodReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodReviewRevision" ADD CONSTRAINT "FoodReviewRevision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "FoodReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodReviewReservation" ADD CONSTRAINT "FoodReviewReservation_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "FoodReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodReviewAudit" ADD CONSTRAINT "FoodReviewAudit_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "FoodReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodReviewAudit" ADD CONSTRAINT "FoodReviewAudit_reviewId_revision_fkey" FOREIGN KEY ("reviewId", "revision") REFERENCES "FoodReviewRevision"("reviewId", "revision") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodReviewAudit" ADD CONSTRAINT "FoodReviewAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Applied as part of the additive food-review migration.
CREATE FUNCTION reject_review_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Review revisions and audit events are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER review_revision_immutable BEFORE UPDATE OR DELETE ON "FoodReviewRevision"
  FOR EACH ROW EXECUTE FUNCTION reject_review_history_mutation();
CREATE TRIGGER review_audit_immutable BEFORE UPDATE OR DELETE ON "FoodReviewAudit"
  FOR EACH ROW EXECUTE FUNCTION reject_review_history_mutation();

CREATE FUNCTION protect_catalog_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'Food' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW."canonicalName" IS DISTINCT FROM OLD."canonicalName" OR NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'Canonical identity is immutable' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'PackagedProduct' THEN
    IF NEW."foodId" IS DISTINCT FROM OLD."foodId" OR NEW.brand IS DISTINCT FROM OLD.brand OR NEW.formulation IS DISTINCT FROM OLD.formulation OR NEW.variant IS DISTINCT FROM OLD.variant OR NEW."importKey" IS DISTINCT FROM OLD."importKey" OR NEW."sourceId" IS DISTINCT FROM OLD."sourceId" THEN
      RAISE EXCEPTION 'Product identity is immutable' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW."foodId" IS DISTINCT FROM OLD."foodId" THEN
      RAISE EXCEPTION 'Catalog ownership is immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'FoodAlias' THEN
      IF NEW."normalizedAlias" IS DISTINCT FROM OLD."normalizedAlias" OR NEW.language IS DISTINCT FROM OLD.language THEN
        RAISE EXCEPTION 'Alias identity is immutable' USING ERRCODE = '23514';
      END IF;
    ELSE
      IF NEW.barcode IS DISTINCT FROM OLD.barcode OR NEW."normalizedBarcode" IS DISTINCT FROM OLD."normalizedBarcode" THEN
        RAISE EXCEPTION 'Barcode identity is immutable' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER food_identity_immutable BEFORE UPDATE ON "Food" FOR EACH ROW EXECUTE FUNCTION protect_catalog_identity();
CREATE TRIGGER alias_ownership_immutable BEFORE UPDATE ON "FoodAlias" FOR EACH ROW EXECUTE FUNCTION protect_catalog_identity();
CREATE TRIGGER product_identity_immutable BEFORE UPDATE ON "PackagedProduct" FOR EACH ROW EXECUTE FUNCTION protect_catalog_identity();
CREATE TRIGGER barcode_ownership_immutable BEFORE UPDATE ON "FoodBarcode" FOR EACH ROW EXECUTE FUNCTION protect_catalog_identity();

ALTER TABLE "PackagedProduct" ADD CONSTRAINT "PackagedProduct_quantity_check" CHECK ("packageQuantity" > 0);
ALTER TABLE "FoodReview" ADD CONSTRAINT "FoodReview_revision_check" CHECK (revision > 0);
