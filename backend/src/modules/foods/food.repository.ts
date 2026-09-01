import type { PrismaClient } from "@prisma/client";
import { normalizeFoodText } from "./food-taxonomy.js";
import { rankFoods, searchTokens, type FoodSearchFilters } from "./food-search.js";

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

  async search(query: string, limit = 20, filters: FoodSearchFilters = {}) {
    const value = query.trim();
    if (value.length === 0) return [];

    const normalized = normalizeFoodText(value);
    const tokens = searchTokens(value);
    const where = {
      isActive: true,
      ...Object.fromEntries(
        Object.entries(filters).filter(([, expected]) => expected),
      ),
      OR: [
        { canonicalName: { contains: value, mode: "insensitive" as const } },
        { normalizedName: { contains: normalized, mode: "insensitive" as const } },
        { nameVi: { contains: value, mode: "insensitive" as const } },
        { nameEn: { contains: value, mode: "insensitive" as const } },
        ...tokens.flatMap((token) => [
          { normalizedName: { contains: token, mode: "insensitive" as const } },
          { nameEn: { contains: token, mode: "insensitive" as const } },
          { aliases: { some: { normalizedAlias: { contains: token, mode: "insensitive" as const } } } },
        ]),
        {
          aliases: {
            some: {
              OR: [
                { alias: { contains: value, mode: "insensitive" as const } },
                { normalizedAlias: { contains: normalized, mode: "insensitive" as const } },
              ],
            },
          },
        },
      ],
    };
    const candidates = await this.prisma.food.findMany({
      where,
      include: { aliases: true },
      take: 2_000,
    });
    return rankFoods(candidates, normalized)
      .slice(0, limit)
      .map(({ item }) => item);
  }

  findNutrition(foodId: string, nutritionVersionId: string) {
    return this.prisma.foodNutrition.findUnique({
      where: { foodId_nutritionVersionId: { foodId, nutritionVersionId } },
      include: { nutritionVersion: { include: { source: true } } },
    });
  }
}
