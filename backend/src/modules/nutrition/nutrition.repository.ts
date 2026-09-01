import type { PrismaClient } from "@prisma/client";
import { validateNutrition } from "./nutrition-normalization.js";

export interface NutritionSnapshotInput {
  mealItemId: string;
  nutritionVersionId: string;
  sourceId: string;
  servingAmount: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  estimated: boolean;
  confidence?: number;
}

export class NutritionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findSnapshotForUser(mealItemId: string, userId: string) {
    return this.prisma.mealItemNutrition.findFirst({
      where: {
        mealItemId,
        mealItem: { meal: { userId, deletedAt: null } },
      },
    });
  }

  /**
   * A snapshot is write-once. Retried confirmation returns the existing row;
   * it never recalculates or overwrites historical nutrition values.
   */
  createSnapshotForUser(userId: string, input: NutritionSnapshotInput) {
    if (!input.sourceId.trim() || !input.nutritionVersionId.trim() || !input.servingUnit.trim()) throw new Error("Nutrition provenance and serving unit are required");
    validateNutrition(input);
    if (!Number.isFinite(input.servingAmount) || input.servingAmount <= 0) throw new Error("Serving amount must be positive");
    return this.prisma.$transaction(async (transaction) => {
      const item = await transaction.mealItem.findFirst({
        where: {
          id: input.mealItemId,
          meal: { userId, deletedAt: null },
        },
        select: { id: true },
      });
      if (!item) {
        return null;
      }

      return transaction.mealItemNutrition.upsert({
        where: { mealItemId: input.mealItemId },
        update: {},
        create: input,
      });
    });
  }
}
