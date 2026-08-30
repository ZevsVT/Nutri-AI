import assert from "node:assert/strict";
import { test } from "node:test";
import { FOOD_CATEGORIES, FOOD_TYPES, normalizeFoodText, slugifyFoodName } from "../src/modules/foods/food-taxonomy.js";

test("normalization preserves searchable equivalence without changing display values", () => {
  assert.equal(normalizeFoodText("Phở bò"), "pho bo");
  assert.equal(normalizeFoodText(" PHO   BO "), "pho bo");
  assert.equal(slugifyFoodName("Phở bò"), "pho-bo");
});

test("taxonomy vocabularies contain the required controlled values", () => {
  assert.deepEqual(FOOD_TYPES, ["INGREDIENT", "DISH", "MEAL", "BEVERAGE", "CONDIMENT", "SNACK", "DESSERT", "PACKAGED_FOOD"]);
  assert.ok(FOOD_CATEGORIES.includes("RICE"));
  assert.ok(FOOD_CATEGORIES.includes("PLANT_PROTEIN"));
});
