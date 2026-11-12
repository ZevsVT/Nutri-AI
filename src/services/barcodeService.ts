import { ApiError, apiRequest } from "./apiClient";
import { createMeal, type SavedNutrition } from "./mealService";

type Size = { quantity: number; unit: string };

export interface BarcodeProduct {
  foodId: string;
  productName: string;
  brand: string;
  variant: string;
  package: { quantity: number | null; unit: string | null; unitsPerPack: number };
  labeledServing: Size | null;
  nutritionAvailability: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  nutrition: (SavedNutrition & {
    servingAmount: number;
    servingUnit: string;
    preparation: string;
    source: string;
    version: string;
  }) | null;
  source: { provider: string; version: string | null };
}

export async function scanBarcode(code: string, signal: AbortSignal) {
  try {
    const { data } = await apiRequest<{
      barcode: string;
      status: "RESOLVED" | "UNRESOLVED";
      product: BarcodeProduct | null;
    }>("/barcode/scan", { method: "POST", body: JSON.stringify({ barcode: code }), signal });
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 400)
      throw new Error("Enter an 8, 12, 13, or 14 digit barcode with a valid check digit.");
    throw error;
  }
}

export function canLogProduct(product: BarcodeProduct) {
  return product.nutritionAvailability !== "UNAVAILABLE" && product.nutrition?.preparation === "AS_SOLD";
}

export function saveScannedProduct(product: BarcodeProduct, quantity: number, unit: string) {
  if (!canLogProduct(product)) throw new Error("This product has no usable nutrition reference.");
  return createMeal({
    name: product.productName,
    mealType: "OTHER",
    capturedAt: new Date().toISOString(),
    items: [{ foodId: product.foodId, quantity, unit }],
  });
}
