export const FOOD_TYPES = ["INGREDIENT", "DISH", "MEAL", "BEVERAGE", "CONDIMENT", "SNACK", "DESSERT", "PACKAGED_FOOD"] as const;
export type FoodType = (typeof FOOD_TYPES)[number];

export const FOOD_CATEGORIES = ["STAPLE", "RICE", "NOODLES", "MAIN_DISH", "SOUP", "MEAT", "POULTRY", "SEAFOOD", "EGGS", "VEGETABLES", "FRUITS", "PLANT_PROTEIN", "SNACK", "DESSERT", "BEVERAGE", "CONDIMENT", "PACKAGED_FOOD"] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_REGIONS = ["NORTH", "CENTRAL", "SOUTH", "NATIONWIDE"] as const;
export const COOKING_METHODS = ["RAW", "BOILED", "STEAMED", "GRILLED", "BAKED", "FRIED", "STIR_FRIED", "BRAISED", "SIMMERED", "FERMENTED", "DRIED", "OTHER"] as const;
export const SERVING_UNITS = ["GRAM", "MILLILITER", "BOWL", "PLATE", "PIECE", "SLICE", "CUP", "TABLESPOON", "TEASPOON", "SERVING"] as const;

/** Search form only: display names remain unchanged in the database. */
export function normalizeFoodText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("vi").trim().replace(/\s+/g, " ");
}

export function slugifyFoodName(value: string): string {
  return normalizeFoodText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
