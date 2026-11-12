import assert from "node:assert/strict";
import { test } from "node:test";
import { estimatePortion } from "../src/modules/meals/portion-estimation.js";
import {
  scaledNutrition,
  type NutritionRecordLike,
} from "../src/modules/nutrition/nutrition-record.js";
import {
  convertUnit,
  energyToKcal,
  normalizeNutrition,
  scaleNutrition,
} from "../src/modules/nutrition/nutrition-normalization.js";

test("canonical unit and energy conversions are deterministic", () => {
  assert.equal(convertUnit(1000, "mg", "g"), 1);
  assert.equal(convertUnit(1, "g", "mg"), 1000);
  assert.equal(energyToKcal(4.184, "kJ"), 1);
});

test("serving scaling preserves nulls and does not round intermediates", () => {
  assert.deepEqual(
    scaleNutrition(
      {
        calories: 100,
        protein: 20,
        carbohydrates: null,
        fat: 1.25,
        fiber: 0,
        sugar: 2,
        sodium: 100,
      },
      250,
      100,
    ),
    {
      calories: 250,
      protein: 50,
      carbohydrates: null,
      fat: 3.125,
      fiber: 0,
      sugar: 5,
      sodium: 250,
    },
  );
});

test("provider-shaped data becomes canonical with provenance", () => {
  const result = normalizeNutrition({
    foodId: "food-1",
    referenceQuantity: 100,
    referenceUnit: "g",
    values: { calories: 418.4, protein: 20, sodium: 1000 },
    units: { calories: "kJ", sodium: "mg" },
    source: "USDA",
    sourceId: "fdc-1",
    sourceVersion: "2025",
    mappingType: "CLOSE_MATCH",
    confidence: 0.8,
  });
  assert.ok(Math.abs((result.calories ?? 0) - 100) < 1e-12);
  assert.equal(result.referenceBasis, "PER_100_G");
  assert.equal(result.protein, 20);
  assert.equal(result.carbohydrates, null);
  assert.equal(result.sourceId, "fdc-1");
  assert.equal(result.mappingType, "CLOSE_MATCH");
});

test("invalid values and confidence are rejected", () => {
  assert.throws(() =>
    normalizeNutrition({
      foodId: "f",
      referenceQuantity: 0,
      referenceUnit: "g",
      values: {},
      source: "s",
      sourceId: "i",
      sourceVersion: "v",
    }),
  );
  assert.throws(() =>
    normalizeNutrition({
      foodId: "f",
      referenceQuantity: 100,
      referenceUnit: "g",
      values: { protein: -1 },
      source: "s",
      sourceId: "i",
      sourceVersion: "v",
    }),
  );
  assert.throws(() =>
    normalizeNutrition({
      foodId: "f",
      referenceQuantity: 100,
      referenceUnit: "g",
      values: {},
      source: "s",
      sourceId: "i",
      sourceVersion: "v",
      confidence: 1.1,
    }),
  );
});

const reference: NutritionRecordLike = {
  nutritionVersionId: "reference-v1",
  nutritionVersion: {
    sourceId: "reference-source",
    effectiveFrom: new Date(0),
    effectiveTo: null,
    version: "2026",
    source: {
      name: "Test food table",
      provider: "test",
      sourceUrl: null,
      license: null,
    },
  },
  servingAmount: 100,
  servingUnit: "g",
  referenceBasis: "PER_100_G",
  preparation: "AS_SOLD",
  mappingType: "EXACT_MATCH",
  calories: 150,
  protein: null,
  carbohydrates: null,
  fat: null,
  fiber: null,
  sugar: null,
  sodium: null,
};

test("visible mass and volume measurements use only compatible source units", () => {
  const estimate = { basis: "VISIBLE_MEASUREMENT", confidence: 0.85 } as const;
  assert.deepEqual(
    estimatePortion({ ...estimate, unit: "kg", amount: 0.2 }, reference),
    {
      quantity: 200,
      unit: "g",
      evidence: {
        basis: "VISIBLE_MEASUREMENT",
        confidence: 0.85,
        source: "Test food table",
        version: "2026",
      },
    },
  );
  assert.equal(
    estimatePortion(
      { ...estimate, unit: "l", amount: 0.3 },
      { ...reference, servingUnit: "ml", referenceBasis: "PER_100_ML" },
    )?.quantity,
    300,
  );
  assert.equal(
    estimatePortion({ ...estimate, unit: "ml", amount: 200 }, reference),
    null,
  );
  assert.equal(
    estimatePortion(
      { ...estimate, confidence: 0.25, unit: "g", amount: 200 },
      reference,
    ),
    null,
  );
  for (const amount of [0, -10, Infinity, NaN]) {
    assert.equal(
      estimatePortion({ ...estimate, unit: "g", amount }, reference),
      null,
    );
    assert.throws(() => scaledNutrition(reference, amount, "grams"));
  }
  const final = scaledNutrition(reference, 150, "grams");
  assert.equal(final.calories, 225);
  assert.equal(final.protein, null);
});

test("counted servings require a documented serving reference", () => {
  const serving = {
    basis: "VISIBLE_SERVING_COUNT",
    unit: "serving",
    amount: 2,
    confidence: 0.8,
  } as const;
  assert.equal(estimatePortion(serving, reference), null);
  assert.equal(estimatePortion(serving, undefined), null);
  const documented = {
    ...reference,
    referenceBasis: "PER_SERVING",
    servingAmount: 45,
  } as const;
  const portion = estimatePortion(serving, documented);
  assert.equal(portion?.quantity, 90);
  assert.deepEqual(portion?.evidence.servingReference, {
    amount: 45,
    unit: "g",
  });
  assert.equal(estimatePortion({ ...serving, amount: 1.5 }, documented), null);
  assert.equal(
    scaledNutrition(
      { ...documented, servingUnit: "serving", servingAmount: 1 },
      2,
      "servings",
    ).calories,
    300,
  );
});
