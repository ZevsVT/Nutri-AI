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

export interface NutritionProvider {
  searchFood(query: FoodSearchQuery): Promise<readonly FoodRecord[]>;
  getNutrition(foodId: string): Promise<NutritionRecord>;
  resolveFood(label: string): Promise<FoodRecord | null>;
}
