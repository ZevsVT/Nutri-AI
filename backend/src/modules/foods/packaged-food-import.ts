import { createHash } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { FOOD_CATEGORIES, normalizeFoodText } from "./food-taxonomy.js";
import { gtinSchema, normalizeBarcode } from "./barcode-normalization.js";
import {
  normalizeNutrition,
  type CanonicalNutrition,
} from "../nutrition/nutrition-normalization.js";

const text = (max: number) => z.string().trim().min(1).max(max);
const quantity = z
  .number()
  .finite()
  .positive()
  .max(999_999_999)
  .refine(
    (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001,
    "Quantity supports at most three decimals",
  );
const amount = z
  .object({ quantity, unit: z.enum(["g", "ml", "serving"]) })
  .strict();
const nutrients = z
  .object({
    calories: z.number().nullable().optional(),
    protein: z.number().nullable().optional(),
    carbohydrates: z.number().nullable().optional(),
    fat: z.number().nullable().optional(),
    fiber: z.number().nullable().optional(),
    sugar: z.number().nullable().optional(),
    sodium: z.number().nullable().optional(),
  })
  .strict();
const nutrientUnit = z.enum(["g", "mg", "kcal", "kJ", "ml", "l"]);
const nutrientUnits = z
  .object({
    calories: nutrientUnit.optional(),
    protein: nutrientUnit.optional(),
    carbohydrates: nutrientUnit.optional(),
    fat: nutrientUnit.optional(),
    fiber: nutrientUnit.optional(),
    sugar: nutrientUnit.optional(),
    sodium: nutrientUnit.optional(),
  })
  .strict();
export const packagedFoodSchema = z
  .object({
    foodId: z.string().uuid(),
    importKey: text(160).regex(/^[a-z0-9][a-z0-9._:-]*$/),
    canonicalName: text(160).regex(/^[a-z0-9][a-z0-9-]*$/),
    nameVi: text(160),
    nameEn: text(160).nullable(),
    brand: text(120),
    variant: text(160),
    category: z.enum(FOOD_CATEGORIES),
    aliases: z.array(text(200)).max(50),
    status: z.enum(["ACTIVE", "INACTIVE", "DEPRECATED"]),
    source: z
      .object({
        provider: text(120),
        reference: text(240),
        version: text(80).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
        url: z.string().url(),
        reviewedAt: z.string().datetime(),
        usageConditions: text(160),
        notes: text(2000),
      })
      .strict(),
    barcodes: z
      .array(
        z
          .object({
            barcode: gtinSchema,
            status: z.enum(["ACTIVE", "INACTIVE", "DEPRECATED"]),
            sourceUrl: z.string().url(),
            package: z
              .object({ quantity, unit: z.enum(["g", "ml", "piece"]) })
              .strict()
              .nullable(),
            unitsPerPack: z.number().int().positive().max(100_000),
            labeledServing: amount.nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    nutrition: z
      .object({
        reference: amount,
        values: nutrients,
        units: nutrientUnits.optional(),
        preparation: z.enum(["AS_SOLD", "AS_PREPARED"]),
        mappingType: z.enum([
          "EXACT_MATCH",
          "CLOSE_MATCH",
          "DERIVED_ESTIMATE",
          "ESTIMATED",
        ]),
        evidenceUrl: z.string().url(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type PackagedFoodEntry = z.infer<typeof packagedFoodSchema>;
export interface ImportReport {
  inserted: number;
  updated: number;
  skipped: number;
  rejected: number;
  errors: Array<{ index: number; importKey?: string; reason: string }>;
}

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function normalizedProductNutrition(
  entry: PackagedFoodEntry,
  sourceId: string,
): CanonicalNutrition | null {
  if (!entry.nutrition) return null;
  const result = normalizeNutrition({
    foodId: entry.foodId,
    referenceQuantity: entry.nutrition.reference.quantity,
    referenceUnit: entry.nutrition.reference.unit,
    values: entry.nutrition.values,
    units: entry.nutrition.units,
    source: entry.source.provider,
    sourceId,
    sourceVersion: entry.source.version,
    mappingType: entry.nutrition.mappingType,
  });
  if (
    ![
      result.calories,
      result.protein,
      result.carbohydrates,
      result.fat,
      result.fiber,
      result.sugar,
      result.sodium,
    ].some((value) => value !== null)
  )
    throw new Error(
      "Nutrition must contain at least one known nutrient; use null for unavailable nutrition",
    );
  for (const value of [
    result.calories,
    result.protein,
    result.carbohydrates,
    result.fat,
    result.fiber,
    result.sugar,
    result.sodium,
  ])
    if (value !== null && value > 999_999_999)
      throw new Error("Nutrient exceeds database precision");
  return result;
}

/** Validate the entire batch before writes; reject ambiguous identities on both sides. */
export function validatePackagedFoods(input: readonly unknown[]) {
  const report: ImportReport = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    rejected: 0,
    errors: [],
  };
  const entries = new Map<number, PackagedFoodEntry>();
  const rejected = new Set<number>();
  const reject = (index: number, reason: string) => {
    if (rejected.has(index)) return;
    rejected.add(index);
    report.rejected++;
    report.errors.push({
      index,
      importKey: entries.get(index)?.importKey,
      reason,
    });
  };
  for (const [index, item] of input.entries()) {
    try {
      const entry = packagedFoodSchema.parse(item);
      entries.set(index, entry);
      normalizedProductNutrition(entry, "validation");
    } catch (error) {
      reject(index, error instanceof Error ? error.message : "Invalid product");
    }
  }
  const owners = new Map<string, number>();
  for (const [index, entry] of entries) {
    const keys = [
      "import:" + entry.importKey,
      "food:" + entry.foodId,
      "name:" + entry.canonicalName,
      ...entry.barcodes.map(
        (item) => "barcode:" + normalizeBarcode(item.barcode),
      ),
      ...entry.aliases.map((alias) => "alias:" + normalizeFoodText(alias)),
    ];
    for (const key of keys) {
      const owner = owners.get(key);
      if (owner !== undefined) {
        reject(owner, `Duplicate batch identity: ${key}`);
        reject(index, `Duplicate batch identity: ${key}`);
      } else owners.set(key, index);
    }
  }
  return {
    entries: [...entries].filter(([index]) => !rejected.has(index)),
    report,
  };
}

export async function importPackagedFoods(
  prisma: PrismaClient,
  input: readonly unknown[],
): Promise<ImportReport> {
  const { entries, report } = validatePackagedFoods(input);
  for (const [index, entry] of entries) {
    try {
      const outcome = await prisma.$transaction(
        async (tx) => {
          // Small reviewed batches are serialized across importer processes to make conflict checks atomic.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(17170017)`;
          const existing = await tx.packagedProduct.findUnique({
            where: { importKey: entry.importKey },
          });
          if (
            existing &&
            (existing.foodId !== entry.foodId ||
              existing.brand !== entry.brand ||
              existing.variant !== entry.variant)
          )
            throw new Error(
              "Stable product identity, brand, or formulation changed; review a new product identity",
            );
          if (
            existing &&
            existing.reviewedAt &&
            new Date(entry.source.reviewedAt) < existing.reviewedAt
          )
            throw new Error(
              "Stale review cannot replace a newer catalog revision",
            );
          const otherProduct = await tx.packagedProduct.findUnique({
            where: { foodId: entry.foodId },
          });
          if (otherProduct && otherProduct.importKey !== entry.importKey)
            throw new Error("Food already belongs to another import identity");
          const mappings = await tx.foodBarcode.findMany({
            where: {
              normalizedBarcode: {
                in: entry.barcodes.map((item) =>
                  normalizeBarcode(item.barcode),
                ),
              },
            },
          });
          if (mappings.some((mapping) => mapping.foodId !== entry.foodId))
            throw new Error(
              "Barcode is assigned to another product; reassignment requires explicit review",
            );
          const food = await tx.food.findUnique({
            where: { id: entry.foodId },
          });
          if (
            food &&
            (food.canonicalName !== entry.canonicalName ||
              food.foodType !== "PACKAGED_FOOD")
          )
            throw new Error(
              "Canonical food identity conflicts with existing food",
            );
          for (const alias of entry.aliases) {
            const owner = await tx.foodAlias.findUnique({
              where: {
                normalizedAlias_language: {
                  normalizedAlias: normalizeFoodText(alias),
                  language: "vi",
                },
              },
            });
            if (owner && owner.foodId !== entry.foodId)
              throw new Error("Alias is assigned to another food");
          }
          const manifestHash = hash(entry);
          if (existing?.manifestHash === manifestHash) return "skipped";
          const source = await tx.foodSource.upsert({
            where: {
              provider_name: {
                provider: entry.source.provider,
                name: entry.importKey,
              },
            },
            create: {
              provider: entry.source.provider,
              name: entry.importKey,
              sourceType: "CURATED",
              sourceUrl: entry.source.url,
              sourceReference: entry.source.reference,
              license: entry.source.usageConditions,
              metadata: entry.source,
            },
            update: {
              sourceUrl: entry.source.url,
              sourceReference: entry.source.reference,
              license: entry.source.usageConditions,
              metadata: entry.source,
            },
          });
          if (existing && source.id !== existing.sourceId)
            throw new Error(
              "Product source changed; review a separate source migration",
            );
          const nutrition = normalizedProductNutrition(entry, source.id);
          let currentNutritionVersionId: string | null = null;
          // Source versions are immutable even when a product's availability changes.
          const nutritionHash = hash(entry.nutrition);
          const version = await tx.nutritionVersion.findUnique({
            where: {
              sourceId_version: {
                sourceId: source.id,
                version: entry.source.version,
              },
            },
          });
          if (
            version &&
            (version.metadata as { nutritionHash?: string } | null)
              ?.nutritionHash !== nutritionHash
          )
            throw new Error("Nutrition changed without a new source version");
          const lineage =
            version ??
            (await tx.nutritionVersion.create({
              data: {
                sourceId: source.id,
                version: entry.source.version,
                effectiveFrom: new Date(entry.source.reviewedAt),
                metadata: {
                  ...entry.source,
                  nutritionHash,
                  nutritionEvidenceUrl: entry.nutrition?.evidenceUrl ?? null,
                },
              },
            }));
          await tx.food.upsert({
            where: { id: entry.foodId },
            create: {
              id: entry.foodId,
              canonicalName: entry.canonicalName,
              slug: entry.canonicalName,
              normalizedName: normalizeFoodText(entry.nameVi),
              nameVi: entry.nameVi,
              nameEn: entry.nameEn,
              foodType: "PACKAGED_FOOD",
              category: entry.category,
              status: entry.status,
              isActive: entry.status === "ACTIVE",
            },
            update: {
              nameVi: entry.nameVi,
              nameEn: entry.nameEn,
              category: entry.category,
            },
          });
          if (nutrition) {
            const values: Prisma.FoodNutritionUncheckedCreateInput = {
              foodId: entry.foodId,
              nutritionVersionId: lineage.id,
              servingAmount: nutrition.referenceQuantity,
              servingUnit: nutrition.referenceUnit,
              referenceBasis: nutrition.referenceBasis,
              preparation: entry.nutrition!.preparation,
              calories: nutrition.calories,
              protein: nutrition.protein,
              carbohydrates: nutrition.carbohydrates,
              fat: nutrition.fat,
              fiber: nutrition.fiber,
              sugar: nutrition.sugar,
              sodium: nutrition.sodium,
              mappingType: nutrition.mappingType,
            };
            await tx.foodNutrition.upsert({
              where: {
                foodId_nutritionVersionId: {
                  foodId: entry.foodId,
                  nutritionVersionId: lineage.id,
                },
              },
              create: values,
              update: {},
            });
            currentNutritionVersionId = lineage.id;
          }
          const product = {
            brand: entry.brand,
            variant: entry.variant,
            status: entry.status,
            sourceId: source.id,
            sourceReference: entry.source.reference,
            sourceVersion: entry.source.version,
            reviewedAt: new Date(entry.source.reviewedAt),
            manifestHash,
            currentNutritionVersionId,
          };
          await tx.packagedProduct.upsert({
            where: { importKey: entry.importKey },
            create: {
              ...product,
              foodId: entry.foodId,
              importKey: entry.importKey,
            },
            update: product,
          });
          for (const item of entry.barcodes) {
            const data = {
              barcode: item.barcode,
              foodId: entry.foodId,
              status: item.status,
              packageQuantity: item.package?.quantity ?? null,
              packageUnit: item.package?.unit ?? null,
              unitsPerPack: item.unitsPerPack,
              labeledServingQuantity: item.labeledServing?.quantity ?? null,
              labeledServingUnit: item.labeledServing?.unit ?? null,
              sourceUrl: item.sourceUrl,
            };
            await tx.foodBarcode.upsert({
              where: { normalizedBarcode: normalizeBarcode(item.barcode) },
              create: {
                normalizedBarcode: normalizeBarcode(item.barcode),
                ...data,
              },
              update: data,
            });
          }
          for (const alias of entry.aliases)
            await tx.foodAlias.upsert({
              where: {
                normalizedAlias_language: {
                  normalizedAlias: normalizeFoodText(alias),
                  language: "vi",
                },
              },
              create: {
                foodId: entry.foodId,
                alias,
                normalizedAlias: normalizeFoodText(alias),
                language: "vi",
              },
              update: {},
            });
          return existing ? "updated" : "inserted";
        },
        { maxWait: 30_000, timeout: 30_000 },
      );
      report[outcome]++;
    } catch (error) {
      report.rejected++;
      report.errors.push({
        index,
        importKey: entry.importKey,
        reason: error instanceof Error ? error.message : "Import failed",
      });
    }
  }
  return report;
}
