import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app/app.js";
import { loadConfig } from "../src/config/env.js";
import { PrismaBusinessApiService } from "../src/modules/api/api.service.js";
import { importPackagedFoods } from "../src/modules/foods/packaged-food-import.js";
import { normalizeBarcode } from "../src/modules/foods/barcode-normalization.js";
import {
  syntheticGtin,
  syntheticProduct,
} from "./fixtures/packaged-products.js";

dotenv.config();

// A configured database must pass: CI must never hide connection or migration failures as skips.
test(
  "Prisma barcode endpoint, importer, packages, lifecycle and historical nutrition",
  { skip: !process.env.DATABASE_URL && "DATABASE_URL is not configured" },
  async () => {
    const prisma = new PrismaClient();
    const entry = syntheticProduct();
    const variant = syntheticProduct();
    variant.brand = entry.brand;
    variant.variant = "Chocolate";
    const conflict = syntheticProduct();
    conflict.barcodes[0]!.barcode = entry.barcodes[0]!.barcode;
    const concurrentA = syntheticProduct();
    const concurrentB = syntheticProduct();
    concurrentB.barcodes[0]!.barcode = concurrentA.barcodes[0]!.barcode;
    const missing = syntheticProduct();
    missing.nutrition = null;
    const userId = randomUUID();
    const foodIds = [
      entry,
      variant,
      conflict,
      missing,
      concurrentA,
      concurrentB,
    ].map((product) => product.foodId);
    const headers = { "x-development-user-id": userId };
    const service = new PrismaBusinessApiService(prisma);
    const app = await buildApp({
      config: loadConfig({
        NODE_ENV: "development",
        AUTH_DEV_MODE: "true",
        LOG_LEVEL: "silent",
        RATE_LIMIT_ENABLED: "false",
      }),
      businessApiService: service,
    });
    try {
      await prisma.$connect();
      await prisma.user.create({
        data: { id: userId, email: `${userId}@test.local` },
      });
      const unrelated = await prisma.food.create({
        data: {
          canonicalName: `unrelated-${userId}`,
          nameVi: "Existing unrelated food",
        },
      });
      foodIds.push(unrelated.id);
      const secondBarcode = syntheticGtin();
      entry.barcodes.push({
        ...entry.barcodes[0]!,
        barcode: secondBarcode,
        package: { quantity: 250, unit: "ml" },
      });
      const multipack = syntheticGtin();
      entry.barcodes.push({
        ...entry.barcodes[0]!,
        barcode: multipack,
        package: { quantity: 3000, unit: "ml" },
        unitsPerPack: 6,
      });
      const reports = await Promise.all([
        importPackagedFoods(prisma, [entry]),
        importPackagedFoods(prisma, [entry]),
      ]);
      assert.equal(
        reports.reduce((sum, report) => sum + report.inserted, 0),
        1,
      );
      assert.equal(
        reports.reduce((sum, report) => sum + report.skipped, 0),
        1,
      );
      assert.equal(
        reports.reduce((sum, report) => sum + report.rejected, 0),
        0,
      );
      assert.equal(
        (await importPackagedFoods(prisma, [variant, missing])).inserted,
        2,
      );
      assert.equal((await importPackagedFoods(prisma, [entry])).skipped, 1);
      const competing = await Promise.all([
        importPackagedFoods(prisma, [concurrentA]),
        importPackagedFoods(prisma, [concurrentB]),
      ]);
      assert.equal(
        competing.reduce((sum, report) => sum + report.inserted, 0),
        1,
      );
      assert.equal(
        competing.reduce((sum, report) => sum + report.rejected, 0),
        1,
      );
      assert.equal(
        await prisma.foodBarcode.count({ where: { foodId: entry.foodId } }),
        3,
      );
      assert.equal((await importPackagedFoods(prisma, [conflict])).rejected, 1);
      assert.equal(
        await prisma.food.findUnique({ where: { id: conflict.foodId } }),
        null,
      );
      const identityConflict = { ...entry, brand: "Different brand" };
      assert.equal(
        (await importPackagedFoods(prisma, [identityConflict])).rejected,
        1,
      );
      const aliasConflict = {
        ...conflict,
        barcodes: [{ ...conflict.barcodes[0]!, barcode: syntheticGtin() }],
        aliases: [...entry.aliases],
      };
      assert.equal(
        (await importPackagedFoods(prisma, [aliasConflict])).rejected,
        1,
      );
      assert.equal(
        await prisma.food.findUnique({ where: { id: conflict.foodId } }),
        null,
      );
      assert.deepEqual(
        await prisma.food.findUnique({ where: { id: unrelated.id } }),
        unrelated,
      );

      const scan = async (barcode: string) => {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/barcode/scan",
          headers,
          payload: { barcode },
        });
        assert.equal(response.statusCode, 200, response.body);
        return response.json().data;
      };
      const known = await scan(entry.barcodes[0]!.barcode);
      assert.equal(known.foodId, entry.foodId);
      assert.equal(known.product.foodId, entry.foodId);
      assert.equal(known.product.nutritionAvailability, "PARTIAL");
      assert.equal(known.product.nutrition.referenceBasis, "PER_100_ML");
      assert.equal(known.product.nutrition.carbohydrates, null);
      assert.equal(known.product.nutrition.sodium, 100);
      assert.equal(known.product.package.quantity, 500);
      assert.equal(known.product.labeledServing.quantity, 200);
      assert.equal(
        (await scan(normalizeBarcode(secondBarcode))).product.package.quantity,
        250,
      );
      assert.equal((await scan(multipack)).product.package.unitsPerPack, 6);
      assert.equal((await scan(multipack)).product.package.quantity, 3000);
      assert.equal(
        (await scan(variant.barcodes[0]!.barcode)).foodId,
        variant.foodId,
      );
      assert.equal(
        (await scan(missing.barcodes[0]!.barcode)).product
          .nutritionAvailability,
        "UNAVAILABLE",
      );
      assert.equal((await scan(syntheticGtin())).product, null);
      assert.equal(await prisma.meal.count({ where: { userId } }), 0);
      const retrieved = await app.inject({
        method: "GET",
        url: `/api/v1/foods/${entry.foodId}`,
      });
      assert.equal(retrieved.statusCode, 200);
      assert.equal(retrieved.json().data.nutrition.fat, null);
      const search = await app.inject({
        method: "GET",
        url: `/api/v1/foods/search?q=${encodeURIComponent(entry.aliases[0]!)}&foodType=PACKAGED_FOOD&category=BEVERAGE`,
      });
      assert.equal(search.statusCode, 200);
      assert.equal(search.json().data[0].id, entry.foodId);

      const item = { foodId: entry.foodId, quantity: 200, unit: "ml" };
      const beforeCount = await prisma.meal.count({ where: { userId } });
      await assert.rejects(
        service.createMeal(userId, {
          mealType: "OTHER",
          capturedAt: new Date(),
          items: [{ ...item, unit: "g" }],
        }),
        { code: "VALIDATION_ERROR" },
      );
      assert.equal(await prisma.meal.count({ where: { userId } }), beforeCount);
      const meal = await service.createMeal(userId, {
        mealType: "OTHER",
        capturedAt: new Date(),
        items: [item],
      });
      assert.equal(meal.items[0]!.nutrition!.calories, 200);
      assert.equal(meal.items[0]!.nutrition!.fiber, null);
      assert.equal(meal.totals.fiber, null);
      const snapshot = await prisma.mealItemNutrition.findUniqueOrThrow({
        where: { mealItemId: meal.items[0]!.id },
      });
      const analysis = await service.createAnalysis(userId, {
        inputType: "TEXT",
        inputReference: "test",
      });
      await prisma.aIAnalysis.update({
        where: { id: analysis.analysisId },
        data: { status: "COMPLETED" },
      });
      await assert.rejects(
        service.confirmAnalysis(userId, analysis.analysisId, [
          { ...item, unit: "serving" },
        ]),
        { code: "VALIDATION_ERROR" },
      );
      const confirmed = await service.confirmAnalysis(
        userId,
        analysis.analysisId,
        [item],
      );
      assert.equal(confirmed.items[0]!.nutrition!.fiber, null);
      const changed = structuredClone(entry);
      changed.source.version = "B";
      changed.source.reviewedAt = "2021-01-01T00:00:00.000Z";
      changed.nutrition!.values.calories = 836.8;
      assert.equal((await importPackagedFoods(prisma, [changed])).updated, 1);
      assert.equal(
        (await scan(entry.barcodes[0]!.barcode)).product.nutrition.calories,
        200,
      );
      assert.deepEqual(
        await prisma.mealItemNutrition.findUniqueOrThrow({
          where: { mealItemId: meal.items[0]!.id },
        }),
        snapshot,
      );
      assert.deepEqual(await service.getMeal(userId, meal.id), meal);
      assert.deepEqual(
        await service.confirmAnalysis(userId, analysis.analysisId, [
          { ...item, quantity: 999 },
        ]),
        confirmed,
      );
      const sourceId = (
        await prisma.packagedProduct.findUniqueOrThrow({
          where: { foodId: entry.foodId },
        })
      ).sourceId;
      assert.equal(
        await prisma.nutritionVersion.count({ where: { sourceId } }),
        2,
      );
      assert.equal(
        await prisma.foodNutrition.count({ where: { foodId: entry.foodId } }),
        2,
      );
      const sameVersionChange = structuredClone(changed);
      assert.equal((await importPackagedFoods(prisma, [entry])).rejected, 1);
      sameVersionChange.nutrition!.values.protein = 999;
      assert.equal(
        (await importPackagedFoods(prisma, [sameVersionChange])).rejected,
        1,
      );
      assert.equal(
        (await scan(entry.barcodes[0]!.barcode)).product.nutrition.protein,
        3,
      );
      const withdrawn = structuredClone(changed);
      withdrawn.source.version = "C";
      withdrawn.nutrition = null;
      assert.equal((await importPackagedFoods(prisma, [withdrawn])).updated, 1);
      assert.equal(
        (await scan(entry.barcodes[0]!.barcode)).product.nutrition,
        null,
      );
      assert.equal(
        (await service.getFood(userId, entry.foodId)).nutrition,
        undefined,
      );
      assert.deepEqual(await service.getMeal(userId, meal.id), meal);

      for (const status of ["INACTIVE", "DEPRECATED"]) {
        await prisma.foodBarcode.update({
          where: { normalizedBarcode: known.normalizedBarcode },
          data: { status },
        });
        assert.equal(
          (await scan(entry.barcodes[0]!.barcode)).status,
          "UNRESOLVED",
        );
      }
      await prisma.foodBarcode.update({
        where: { normalizedBarcode: known.normalizedBarcode },
        data: { status: "ACTIVE" },
      });
      await prisma.packagedProduct.update({
        where: { foodId: entry.foodId },
        data: { status: "INACTIVE" },
      });
      assert.equal((await scan(secondBarcode)).status, "UNRESOLVED");
      assert.equal(
        (
          await service.searchFoods({
            query: entry.aliases[0]!,
            locale: "vi",
            page: 1,
            pageSize: 20,
          })
        ).data.some((food) => food.id === entry.foodId),
        false,
      );
      await assert.rejects(
        service.createMeal(userId, {
          mealType: "OTHER",
          capturedAt: new Date(),
          items: [item],
        }),
        { code: "FOOD_NOT_FOUND" },
      );
      await prisma.packagedProduct.update({
        where: { foodId: entry.foodId },
        data: { status: "ACTIVE" },
      });
      await prisma.food.update({
        where: { id: entry.foodId },
        data: { isActive: false },
      });
      assert.equal((await scan(secondBarcode)).status, "UNRESOLVED");
      await prisma.food.update({
        where: { id: entry.foodId },
        data: { isActive: true, status: "DEPRECATED" },
      });
      assert.equal((await scan(secondBarcode)).status, "UNRESOLVED");

      const mapping = {
        foodId: entry.foodId,
        barcode: "036000291452",
        normalizedBarcode: "00036000291452",
        sourceUrl: "https://example.com/test-only",
      };
      await assert.rejects(
        prisma.foodBarcode.create({
          data: { ...mapping, packageUnit: "ml", packageQuantity: null },
        }),
      );
      await assert.rejects(
        prisma.foodBarcode.create({
          data: {
            ...mapping,
            barcode: "036000291453",
            normalizedBarcode: "00036000291453",
          },
        }),
      );
      await assert.rejects(
        prisma.foodBarcode.create({
          data: { ...mapping, foodId: randomUUID() },
        }),
      );
      await assert.rejects(
        prisma.foodBarcode.create({
          data: {
            ...mapping,
            normalizedBarcode: known.normalizedBarcode,
            barcode: known.barcode,
          },
        }),
      );
    } finally {
      await app.close();
      await prisma.user.deleteMany({ where: { id: userId } });
      const products = await prisma.packagedProduct.findMany({
        where: { foodId: { in: foodIds } },
        select: { sourceId: true },
      });
      const sources = products.map((product) => product.sourceId);
      await prisma.foodBarcode.deleteMany({
        where: { foodId: { in: foodIds } },
      });
      await prisma.packagedProduct.deleteMany({
        where: { foodId: { in: foodIds } },
      });
      await prisma.foodAlias.deleteMany({ where: { foodId: { in: foodIds } } });
      await prisma.foodNutrition.deleteMany({
        where: { foodId: { in: foodIds } },
      });
      await prisma.food.deleteMany({ where: { id: { in: foodIds } } });
      await prisma.nutritionVersion.deleteMany({
        where: { sourceId: { in: sources } },
      });
      await prisma.foodSource.deleteMany({ where: { id: { in: sources } } });
      await prisma.$disconnect();
    }
  },
);
