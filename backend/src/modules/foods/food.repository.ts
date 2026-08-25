import type { PrismaClient } from "@prisma/client";

export class FoodRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.food.findUnique({
      where: { id },
      include: { aliases: true, nutritionRecords: true },
    });
  }

  findByAlias(normalizedAlias: string, language = "vi") {
    return this.prisma.foodAlias.findUnique({
      where: {
        normalizedAlias_language: { normalizedAlias, language },
      },
      include: { food: true },
    });
  }

  search(query: string, limit = 20) {
    const value = query.trim();
    if (value.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.food.findMany({
      where: {
        isActive: true,
        OR: [
          { canonicalName: { contains: value, mode: "insensitive" } },
          { nameVi: { contains: value, mode: "insensitive" } },
          { nameEn: { contains: value, mode: "insensitive" } },
          {
            aliases: {
              some: { alias: { contains: value, mode: "insensitive" } },
            },
          },
        ],
      },
      orderBy: { nameVi: "asc" },
      take: limit,
    });
  }

  findNutrition(foodId: string, nutritionVersionId: string) {
    return this.prisma.foodNutrition.findUnique({
      where: { foodId_nutritionVersionId: { foodId, nutritionVersionId } },
      include: { nutritionVersion: { include: { source: true } } },
    });
  }
}
