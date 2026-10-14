import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app/app.js";
import { loadConfig } from "../src/config/env.js";
import {
  InMemoryBusinessApiService,
  PrismaBusinessApiService,
} from "../src/modules/api/api.service.js";
import {
  gtinSchema,
  normalizeBarcode,
} from "../src/modules/foods/barcode-normalization.js";
import {
  BarcodeService,
  InMemoryBarcodeProvider,
  PrismaBarcodeProvider,
} from "../src/modules/foods/barcode.service.js";
import {
  memoryCatalogProducts,
  packagedFoodCatalog,
  catalogNutritionRecord,
} from "../src/modules/foods/packaged-food-catalog.js";
import {
  normalizedProductNutrition,
  validatePackagedFoods,
} from "../src/modules/foods/packaged-food-import.js";
import {
  scaledNutrition,
  latestNutrition,
  type NutritionRecordLike,
} from "../src/modules/nutrition/nutrition-record.js";
import { syntheticProduct } from "./fixtures/packaged-products.js";

test("GTIN formats validate check digits and preserve zero-padded equivalence", () => {
  for (const barcode of [
    "96385074",
    "036000291452",
    "4006381333931",
    "10012345000017",
  ])
    assert.equal(gtinSchema.parse(barcode), barcode);
  assert.equal(normalizeBarcode(" 036000291452 "), "00036000291452");
  assert.equal(
    normalizeBarcode("0036000291452"),
    normalizeBarcode("00036000291452"),
  );
  assert.equal(normalizeBarcode("96385074"), normalizeBarcode("0000096385074"));
  assert.notEqual(
    normalizeBarcode("10012345000017"),
    normalizeBarcode("012345678905"),
  );
});

test("GTIN rejects malformed, oversized and non-string identifiers", () => {
  for (const input of [
    "",
    " ",
    "1234567",
    "123456789",
    "12345678901",
    "123456789012345",
    "036000291453",
    "4006381333932",
    "96385075",
    "10012345000018",
    "036000-291452",
    "]E0036000291452",
    "０３６０００２９１４５２",
    "03600029145x",
    "0".repeat(65),
    " ".repeat(65) + "036000291452",
    36000291452,
    null,
  ])
    assert.equal(gtinSchema.safeParse(input).success, false, String(input));
});

test("reviewed catalog validates and exact lookup remains independent of fuzzy names", async () => {
  assert.equal(validatePackagedFoods(packagedFoodCatalog).report.rejected, 0);
  const products = memoryCatalogProducts();
  const service = new BarcodeService(new InMemoryBarcodeProvider(products));
  const known = await service.scan(products[0]!.barcode);
  assert.equal(known.status, "RESOLVED");
  assert.equal(known.foodId, packagedFoodCatalog[0]!.foodId);
  assert.equal(known.product?.nutritionAvailability, "UNAVAILABLE");
  assert.equal(known.product?.nutrition, null);
  assert.equal((await service.scan("036000291452")).product, null);
  assert.throws(
    () =>
      new InMemoryBarcodeProvider([
        products[0]!,
        { ...products[0]!, barcode: normalizeBarcode(products[0]!.barcode) },
      ]),
    /Duplicate/,
  );
  await assert.rejects(service.scan("invalid"), { code: "VALIDATION_ERROR" });
});

test("import validation rejects conflicting identities, bad quantities, salt and invalid nutrition", () => {
  const product = syntheticProduct();
  const duplicate = syntheticProduct();
  duplicate.barcodes[0]!.barcode = normalizeBarcode(
    product.barcodes[0]!.barcode,
  );
  assert.equal(validatePackagedFoods([product, duplicate]).report.rejected, 2);
  const mutations = [
    { ...product, barcodes: [{ ...product.barcodes[0], unitsPerPack: 0 }] },
    {
      ...product,
      barcodes: [
        { ...product.barcodes[0], package: { quantity: -1, unit: "g" } },
      ],
    },
    {
      ...product,
      nutrition: { ...product.nutrition, values: { protein: -1 } },
    },
    {
      ...product,
      nutrition: { ...product.nutrition, values: { calories: Infinity } },
    },
    { ...product, nutrition: { ...product.nutrition, values: { salt: 1 } } },
    {
      ...product,
      nutrition: { ...product.nutrition, units: { sodium: "ml" } },
    },
    { ...product, nutrition: { ...product.nutrition, values: {} } },
  ];
  assert.equal(
    validatePackagedFoods(mutations).report.rejected,
    mutations.length,
  );
});

