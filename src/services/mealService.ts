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

export const mealTypes = {
  BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner", SNACK: "Snack", OTHER: "Other",
} satisfies Record<SavedMeal["mealType"], string>;

type MealMetadata = Pick<SavedMeal, "name" | "mealType" | "capturedAt"> & { notes?: string };

export function localDateTime(value = new Date()) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function dayBounds(day: string) {
  const start = new Date(`${day}T00:00:00`);
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  return { from: start.toISOString(), to: new Date(next.getTime() - 1).toISOString() };
}

export async function listMeals(filters: {
  page: number;
  day: string;
  mealType: string;
  status: string;
}, signal: AbortSignal) {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: "20" });
  if (filters.day) {
    const bounds = dayBounds(filters.day);
    query.set("from", bounds.from);
    query.set("to", bounds.to);
  }
  if (filters.mealType) query.set("mealType", filters.mealType);
  if (filters.status) query.set("status", filters.status);
  return apiRequest<SavedMeal[]>(`/meals?${query}`, { signal });
}

export async function createMeal(input: MealMetadata & { items: MealEntryInput[] }) {
  return (await apiRequest<SavedMeal>("/meals", {
    method: "POST", body: JSON.stringify(input),
  })).data;
}

export async function updateMeal(id: string, input: Partial<MealMetadata>) {
  return (await apiRequest<SavedMeal>(`/meals/${id}`, {
    method: "PATCH", body: JSON.stringify(input),
  })).data;
}

export async function deleteMeal(id: string) {
  await apiRequest(`/meals/${id}`, { method: "DELETE" });
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
