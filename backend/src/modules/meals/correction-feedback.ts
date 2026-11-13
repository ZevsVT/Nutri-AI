import type { Prisma } from "@prisma/client";

type Prediction = {
  id: string;
  foodId: string | null;
  predictedName: string;
  estimatedQuantity: unknown;
  estimatedUnit: string | null;
};

type ReviewedItem = {
  predictionId?: string;
  foodId: string;
  displayName?: string;
  quantity: number;
  unit: string;
};

export function correctionFeedback(
  analysisId: string,
  userId: string,
  predictions: readonly Prediction[],
  items: readonly ReviewedItem[],
): Prisma.AICorrectionCreateManyInput[] {
  const context = { analysisId, userId };
  const originals = new Map(
    predictions.map((prediction) => [prediction.id, prediction]),
  );
  const retained = new Set<string>();
  const rows: Prisma.AICorrectionCreateManyInput[] = [];

  for (const item of items) {
    if (!item.predictionId) {
      rows.push({
        ...context,
        correctionType: "FOOD_ADDED",
        correctedFoodId: item.foodId,
        correctedQuantity: item.quantity,
        correctedUnit: item.unit,
      });
      continue;
    }
    const prediction = originals.get(item.predictionId);
    if (!prediction || retained.has(item.predictionId))
      throw new Error("Invalid review prediction references");
    retained.add(prediction.id);
    const identity = { ...context, predictionId: prediction.id };
    if (prediction.foodId !== item.foodId) {
      rows.push({
        ...identity,
        correctionType: "FOOD_REPLACED",
        originalFoodId: prediction.foodId,
        correctedFoodId: item.foodId,
      });
    }
    if (
      item.displayName !== undefined &&
      prediction.predictedName.trim() !== item.displayName.trim()
    ) {
      rows.push({
        ...identity,
        correctionType: "NAME_CORRECTED",
        originalDisplayName: prediction.predictedName,
        correctedDisplayName: item.displayName,
      });
    }
    const previousAmount =
      prediction.estimatedQuantity == null
        ? null
        : Number(prediction.estimatedQuantity);
    if (
      previousAmount !== item.quantity ||
      prediction.estimatedUnit?.trim().toLowerCase() !==
        item.unit.trim().toLowerCase()
    ) {
      rows.push({
        ...identity,
        correctionType: "PORTION_CHANGED",
        originalFoodId: prediction.foodId,
        correctedFoodId: item.foodId,
        originalQuantity: previousAmount,
        originalUnit: prediction.estimatedUnit,
        correctedQuantity: item.quantity,
        correctedUnit: item.unit,
      });
    }
  }
  for (const prediction of predictions) {
    if (retained.has(prediction.id)) continue;
    rows.push({
      ...context,
      predictionId: prediction.id,
      correctionType: "FOOD_REMOVED",
      originalFoodId: prediction.foodId,
      originalQuantity:
        prediction.estimatedQuantity == null
          ? null
          : Number(prediction.estimatedQuantity),
      originalUnit: prediction.estimatedUnit,
    });
  }
  return rows;
}
