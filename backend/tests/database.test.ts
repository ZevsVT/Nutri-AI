import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  createPrismaClient,
  PrismaDatabase,
} from "../src/integrations/database/prisma-database.js";
import { MealRepository } from "../src/modules/meals/meal.repository.js";

dotenv.config();

function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || undefined;
}

async function connectOrSkip(
  context: TestContext,
): Promise<PrismaClient | null> {
  const url = databaseUrl();
  if (!url) {
    context.skip("DATABASE_URL is not configured");
    return null;
  }

  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    await client.$connect();
    await client.$queryRaw`SELECT 1`;
  } catch {
    await client.$disconnect();
    context.skip("PostgreSQL is not reachable; start the local database first");
    return null;
  }

  try {
    const tableCheck = await client.$queryRaw<
      Array<{ tableName: string | null }>
    >`SELECT table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'User'`;
    if (!tableCheck[0]?.tableName) {
      await client.$disconnect();
      context.skip(
        "PostgreSQL is reachable but Prisma migrations are not applied",
      );
      return null;
    }
    return client;
  } catch {
    await client.$disconnect();
    context.skip("PostgreSQL is not reachable; start the local database first");
    return null;
  }
}

test("Prisma database factory creates one shared client without connecting per request", async () => {
  const client = createPrismaClient(
    "postgresql://test:test@localhost:5433/nutri_ai",
    { reuseGlobal: false },
  );
  const database = new PrismaDatabase(client);
  assert.equal(database.client, client);
  await database.close();
});

