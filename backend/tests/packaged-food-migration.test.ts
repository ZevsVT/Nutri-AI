import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();
const migrationName = "20261014090000_add_packaged_food_barcodes";
const run = promisify(execFile);

test(
  "packaged-food migration works on clean and populated isolated PostgreSQL schemas",
  { skip: !process.env.DATABASE_URL && "DATABASE_URL is not configured" },
  async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "nutri-packaged-migration-"),
    );
    assert.ok(
      directory.startsWith(join(tmpdir(), "nutri-packaged-migration-")),
    );
    const schemaPath = join(directory, "schema.prisma");
    await writeFile(
      schemaPath,
      await readFile(resolve("prisma/schema.prisma")),
    );
    const migrate = async (url: string) => {
      await run(
        process.execPath,
        [
          resolve("node_modules/prisma/build/index.js"),
          "migrate",
          "deploy",
          "--schema",
          schemaPath,
        ],
        {
          env: { ...process.env, DATABASE_URL: url },
          timeout: 60_000,
        },
      );
    };
    const schemas: string[] = [];
    const admin = new PrismaClient();
    try {
      // Apply all migrations to a fresh schema.
      const cleanUrl = new URL(process.env.DATABASE_URL!);
      const cleanSchema =
        "nutri_packaged_migration_" + randomUUID().replaceAll("-", "");
      schemas.push(cleanSchema);
      cleanUrl.searchParams.set("schema", cleanSchema);
      await cp(resolve("prisma/migrations"), join(directory, "migrations"), {
        recursive: true,
      });
      await migrate(cleanUrl.toString());
      const clean = new PrismaClient({
        datasources: { db: { url: cleanUrl.toString() } },
      });
      try {
        assert.equal(await clean.foodBarcode.count(), 0);
        assert.equal(await clean.packagedProduct.count(), 0);
      } finally {
        await clean.$disconnect();
      }

      // Build the pre-issue schema, insert representative existing records, then upgrade it.
      await rm(join(directory, "migrations"), { recursive: true });
      const populatedUrl = new URL(process.env.DATABASE_URL!);
      const populatedSchema =
        "nutri_packaged_migration_" + randomUUID().replaceAll("-", "");
      schemas.push(populatedSchema);
      populatedUrl.searchParams.set("schema", populatedSchema);
      for (const name of await readdir(resolve("prisma/migrations")))
        if (name !== migrationName)
          await cp(
            resolve("prisma/migrations", name),
            join(directory, "migrations", name),
            { recursive: true },
          );
      await migrate(populatedUrl.toString());
      const client = new PrismaClient({
        datasources: { db: { url: populatedUrl.toString() } },
      });
      try {
        const foodId = randomUUID(),
          sourceId = randomUUID(),
          versionId = randomUUID(),
          userId = randomUUID();
        await client.food.create({
          data: {
            id: foodId,
            canonicalName: "existing-food",
            slug: "existing-slug",
            nameVi: "Existing food",
            foodType: "INGREDIENT",
            category: "STAPLE",
          },
          select: { id: true },
        });
        await client.foodAlias.create({
          data: {
            foodId,
            alias: "Original alias",
            normalizedAlias: "original alias",
          },
        });
        await client.foodSource.create({
          data: {
            id: sourceId,
            provider: "migration-test",
            name: "Existing source",
            sourceType: "CURATED",
          },
        });
        await client.nutritionVersion.create({
          data: {
            id: versionId,
            sourceId,
            version: "old",
            effectiveFrom: new Date(0),
          },
          select: { id: true },
        });
        await client.$executeRaw`INSERT INTO "FoodNutrition"
        ("id", "foodId", "nutritionVersionId", "servingAmount", "servingUnit", "referenceBasis", "calories", "protein", "carbohydrates", "updatedAt")
        VALUES (${randomUUID()}::uuid, ${foodId}::uuid, ${versionId}::uuid, 100, 'g', 'PER_100_G', 200, 10, NULL, CURRENT_TIMESTAMP)`;
        await client.user.create({
          data: { id: userId, email: `${userId}@test.local` },
        });
        const meal = await client.meal.create({
          data: {
            userId,
            capturedAt: new Date(0),
            mealType: "OTHER",
            status: "CONFIRMED",
            confirmedAt: new Date(0),
          },
        });
        const item = await client.mealItem.create({
          data: {
            mealId: meal.id,
            foodId,
            quantity: 100,
            unit: "g",
            displayName: "Existing snapshot",
          },
        });
        await client.mealItemNutrition.create({
          data: {
            mealItemId: item.id,
            sourceId,
            nutritionVersionId: versionId,
            servingAmount: 100,
            servingUnit: "g",
            calories: 200,
            protein: 10,
            carbohydrates: 20,
            fat: 4,
            fiber: 2,
            sugar: 3,
            sodium: 100,
          },
        });
        const beforeFood = await client.food.findUniqueOrThrow({
          where: { id: foodId },
        });
        const beforeAlias = await client.foodAlias.findMany({
          where: { foodId },
        });
        const beforeNutrition = await client.foodNutrition.findMany({
          where: { foodId },
          select: {
            id: true,
            foodId: true,
            nutritionVersionId: true,
            calories: true,
            protein: true,
            carbohydrates: true,
            servingAmount: true,
            servingUnit: true,
            referenceBasis: true,
          },
        });
        const beforeSnapshot = await client.mealItemNutrition.findUniqueOrThrow(
          { where: { mealItemId: item.id } },
        );
        await cp(
          resolve("prisma/migrations", migrationName),
          join(directory, "migrations", migrationName),
          { recursive: true },
        );
        await migrate(populatedUrl.toString());
        assert.deepEqual(
          await client.food.findUniqueOrThrow({ where: { id: foodId } }),
          beforeFood,
        );
        assert.deepEqual(
          await client.foodAlias.findMany({ where: { foodId } }),
          beforeAlias,
        );
        assert.deepEqual(
          await client.foodNutrition.findMany({
            where: { foodId },
            select: {
              id: true,
              foodId: true,
              nutritionVersionId: true,
              calories: true,
              protein: true,
              carbohydrates: true,
              servingAmount: true,
              servingUnit: true,
              referenceBasis: true,
            },
          }),
          beforeNutrition,
        );
        assert.deepEqual(
          await client.mealItemNutrition.findUniqueOrThrow({
            where: { mealItemId: item.id },
          }),
          beforeSnapshot,
        );
        assert.equal(await client.foodBarcode.count(), 0);
        assert.equal(await client.packagedProduct.count(), 0);
      } finally {
        await client.$disconnect();
      }
    } finally {
      for (const schema of schemas) {
        assert.match(schema, /^nutri_packaged_migration_[0-9a-f]{32}$/);
        await admin.$executeRawUnsafe(
          `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
        );
      }
      await admin.$disconnect();
      assert.ok(
        directory.startsWith(join(tmpdir(), "nutri-packaged-migration-")),
      );
      await rm(directory, { recursive: true, force: true });
    }
  },
);
