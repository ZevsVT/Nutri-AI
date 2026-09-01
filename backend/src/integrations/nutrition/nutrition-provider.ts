import { normalizeNutrition } from "../../modules/nutrition/nutrition-normalization.js";
import type {
  CanonicalNutrition,
  ProviderNutritionInput,
} from "../../modules/nutrition/nutrition-normalization.js";

export interface FoodSearchQuery {
  query: string;
  locale?: string;
}

export interface FoodRecord {
  id: string;
  canonicalName: string;
  source: string;
}

export interface NutritionRecord {
  foodId: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: string;
  nutritionVersion: string;
}

/** Adapter boundary: providers return their own shape, but application code
 * should only accept the canonical result produced here. */
export type ProviderNutritionAdapter<T> = (record: T) => ProviderNutritionInput;
export function normalizeProviderNutrition<T>(
  record: T,
  adapter: ProviderNutritionAdapter<T>,
): CanonicalNutrition {
  return normalizeNutrition(adapter(record));
}

export interface NutritionProvider {
  searchFood(query: FoodSearchQuery): Promise<readonly FoodRecord[]>;
  getNutrition(foodId: string): Promise<NutritionRecord>;
  resolveFood(label: string): Promise<FoodRecord | null>;
}
