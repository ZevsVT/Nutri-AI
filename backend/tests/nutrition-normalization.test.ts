import assert from "node:assert/strict";
import { test } from "node:test";
import { convertUnit, energyToKcal, normalizeNutrition, scaleNutrition } from "../src/modules/nutrition/nutrition-normalization.js";

test("canonical unit and energy conversions are deterministic", () => {
  assert.equal(convertUnit(1000, "mg", "g"), 1);
  assert.equal(convertUnit(1, "g", "mg"), 1000);
  assert.equal(energyToKcal(4.184, "kJ"), 1);
});

test("serving scaling preserves nulls and does not round intermediates", () => {
  assert.deepEqual(scaleNutrition({ calories: 100, protein: 20, carbohydrates: null, fat: 1.25, fiber: 0, sugar: 2, sodium: 100 }, 250, 100), { calories: 250, protein: 50, carbohydrates: null, fat: 3.125, fiber: 0, sugar: 5, sodium: 250 });
});

test("provider-shaped data becomes canonical with provenance", () => {
  const result = normalizeNutrition({ foodId: "food-1", referenceQuantity: 100, referenceUnit: "g", values: { calories: 418.4, protein: 20, sodium: 1000 }, units: { calories: "kJ", sodium: "mg" }, source: "USDA", sourceId: "fdc-1", sourceVersion: "2025" , mappingType: "CLOSE_MATCH", confidence: 0.8 });
  assert.ok(Math.abs((result.calories ?? 0) - 100) < 1e-12);
  assert.equal(result.referenceBasis, "PER_100_G");
  assert.equal(result.protein, 20);
  assert.equal(result.carbohydrates, null);
  assert.equal(result.sourceId, "fdc-1");
  assert.equal(result.mappingType, "CLOSE_MATCH");
});

test("invalid values and confidence are rejected", () => {
  assert.throws(() => normalizeNutrition({ foodId: "f", referenceQuantity: 0, referenceUnit: "g", values: {}, source: "s", sourceId: "i", sourceVersion: "v" }));
  assert.throws(() => normalizeNutrition({ foodId: "f", referenceQuantity: 100, referenceUnit: "g", values: { protein: -1 }, source: "s", sourceId: "i", sourceVersion: "v" }));
  assert.throws(() => normalizeNutrition({ foodId: "f", referenceQuantity: 100, referenceUnit: "g", values: {}, source: "s", sourceId: "i", sourceVersion: "v", confidence: 1.1 }));
});
