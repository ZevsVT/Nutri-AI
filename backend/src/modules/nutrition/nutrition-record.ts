import { AppError } from "../../common/errors/app-error.js";
import {
  validateNutrition,
  scaleNutrition,
  type NutritionValues,
  type ReferenceBasis,
  type NutritionMappingType,
} from "./nutrition-normalization.js";

export interface NutritionRecordLike {
  nutritionVersionId: string;
  servingAmount: unknown;
  servingUnit: string;
  referenceBasis: ReferenceBasis;
  preparation: string;
  mappingType: NutritionMappingType;
  calories: unknown;
  protein: unknown;
  carbohydrates: unknown;
  fat: unknown;
  fiber: unknown;
  sugar: unknown;
  sodium: unknown;
  nutritionVersion: {
    sourceId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    version: string;
    metadata?: unknown;
    source: {
      name: string;
      provider: string;
      sourceUrl: string | null;
      license: string | null;
    };
  };
}

export const nullableNumber = (value: unknown): number | null =>
  value == null ? null : Number(value);

export function nutritionValues(
  record: Pick<NutritionRecordLike, keyof NutritionValues>,
): NutritionValues {
  return {
    calories: nullableNumber(record.calories),
    protein: nullableNumber(record.protein),
    carbohydrates: nullableNumber(record.carbohydrates),
    fat: nullableNumber(record.fat),
    fiber: nullableNumber(record.fiber),
    sugar: nullableNumber(record.sugar),
    sodium: nullableNumber(record.sodium),
  };
}

export function latestNutrition(
  records: readonly NutritionRecordLike[],
  currentVersionId?: string | null,
  now = new Date(),
) {
  if (currentVersionId === null) return undefined;
  return [...records]
    .filter(
      (record) =>
        (currentVersionId === undefined ||
          record.nutritionVersionId === currentVersionId) &&
        record.nutritionVersion.effectiveFrom <= now &&
        (!record.nutritionVersion.effectiveTo ||
          record.nutritionVersion.effectiveTo > now),
    )
    .sort(
      (a, b) =>
        b.nutritionVersion.effectiveFrom.getTime() -
          a.nutritionVersion.effectiveFrom.getTime() ||
        a.nutritionVersionId.localeCompare(b.nutritionVersionId),
    )[0];
}

export function nutritionDto(record: NutritionRecordLike) {
  const metadata = record.nutritionVersion.metadata as {
    nutritionEvidenceUrl?: unknown;
    usageConditions?: unknown;
  } | null;
  return {
    ...nutritionValues(record),
    servingAmount: Number(record.servingAmount),
    servingUnit: record.servingUnit,
    referenceBasis: record.referenceBasis,
    preparation: record.preparation,
    mappingType: record.mappingType,
    source: record.nutritionVersion.source.name,
    provider: record.nutritionVersion.source.provider,
    sourceId: record.nutritionVersion.sourceId,
    version: record.nutritionVersion.version,
    sourceUrl:
      typeof metadata?.nutritionEvidenceUrl === "string"
        ? metadata.nutritionEvidenceUrl
        : record.nutritionVersion.source.sourceUrl,
    license:
      typeof metadata?.usageConditions === "string"
        ? metadata.usageConditions
        : record.nutritionVersion.source.license,
  };
}

const unitAliases: Record<string, string> = {
  gram: "g",
  grams: "g",
  milliliter: "ml",
  milliliters: "ml",
  l: "ml",
  kg: "g",
};
function quantityInReferenceUnit(
  quantity: number,
  unit: string,
  referenceUnit: string,
) {
  const from = unit.trim().toLowerCase();
  const to = referenceUnit.trim().toLowerCase();
  if ((unitAliases[from] ?? from) !== (unitAliases[to] ?? to))
    throw new AppError(
      "VALIDATION_ERROR",
      "Consumed quantity unit is incompatible with the nutrition reference unit",
    );
  const factor = (value: string) =>
    value === "kg" || value === "l" ? 1000 : 1;
  return (quantity * factor(from)) / factor(to);
}

export function scaledNutrition(
  record: NutritionRecordLike,
  quantity: number,
  unit: string,
): NutritionValues {
  if (record.mappingType === "UNAVAILABLE" || record.preparation !== "AS_SOLD")
    throw new AppError(
      "NUTRITION_DATA_UNAVAILABLE",
      "As-sold nutrition data is unavailable",
    );
  if (!Object.values(nutritionValues(record)).some((value) => value !== null))
    throw new AppError(
      "NUTRITION_DATA_UNAVAILABLE",
      "Nutrition values are unavailable",
    );
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new AppError(
      "VALIDATION_ERROR",
      "Consumed quantity must be positive and finite",
    );
  const requested = quantityInReferenceUnit(quantity, unit, record.servingUnit);
  validateNutrition(nutritionValues(record));
  return scaleNutrition(
    nutritionValues(record),
    requested,
    Number(record.servingAmount),
  );
}
