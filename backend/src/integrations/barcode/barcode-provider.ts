import type { nutritionDto } from "../../modules/nutrition/nutrition-record.js";

export interface BarcodeLookupResult {
  barcode: string;
  foodId: string;
  productName: string;
  brand: string;
  variant: string;
  package: {
    quantity: number | null;
    unit: string | null;
    unitsPerPack: number;
  };
  labeledServing: { quantity: number; unit: string } | null;
  nutritionAvailability: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  nutrition: ReturnType<typeof nutritionDto> | null;
  source: {
    provider: string;
    name: string;
    version: string | null;
    reference: string | null;
    url: string | null;
    reviewedAt: string | null;
    usageConditions: string | null;
  };
}

/** Provider boundary for barcode services; the public API does not depend on a vendor SDK. */
export interface BarcodeProvider {
  lookup(barcode: string): Promise<BarcodeLookupResult | null>;
}

export class NoopBarcodeProvider implements BarcodeProvider {
  async lookup(barcode: string): Promise<BarcodeLookupResult | null> {
    void barcode;
    return null;
  }
}
