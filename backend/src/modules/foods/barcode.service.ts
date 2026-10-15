import type { PrismaClient } from "@prisma/client";
import { AppError } from "../../common/errors/app-error.js";
import type {
  BarcodeLookupResult,
  BarcodeProvider,
} from "../../integrations/barcode/barcode-provider.js";
import { gtinSchema, normalizeBarcode } from "./barcode-normalization.js";
import {
  latestNutrition,
  nullableNumber,
  nutritionDto,
  nutritionValues,
} from "../nutrition/nutrition-record.js";

export interface BarcodeScanResult {
  barcode: string;
  normalizedBarcode: string;
  status: "RESOLVED" | "UNRESOLVED";
  foodId: string | null;
  product: BarcodeLookupResult | null;
  source: BarcodeLookupResult["source"] | null;
}

export class BarcodeService {
  constructor(private readonly provider: BarcodeProvider) {}
  async scan(input: string): Promise<BarcodeScanResult> {
    const parsed = gtinSchema.safeParse(input);
    if (!parsed.success)
      throw new AppError("VALIDATION_ERROR", "Invalid barcode");
    const barcode = parsed.data;
    const normalizedBarcode = normalizeBarcode(barcode);
    let product: BarcodeLookupResult | null;
    try {
      product = await this.provider.lookup(normalizedBarcode);
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new AppError(
        "EXTERNAL_SERVICE_ERROR",
        "Barcode lookup is temporarily unavailable",
        { cause },
      );
    }
    return {
      barcode,
      normalizedBarcode,
      status: product ? "RESOLVED" : "UNRESOLVED",
      foodId: product?.foodId ?? null,
      product,
      source: product?.source ?? null,
    };
  }
}

export class PrismaBarcodeProvider implements BarcodeProvider {
  constructor(private readonly prisma: PrismaClient) {}
  async lookup(barcode: string): Promise<BarcodeLookupResult | null> {
    try {
      const mapping = await this.prisma.foodBarcode.findUnique({
        where: { normalizedBarcode: normalizeBarcode(barcode) },
        include: {
          product: {
            include: {
              source: true,
              food: {
                include: {
                  nutritionRecords: {
                    include: {
                      nutritionVersion: { include: { source: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (
        !mapping ||
        mapping.status !== "ACTIVE" ||
        mapping.product.status !== "ACTIVE" ||
        mapping.product.food.status !== "ACTIVE" ||
        !mapping.product.food.isActive
      )
        return null;
      const { product } = mapping;
      const record = latestNutrition(
        product.food.nutritionRecords,
        product.currentNutritionVersionId,
      );
      const hasNutrition =
        record &&
        record.mappingType !== "UNAVAILABLE" &&
        Object.values(nutritionValues(record)).some((value) => value !== null);
      return {
        barcode: mapping.barcode,
        foodId: product.foodId,
        productName: product.productName ?? product.food.nameVi,
        brand: product.brand,
        variant: product.variant,
        package: {
          quantity: nullableNumber(
            mapping.packageQuantity ?? product.packageQuantity,
          ),
          unit: mapping.packageUnit ?? product.packageUnit,
          unitsPerPack: mapping.unitsPerPack,
        },
        labeledServing:
          mapping.labeledServingQuantity === null
            ? null
            : {
                quantity: Number(mapping.labeledServingQuantity),
                unit: mapping.labeledServingUnit!,
              },
        nutritionAvailability: !hasNutrition
          ? "UNAVAILABLE"
          : Object.values(nutritionValues(record)).every(
                (value) => value !== null,
              )
            ? "AVAILABLE"
            : "PARTIAL",
        nutrition: hasNutrition ? nutritionDto(record) : null,
        source: {
          provider: product.source.provider,
          name: product.source.name,
          version:
            product.sourceVersion ?? record?.nutritionVersion.version ?? null,
          reference: product.sourceReference ?? product.source.sourceReference,
          url: mapping.sourceUrl ?? product.source.sourceUrl,
          reviewedAt: product.reviewedAt?.toISOString() ?? null,
          usageConditions: product.source.license,
        },
      };
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new AppError(
        "DATABASE_ERROR",
        "Barcode catalog is temporarily unavailable",
        { cause },
      );
    }
  }
}

export class InMemoryBarcodeProvider implements BarcodeProvider {
  private readonly products: Map<string, BarcodeLookupResult>;
  constructor(products: readonly BarcodeLookupResult[] = []) {
    this.products = new Map();
    for (const product of products) {
      const key = normalizeBarcode(product.barcode);
      if (this.products.has(key)) throw new Error("Duplicate barcode mapping");
      this.products.set(key, product);
    }
  }
  async lookup(barcode: string) {
    return this.products.get(normalizeBarcode(barcode)) ?? null;
  }
}
