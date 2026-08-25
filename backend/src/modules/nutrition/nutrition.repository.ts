import type { PrismaClient } from "@prisma/client";

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
