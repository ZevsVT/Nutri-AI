import { z } from "zod";
import type { VisionPortion } from "../../integrations/ai/openai-vision.js";
import {
  quantityInReferenceUnit,
  scaledNutrition,
  type NutritionRecordLike,
} from "../nutrition/nutrition-record.js";

export const portionEvidenceSchema = z.object({
  basis: z.enum(["VISIBLE_MEASUREMENT", "VISIBLE_SERVING_COUNT"]),
  confidence: z.number().min(0).max(1),
  source: z.string(),
  version: z.string(),
  servingReference: z
    .object({ amount: z.number().positive(), unit: z.string() })
    .optional(),
});

export function estimatePortion(
  estimate: VisionPortion | null | undefined,
  reference: NutritionRecordLike | undefined,
) {
  if (!estimate || !reference || estimate.confidence < 0.5) return null;
  const isServingCount = estimate.basis === "VISIBLE_SERVING_COUNT";
  if (isServingCount !== (estimate.unit === "serving")) return null;
  if (
    isServingCount &&
    (!Number.isInteger(estimate.amount) ||
      reference.referenceBasis !== "PER_SERVING")
  )
    return null;

  try {
    const referenceAmount = Number(reference.servingAmount);
    const unit = reference.servingUnit;
    const measured = isServingCount
      ? estimate.amount * referenceAmount
      : quantityInReferenceUnit(estimate.amount, estimate.unit, unit);
    const quantity = Math.round(measured * 1000) / 1000;
    if (quantity > 100_000) return null;
    scaledNutrition(reference, quantity, unit);
    return {
      quantity,
      unit,
      evidence: {
        basis: estimate.basis,
        confidence: estimate.confidence,
        source: reference.nutritionVersion.source.name,
        version: reference.nutritionVersion.version,
        ...(isServingCount
          ? { servingReference: { amount: referenceAmount, unit } }
          : {}),
      } satisfies z.infer<typeof portionEvidenceSchema>,
    };
  } catch {
    // A quantity without compatible catalog nutrition stays unknown.
    return null;
  }
}
