import { randomUUID, randomInt } from "node:crypto";
import type { PackagedFoodEntry } from "../../src/modules/foods/packaged-food-import.js";

/** Synthetic identifiers and nutrition are test-only; never import these into a user catalog. */
export function syntheticGtin() {
  const body = "299" + randomInt(0, 1_000_000_000).toString().padStart(9, "0");
  const sum = [...body].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );
  return body + ((10 - (sum % 10)) % 10);
}

export function syntheticProduct(): PackagedFoodEntry {
  const foodId = randomUUID();
  return {
    foodId,
    importKey: `test:${foodId}`,
    canonicalName: `test-product-${foodId}`,
    nameVi: `Sản phẩm kiểm thử ${foodId}`,
    nameEn: `Test product ${foodId}`,
    brand: "Synthetic Test Brand",
    variant: "Vanilla",
    category: "BEVERAGE",
    status: "ACTIVE",
    aliases: [`Synthetic vanilla ${foodId}`],
    source: {
      provider: "Synthetic test fixture",
      reference: foodId,
      version: "A",
      url: "https://example.com/test-only",
      reviewedAt: "2020-01-01T00:00:00.000Z",
      usageConditions: "Synthetic test data only",
      notes: "Never expose as a real product or source-backed nutrition.",
    },
    barcodes: [
      {
        barcode: syntheticGtin(),
        status: "ACTIVE",
        package: { quantity: 500, unit: "ml" },
        unitsPerPack: 1,
        labeledServing: { quantity: 200, unit: "ml" },
        sourceUrl: "https://example.com/test-only",
      },
    ],
    nutrition: {
      reference: { quantity: 100, unit: "ml" },
      values: { calories: 418.4, protein: 3, sodium: 0.1 },
      units: { calories: "kJ", sodium: "g" },
      preparation: "AS_SOLD",
      mappingType: "EXACT_MATCH",
      evidenceUrl: "https://example.com/test-only-label",
    },
  };
}
