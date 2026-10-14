import manifest from "./data/packaged-foods.json" with { type: "json" };
import {
  validatePackagedFoods,
  normalizedProductNutrition,
  type PackagedFoodEntry,
} from "./packaged-food-import.js";
import {
  nutritionDto,
  latestNutrition,
  type NutritionRecordLike,
} from "../nutrition/nutrition-record.js";
import type { BarcodeLookupResult } from "../../integrations/barcode/barcode-provider.js";

const validated = validatePackagedFoods(manifest);
if (validated.report.rejected)
  throw new Error("Bundled packaged-food catalog is invalid");
export const packagedFoodCatalog = validated.entries.map(([, entry]) => entry);

export function catalogNutritionRecord(
  entry: PackagedFoodEntry,
): NutritionRecordLike | null {
  const normalized = normalizedProductNutrition(entry, entry.importKey);
  if (!normalized) return null;
  return (
    latestNutrition([
      {
        ...normalized,
        servingAmount: normalized.referenceQuantity,
        servingUnit: normalized.referenceUnit,
        preparation: entry.nutrition!.preparation,
        nutritionVersionId: entry.source.version,
        nutritionVersion: {
          sourceId: entry.importKey,
          effectiveFrom: new Date(entry.source.reviewedAt),
          effectiveTo: null,
          version: entry.source.version,
          source: {
            name: entry.importKey,
            provider: entry.source.provider,
            sourceUrl: entry.nutrition!.evidenceUrl,
            license: entry.source.usageConditions,
          },
        },
      },
    ]) ?? null
  );
}

export function memoryCatalogProducts(): BarcodeLookupResult[] {
  return packagedFoodCatalog
    .filter((entry) => entry.status === "ACTIVE")
    .flatMap((entry) => {
      const record = catalogNutritionRecord(entry);
      const nutrition = record ? nutritionDto(record) : null;
      return entry.barcodes
        .filter((item) => item.status === "ACTIVE")
        .map((item) => ({
          barcode: item.barcode,
          foodId: entry.foodId,
          productName: entry.nameVi,
          brand: entry.brand,
          variant: entry.variant,
          package: {
            quantity: item.package?.quantity ?? null,
            unit: item.package?.unit ?? null,
            unitsPerPack: item.unitsPerPack,
          },
          labeledServing: item.labeledServing,
          nutritionAvailability: !nutrition
            ? "UNAVAILABLE"
            : [
                  nutrition.calories,
                  nutrition.protein,
                  nutrition.carbohydrates,
                  nutrition.fat,
                  nutrition.fiber,
                  nutrition.sugar,
                  nutrition.sodium,
                ].every((value) => value !== null)
              ? "AVAILABLE"
              : "PARTIAL",
          nutrition,
          source: {
            provider: entry.source.provider,
            name: entry.importKey,
            version: entry.source.version,
            reference: entry.source.reference,
            url: item.sourceUrl,
            reviewedAt: entry.source.reviewedAt,
            usageConditions: entry.source.usageConditions,
          },
        }));
    });
}
