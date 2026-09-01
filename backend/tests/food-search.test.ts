import assert from "node:assert/strict";
import { test } from "node:test";
import { rankFoods, scoreFood } from "../src/modules/foods/food-search.js";

const foods = [
  { id: "pho", nameVi: "Phở bò", nameEn: "Beef pho", aliases: [{ alias: "phở", language: "vi" }] },
  { id: "bun", nameVi: "Bún bò Huế", nameEn: "Hue beef noodle soup", aliases: [{ alias: "bun bo hue", language: "vi" }] },
  { id: "goi", nameVi: "Gỏi cuốn", nameEn: "Fresh spring rolls", aliases: [] },
];

test("food ranking prefers exact, normalized, alias, and then fuzzy matches", () => {
  assert.ok(scoreFood(foods[0]!, "pho bo") > scoreFood(foods[1]!, "pho bo"));
  assert.equal(rankFoods(foods, "PHO")[0]!.item.id, "pho");
  assert.equal(rankFoods(foods, "phoo")[0]!.item.id, "pho");
  assert.equal(rankFoods(foods, "spring rolls")[0]!.item.id, "goi");
});

test("short fuzzy queries do not return unrelated foods", () => {
  assert.equal(rankFoods(foods, "bo").some(({ item }) => item.id === "goi"), false);
});
