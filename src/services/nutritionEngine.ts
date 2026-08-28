import type { DetectedItem, Meal, NutritionFacts, UserGoals } from "../types";

export const DEFAULT_GOALS: UserGoals = {
  calories: 2000,
  protein: 90,
  carbs: 220,
  fat: 65,
  fiber: 28,
  waterMl: 2400,
  plantDiversityTarget: 5,
};

export function calculateDetectedTotals(items: DetectedItem[]): NutritionFacts {
  return items.reduce<NutritionFacts>(
    (acc, item) => {
      const multiplier = item.amount / 100; // base values are per 100g/ml
      return {
        calories: acc.calories + Math.round(item.baseCalories * multiplier),
        protein: acc.protein + Math.round(item.baseProtein * multiplier),
        carbs: acc.carbs + Math.round(item.baseCarbs * multiplier),
        fat: acc.fat + Math.round(item.baseFat * multiplier),
        fiber: acc.fiber + Math.round(item.baseFiber * multiplier),
        sodium: acc.sodium + Math.round((item.name.toLowerCase().includes("broth") ? 750 : 80) * multiplier),
        sugar: acc.sugar + Math.round((item.name.toLowerCase().includes("fruit") ? 8 : 1) * multiplier),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 }
  );
}

export function calculateDailyTotals(meals: Meal[]) {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
      fiber: acc.fiber + meal.fiber,
      sodium: acc.sodium + (meal.sodium || 200),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }
  );
}

export function calculateAverageConfidence(items: DetectedItem[]): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc, item) => acc + item.confidence, 0);
  return Math.round((sum / items.length) * 100) / 100;
}

export function formatMacro(value: number, unit = "g"): string {
  return `${value} ${unit}`;
}

export function formatCalories(value: number): string {
  return `${value.toLocaleString()} kcal`;
}

export function getPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}
