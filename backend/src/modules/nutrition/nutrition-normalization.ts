/** Canonical nutrition boundary. Provider adapters should map their response
 * into ProviderNutritionInput and call normalizeNutrition before persistence. */

export const CANONICAL_UNITS = {
  energy: "kcal",
  protein: "g",
  carbohydrates: "g",
  fat: "g",
  fiber: "g",
  sugar: "g",
  sodium: "mg",
} as const;

export type NutritionUnit = "g" | "mg" | "kcal" | "kJ" | "ml" | "l";
export type ReferenceBasis = "PER_100_G" | "PER_100_ML" | "PER_SERVING";
export type NutritionMappingType = "EXACT_MATCH" | "CLOSE_MATCH" | "DERIVED_ESTIMATE" | "ESTIMATED" | "UNAVAILABLE";

export interface NutritionValues {
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
}

export interface ProviderNutritionInput {
  foodId: string;
  referenceQuantity: number;
  referenceUnit: "g" | "ml" | "serving";
  values: Partial<NutritionValues>;
  units?: Partial<Record<keyof NutritionValues, NutritionUnit>>;
  source: string;
  sourceId: string;
  sourceVersion: string;
  mappingType?: NutritionMappingType;
  confidence?: number | null;
}

export interface CanonicalNutrition extends NutritionValues {
  foodId: string;
  referenceBasis: ReferenceBasis;
  referenceQuantity: number;
  referenceUnit: "g" | "ml" | "serving";
  source: string;
  sourceId: string;
  sourceVersion: string;
  mappingType: NutritionMappingType;
  confidence: number | null;
  consistencyWarning: boolean;
}

const MASS_TO_GRAMS: Record<string, number> = { g: 1, mg: 0.001 };
const VOLUME_TO_ML: Record<string, number> = { ml: 1, l: 1000 };
const VALUE_FIELDS = ["calories", "protein", "carbohydrates", "fat", "fiber", "sugar", "sodium"] as const;
const MAPPING_TYPES = new Set<NutritionMappingType>(["EXACT_MATCH", "CLOSE_MATCH", "DERIVED_ESTIMATE", "ESTIMATED", "UNAVAILABLE"]);

export function convertUnit(value: number, from: NutritionUnit, to: NutritionUnit): number {
  if (!Number.isFinite(value)) throw new Error("Nutrition value must be finite");
  if (from === to) return value;
  if (MASS_TO_GRAMS[from] !== undefined && MASS_TO_GRAMS[to] !== undefined) return value * MASS_TO_GRAMS[from] / MASS_TO_GRAMS[to];
  if (VOLUME_TO_ML[from] !== undefined && VOLUME_TO_ML[to] !== undefined) return value * VOLUME_TO_ML[from] / VOLUME_TO_ML[to];
  throw new Error(`Unsupported unit conversion: ${from} to ${to}`);
}

export function energyToKcal(value: number, unit: "kcal" | "kJ"): number {
  if (!Number.isFinite(value) || value < 0) throw new Error("Energy must be a non-negative finite number");
  return unit === "kJ" ? value / 4.184 : value;
}

export function scaleNutrition<T extends NutritionValues>(values: T, requestedQuantity: number, referenceQuantity: number): T {
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) throw new Error("Requested serving quantity must be positive");
  if (!Number.isFinite(referenceQuantity) || referenceQuantity <= 0) throw new Error("Reference quantity must be positive");
  const factor = requestedQuantity / referenceQuantity;
  return Object.fromEntries(VALUE_FIELDS.map((field) => [field, values[field] === null ? null : values[field] * factor])) as unknown as T;
}

export function validateNutrition(values: Partial<NutritionValues>, confidence?: number | null): void {
  for (const field of VALUE_FIELDS) {
    const value = values[field];
    if (value !== undefined && value !== null && (!Number.isFinite(value) || value < 0)) throw new Error(`${field} must be null or a non-negative finite number`);
  }
  if (confidence !== undefined && confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) throw new Error("confidence must be between 0 and 1");
}

export function normalizeNutrition(input: ProviderNutritionInput): CanonicalNutrition {
  if (!input.foodId.trim() || !input.source.trim() || !input.sourceId.trim() || !input.sourceVersion.trim()) throw new Error("Nutrition provenance is required");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.sourceId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.sourceVersion)) throw new Error("Malformed nutrition source identifier");
  if (!Number.isFinite(input.referenceQuantity) || input.referenceQuantity <= 0) throw new Error("Reference quantity must be positive");
  if (!(["g", "ml", "serving"] as const).includes(input.referenceUnit)) throw new Error("Invalid reference unit");
  if (input.mappingType !== undefined && !MAPPING_TYPES.has(input.mappingType)) throw new Error("Invalid nutrition mapping type");
  const basis: ReferenceBasis = input.referenceUnit === "g" && input.referenceQuantity === 100 ? "PER_100_G" : input.referenceUnit === "ml" && input.referenceQuantity === 100 ? "PER_100_ML" : "PER_SERVING";
  const values: NutritionValues = { calories: null, protein: null, carbohydrates: null, fat: null, fiber: null, sugar: null, sodium: null };
  for (const field of VALUE_FIELDS) {
    const raw = input.values[field];
    if (raw === undefined || raw === null) continue;
    const unit = input.units?.[field] ?? (field === "calories" ? "kcal" : field === "sodium" ? "mg" : "g");
    if (field === "calories") {
      if (unit !== "kcal" && unit !== "kJ") throw new Error("Energy unit must be kcal or kJ");
      values[field] = energyToKcal(raw, unit);
    } else {
      values[field] = convertUnit(raw, unit, field === "sodium" ? "mg" : "g");
    }
  }
  validateNutrition(values, input.confidence);
  const macroEnergy = values.protein === null || values.carbohydrates === null || values.fat === null ? null : values.protein * 4 + values.carbohydrates * 4 + values.fat * 9;
  const consistencyWarning = values.calories !== null && macroEnergy !== null && Math.abs(values.calories - macroEnergy) > Math.max(25, values.calories * 0.25);
  return { ...values, foodId: input.foodId, referenceBasis: basis, referenceQuantity: input.referenceQuantity, referenceUnit: input.referenceUnit, source: input.source, sourceId: input.sourceId, sourceVersion: input.sourceVersion, mappingType: input.mappingType ?? "EXACT_MATCH", confidence: input.confidence ?? null, consistencyWarning };
}