test("historical meal nutrition remains stable after a newer food nutrition version", async (context) => {
  const prisma = await connectOrSkip(context);
  if (!prisma) return;

  const userId = randomUUID();
  const foodId = randomUUID();
  const sourceId = randomUUID();
  const versionAId = randomUUID();
  const versionBId = randomUUID();
  const mealId = randomUUID();
  const mealItemId = randomUUID();

  try {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@test.local` },
    });
    await prisma.foodSource.create({
      data: {
        id: sourceId,
        name: `Test source ${sourceId}`,
        provider: "test",
        sourceType: "CURATED",
      },
    });
    await prisma.food.create({
      data: {
        id: foodId,
        canonicalName: `test-food-${foodId}`,
        nameVi: "Món thử nghiệm",
        cuisine: "Vietnamese",
      },
    });
    await prisma.nutritionVersion.create({
      data: {
        id: versionAId,
        sourceId,
        version: "A",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.foodNutrition.create({
      data: {
        foodId,
        nutritionVersionId: versionAId,
        servingAmount: 1,
        servingUnit: "bowl",
        calories: 560,
        protein: 28,
        carbohydrates: 52,
        fat: 14,
        fiber: 5,
        sugar: 4,
        sodium: 1100,
      },
    });
    await prisma.meal.create({
      data: {
        id: mealId,
        userId,
        mealType: "LUNCH",
        capturedAt: new Date("2026-08-22T05:40:00.000Z"),
        confirmedAt: new Date("2026-08-22T05:45:00.000Z"),
        status: "CONFIRMED",
      },
    });
    await prisma.mealItem.create({
      data: {
        id: mealItemId,
        mealId,
        foodId,
        quantity: 1,
        unit: "bowl",
        displayName: "Món thử nghiệm",
      },
    });
    await prisma.mealItemNutrition.create({
      data: {
        mealItemId,
        nutritionVersionId: versionAId,
        sourceId,
        servingAmount: 1,
        servingUnit: "bowl",
        calories: 560,
        protein: 28,
        carbohydrates: 52,
        fat: 14,
        fiber: 5,
        sugar: 4,
        sodium: 1100,
        estimated: true,
      },
    });

    const before = await prisma.mealItemNutrition.findUniqueOrThrow({
      where: { mealItemId },
    });

    await prisma.nutritionVersion.create({
      data: {
        id: versionBId,
        sourceId,
        version: "B",
        effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
      },
    });
    await prisma.foodNutrition.create({
      data: {
        foodId,
        nutritionVersionId: versionBId,
        servingAmount: 1,
        servingUnit: "bowl",
        calories: 700,
        protein: 30,
        carbohydrates: 55,
        fat: 24,
        fiber: 5,
        sugar: 4,
        sodium: 1250,
      },
    });

    const after = await prisma.mealItemNutrition.findUniqueOrThrow({
      where: { mealItemId },
    });
    assert.equal(after.calories.toString(), before.calories.toString());
    assert.equal(after.nutritionVersionId, versionAId);
    assert.notEqual(
      (
        await prisma.foodNutrition.findUniqueOrThrow({
          where: {
            foodId_nutritionVersionId: {
              foodId,
              nutritionVersionId: versionBId,
            },
          },
        })
      ).calories?.toString(),
      after.calories.toString(),
    );
  } finally {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.foodNutrition.deleteMany({ where: { foodId } });
    await prisma.food.delete({ where: { id: foodId } });
    await prisma.nutritionVersion.deleteMany({ where: { sourceId } });
    await prisma.foodSource.delete({ where: { id: sourceId } });
    await prisma.$disconnect();
  }
});

test("AI corrections persist and meal repositories enforce user scoping", async (context) => {
  const prisma = await connectOrSkip(context);
  if (!prisma) return;

  const userId = randomUUID();
  const otherUserId = randomUUID();
  const mealId = randomUUID();
  const analysisId = randomUUID();
  try {
    await prisma.user.createMany({
      data: [
        { id: userId, email: `${userId}@test.local` },
        { id: otherUserId, email: `${otherUserId}@test.local` },
      ],
    });
    await prisma.meal.create({
      data: {
        id: mealId,
        userId,
        mealType: "DINNER",
        capturedAt: new Date("2026-08-22T11:40:00.000Z"),
      },
    });
    await prisma.aIAnalysis.create({
      data: {
        id: analysisId,
        userId,
        mealId,
        provider: "test",
        model: "test-model",
        inputType: "TEXT",
        status: "COMPLETED",
      },
    });
    const prediction = await prisma.aIFoodPrediction.create({
      data: {
        analysisId,
        predictedName: "Phở bò chín",
        confidence: 0.7,
        estimatedQuantity: 1,
        estimatedUnit: "bowl",
      },
    });
    const correction = await prisma.aICorrection.create({
      data: {
        analysisId,
        predictionId: prediction.id,
        userId,
        correctionType: "NAME_CORRECTED",
        originalQuantity: 1,
        correctedQuantity: 1,
        originalUnit: "bowl",
        correctedUnit: "bowl",
      },
    });
    assert.equal(correction.userId, userId);
    assert.equal(
      await new MealRepository(prisma).findByIdForUser(mealId, otherUserId),
      null,
    );
    assert.equal(
      (await new MealRepository(prisma).findByIdForUser(mealId, userId))?.id,
      mealId,
    );
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: [userId, otherUserId] } },
    });
    await prisma.$disconnect();
  }
});

test("database constraints reject duplicate identity and invalid nutrition values", async (context) => {
  const prisma = await connectOrSkip(context);
  if (!prisma) return;

  const userId = randomUUID();
  const sourceId = randomUUID();
  const versionId = randomUUID();
  const foodId = randomUUID();
  const email = `${userId}@test.local`;
  try {
    await prisma.user.create({ data: { id: userId, email } });
    await assert.rejects(prisma.user.create({ data: { email } }));
    await assert.rejects(
      prisma.meal.create({
        data: {
          userId: randomUUID(),
          mealType: "OTHER",
          capturedAt: new Date(),
        },
      }),
    );
    await prisma.foodSource.create({
      data: {
        id: sourceId,
        name: `Constraint source ${sourceId}`,
        provider: "test",
        sourceType: "CURATED",
      },
    });
    await prisma.nutritionVersion.create({
      data: {
        id: versionId,
        sourceId,
        version: "constraint-test",
        effectiveFrom: new Date(),
      },
    });
    await prisma.food.create({
      data: {
        id: foodId,
        canonicalName: `constraint-food-${foodId}`,
        nameVi: "Món kiểm tra ràng buộc",
      },
    });
    await assert.rejects(
      prisma.foodNutrition.create({
        data: {
          foodId,
          nutritionVersionId: versionId,
          servingAmount: 1,
          servingUnit: "serving",
          calories: -1,
          protein: 0,
          carbohydrates: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          sodium: 0,
        },
      }),
    );
  } finally {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.foodNutrition.deleteMany({ where: { foodId } });
    await prisma.food.delete({ where: { id: foodId } });
    await prisma.nutritionVersion.delete({ where: { id: versionId } });
    await prisma.foodSource.delete({ where: { id: sourceId } });
    await prisma.$disconnect();
  }
});
