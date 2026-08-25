import type { MealStatus, MealType, PrismaClient } from "@prisma/client";

export interface CreateMealInput {
  mealType: MealType;
  capturedAt: Date;
  name?: string;
  notes?: string;
  imageUrl?: string;
  status?: MealStatus;
}

export class MealRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByIdForUser(id: string, userId: string) {
    return this.prisma.meal.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        items: { include: { food: true, nutritionSnapshot: true } },
        nutrition: true,
        aiAnalyses: { include: { predictions: true, corrections: true } },
      },
    });
  }

  listForUser(userId: string, range: { from?: Date; to?: Date } = {}) {
    return this.prisma.meal.findMany({
      where: {
        userId,
        deletedAt: null,
        capturedAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      },
      orderBy: { capturedAt: "desc" },
      include: {
        items: { include: { nutritionSnapshot: true } },
        nutrition: true,
      },
    });
  }

  createForUser(userId: string, input: CreateMealInput) {
    return this.prisma.meal.create({
      data: { userId, ...input },
    });
  }

  async softDeleteForUser(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.meal.updateMany({
      where: { id, userId, deletedAt: null },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    return result.count === 1;
  }
}