test("nutrition reference bases, energy and sodium conversions preserve unknown values", () => {
  const product = syntheticProduct();
  const nutrition = normalizedProductNutrition(product, "test-source")!;
  const memoryRecord = catalogNutritionRecord(product)!;
  assert.ok(
    Math.abs(scaledNutrition(memoryRecord, 200, "ml").calories! - 200) < 1e-10,
  );
  assert.equal(scaledNutrition(memoryRecord, 200, "ml").fat, null);
  assert.ok(Math.abs(nutrition.calories! - 100) < 1e-10);
  assert.equal(nutrition.sodium, 100);
  assert.equal(nutrition.carbohydrates, null);
  assert.equal(nutrition.referenceBasis, "PER_100_ML");
  product.nutrition!.reference.unit = "g";
  assert.equal(
    normalizedProductNutrition(product, "test-source")!.referenceBasis,
    "PER_100_G",
  );
  product.nutrition!.reference = { quantity: 1, unit: "serving" };
  assert.equal(
    normalizedProductNutrition(product, "test-source")!.referenceBasis,
    "PER_SERVING",
  );
});

const record: NutritionRecordLike = {
  nutritionVersionId: "A",
  servingAmount: 100,
  servingUnit: "ml",
  referenceBasis: "PER_100_ML",
  preparation: "AS_SOLD",
  mappingType: "EXACT_MATCH",
  calories: 100,
  protein: 3,
  carbohydrates: null,
  fat: null,
  fiber: null,
  sugar: null,
  sodium: 100,
  nutritionVersion: {
    sourceId: "test",
    version: "A",
    effectiveFrom: new Date(0),
    effectiveTo: null,
    source: { name: "Test", provider: "test", sourceUrl: null, license: null },
  },
};
test("scaling rejects incompatible serving units and prepared nutrition", () => {
  assert.equal(scaledNutrition(record, 200, "MILLILITER").calories, 200);
  assert.equal(scaledNutrition(record, 0.2, "l").calories, 200);
  assert.equal(scaledNutrition(record, 200, "ml").fat, null);
  assert.equal(
    scaledNutrition(
      { ...record, servingUnit: "g", referenceBasis: "PER_100_G" },
      0.2,
      "kg",
    ).calories,
    200,
  );
  assert.equal(
    scaledNutrition(
      {
        ...record,
        servingAmount: 1,
        servingUnit: "bowl",
        referenceBasis: "PER_SERVING",
      },
      2,
      "bowl",
    ).calories,
    200,
  );
  for (const quantity of [0, -1, NaN, Infinity])
    assert.throws(() => scaledNutrition(record, quantity, "ml"), {
      code: "VALIDATION_ERROR",
    });
  assert.throws(
    () =>
      scaledNutrition(
        { ...record, calories: null, protein: null, sodium: null },
        100,
        "ml",
      ),
    { code: "NUTRITION_DATA_UNAVAILABLE" },
  );
  for (const unit of ["g", "serving", "bottle", "piece"])
    assert.throws(() => scaledNutrition(record, 1, unit), {
      code: "VALIDATION_ERROR",
    });
  assert.throws(
    () => scaledNutrition({ ...record, preparation: "AS_PREPARED" }, 100, "ml"),
    { code: "NUTRITION_DATA_UNAVAILABLE" },
  );
  assert.equal(latestNutrition([record], null), undefined);
  assert.equal(
    latestNutrition([
      {
        ...record,
        nutritionVersion: {
          ...record.nutritionVersion,
          effectiveFrom: new Date("2099-01-01"),
        },
      },
    ]),
    undefined,
  );
  assert.equal(
    latestNutrition([
      {
        ...record,
        nutritionVersion: {
          ...record.nutritionVersion,
          effectiveTo: new Date(1),
        },
      },
    ]),
    undefined,
  );
});

