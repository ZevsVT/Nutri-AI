import { apiRequest } from "./apiClient";

export interface MealEntryInput {
  foodId: string;
  displayName?: string;
  quantity: number;
  unit: string;
}

export interface SavedNutrition {
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  fiber: number | null;
}

export interface SavedMeal {
  id: string;
  name: string;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "OTHER";
  status: string;
  notes: string | null;
  capturedAt: string;
  confirmedAt: string | null;
  imageReference: string | null;
  totals: SavedNutrition;
  items: Array<MealEntryInput & {
    id: string;
    nutrition?: SavedNutrition;
    provenance?: { source: string; version: string; servingAmount: number; servingUnit: string };
  }>;
}

export interface CatalogFood {
  id: string;
  name: { vi: string; en: string | null };
  servingUnit?: string | null;
  nutrition?: { servingAmount: number; servingUnit: string };
}

export async function searchCatalog(query: string, signal: AbortSignal) {
  const params = new URLSearchParams({ q: query, locale: "vi", pageSize: "12" });
  return (await apiRequest<CatalogFood[]>(`/foods/search?${params}`, { signal })).data;
}

export async function readMeal(id: string, signal?: AbortSignal) {
  return (await apiRequest<SavedMeal>(`/meals/${id}`, { signal })).data;
}