test("barcode API keeps authentication, envelope, identity, nulls and search contracts", async () => {
  const config = loadConfig({
    NODE_ENV: "development",
    AUTH_DEV_MODE: "true",
    LOG_LEVEL: "silent",
    RATE_LIMIT_ENABLED: "false",
  });
  const app = await buildApp({ config });
  const headers = { "x-development-user-id": "test" };
  const barcode = packagedFoodCatalog[0]!.barcodes[0]!.barcode;
  try {
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/barcode/scan",
          payload: { barcode },
        })
      ).statusCode,
      401,
    );
    for (const value of ["invalid", "036000291453", "", "0".repeat(65)]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/barcode/scan",
        headers,
        payload: { barcode: value },
      });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
    }
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/barcode/scan",
      headers,
      payload: { barcode: ` ${barcode} ` },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().success, true);
    assert.equal(response.json().data.barcode, barcode);
    assert.equal(response.json().data.status, "RESOLVED");
    assert.equal(
      response.json().data.product.foodId,
      packagedFoodCatalog[0]!.foodId,
    );
    assert.equal(response.json().data.product.package.quantity, 1000);
    assert.equal(response.json().data.product.nutrition, null);
    assert.ok(response.json().data.source.reference);
    assert.equal(
      (
        await app.inject({ method: "GET", url: "/api/v1/meals", headers })
      ).json().meta.total,
      0,
    );
    const unknown = await app.inject({
      method: "POST",
      url: "/api/v1/barcode/scan",
      headers,
      payload: { barcode: "036000291452" },
    });
    assert.equal(unknown.statusCode, 200);
    assert.equal(unknown.json().data.product, null);
    assert.equal(unknown.json().data.source, null);
    const search = await app.inject({
      method: "GET",
      url: "/api/v1/foods/search?q=Vinamilk&foodType=PACKAGED_FOOD&category=BEVERAGE",
    });
    assert.equal(search.json().data[0].id, packagedFoodCatalog[0]!.foodId);
    const service = new InMemoryBusinessApiService();
    await assert.rejects(
      service.createMeal("test", {
        mealType: "OTHER",
        capturedAt: new Date(),
        items: [
          { foodId: packagedFoodCatalog[0]!.foodId, quantity: 100, unit: "ml" },
        ],
      }),
      { code: "NUTRITION_DATA_UNAVAILABLE" },
    );
  } finally {
    await app.close();
  }
});

test("database and provider failures produce safe dependency errors", async () => {
  const prisma = {
    foodBarcode: {
      findUnique: async () => {
        throw new Error("secret connection string");
      },
    },
  } as unknown as PrismaClient;
  const app = await buildApp({
    config: loadConfig({
      NODE_ENV: "development",
      AUTH_DEV_MODE: "true",
      LOG_LEVEL: "silent",
    }),
    businessApiService: new PrismaBusinessApiService(prisma),
  });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/barcode/scan",
      headers: { "x-development-user-id": "test" },
      payload: { barcode: "036000291452" },
    });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error.code, "DATABASE_ERROR");
    assert.equal(response.body.includes("secret"), false);
    await assert.rejects(
      new BarcodeService({
        lookup: async () => {
          throw new Error("secret provider");
        },
      }).scan("036000291452"),
      { code: "EXTERNAL_SERVICE_ERROR" },
    );
    await assert.rejects(
      new BarcodeService(new PrismaBarcodeProvider(prisma)).scan("invalid"),
      { code: "VALIDATION_ERROR" },
    );
  } finally {
    await app.close();
  }
});
