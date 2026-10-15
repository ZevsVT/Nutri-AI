import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../../common/errors/app-error.js";
import { normalizeFoodText, slugifyFoodName } from "../foods/food-taxonomy.js";
import { normalizeBarcode } from "../foods/barcode-normalization.js";
import { normalizeNutrition } from "../nutrition/nutrition-normalization.js";
import {
  nutrientFields,
  type DraftInput,
  type FoodQuery,
  type ReviewOperation,
  type ReviewQuery,
} from "./review.schemas.js";

export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  return value;
}

export function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(json(value))))
    .digest("hex");
}

const foodInclude = {
  aliases: { orderBy: { id: "asc" as const } },
  nutritionRecords: {
    orderBy: { id: "asc" as const },
    include: { nutritionVersion: { include: { source: true } } },
  },
  packagedProduct: {
    include: { barcodes: { orderBy: { barcode: "asc" as const } } },
  },
};
const reviewInclude = {
  revisions: { orderBy: { revision: "desc" as const }, take: 1 },
  history: {
    orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }],
    take: 100,
  },
  successor: { select: { id: true } },
};

export class ReviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async transaction<T>(
    work: (tx: ReviewTransaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
          // shortcut: serialize catalog writes with table locks; use entity revision triggers if review traffic grows.
          await tx.$executeRawUnsafe(
            'LOCK TABLE "Food", "FoodAlias", "FoodNutrition", "NutritionVersion", "FoodSource", "PackagedProduct", "FoodBarcode" IN SHARE ROW EXCLUSIVE MODE',
          );
          return work(new ReviewTransaction(tx));
        },
        { maxWait: 10000, timeout: 15000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (["P2002", "P2003", "P2025", "P2028", "P2034"].includes(error.code) ||
          (error.code === "P2010" &&
            ["40P01", "55P03"].includes(String(error.meta?.code))))
      )
        throw new AppError(
          "CONFLICT",
          "Catalog identity, ownership or revision conflicts with this proposal",
          { cause: error },
        );
      throw error;
    }
  }

  async list(query: ReviewQuery) {
    const { page, pageSize, ...where } = query;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.foodReview.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.foodReview.count({ where }),
    ]);
    return { data, total };
  }

  async foods(query: FoodQuery) {
    const { q, page, pageSize, ...filters } = query;
    const where: Prisma.FoodWhereInput = {
      ...filters,
      ...(q
        ? {
            OR: [
              { canonicalName: { contains: q, mode: "insensitive" } },
              {
                normalizedName: {
                  contains: normalizeFoodText(q),
                  mode: "insensitive",
                },
              },
              { nameVi: { contains: q, mode: "insensitive" } },
              {
                aliases: {
                  some: {
                    normalizedAlias: {
                      contains: normalizeFoodText(q),
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.food.findMany({
        where,
        orderBy: [{ nameVi: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.food.count({ where }),
    ]);
    return { data, total };
  }

  food(id: string) {
    return new ReviewTransaction(this.prisma).food(id);
  }
  review(id: string) {
    return new ReviewTransaction(this.prisma).review(id);
  }
  baseline(targetFoodId: string | undefined, operation: ReviewOperation) {
    return new ReviewTransaction(this.prisma).baseline(targetFoodId, operation);
  }
  async history(id: string, query: { page: number; pageSize: number }) {
    await this.review(id);
    const where = { reviewId: id };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.foodReviewAudit.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { content: true },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.foodReviewAudit.count({ where }),
    ]);
    return { data, total };
  }
  sources(query: { page: number; pageSize: number }) {
    return this.prisma.foodSource.findMany({
      orderBy: { id: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        provider: true,
        sourceType: true,
        sourceReference: true,
        sourceUrl: true,
      },
    });
  }
}

export class ReviewTransaction {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async review(id: string) {
    const review = await this.tx.foodReview.findUnique({
      where: { id },
      include: reviewInclude,
    });
    if (!review) throw new AppError("NOT_FOUND", "Review was not found");
    return review;
  }

  async food(id: string) {
    const food = await this.tx.food.findUnique({
      where: { id },
      include: foodInclude,
    });
    if (!food) throw new AppError("FOOD_NOT_FOUND", "Food was not found");
    return {
      ...food,
      packagedProduct: food.packagedProduct
        ? {
            ...food.packagedProduct,
            formulation:
              food.packagedProduct.formulation ?? food.packagedProduct.variant,
          }
        : null,
      barcodes: food.packagedProduct?.barcodes ?? [],
    };
  }

  source(id: string) {
    return this.tx.foodSource.findUnique({ where: { id } });
  }

  async baseline(targetFoodId: string | undefined, operation: ReviewOperation) {
    return json({
      food: targetFoodId ? await this.food(targetFoodId) : null,
      source:
        operation.type === "PUBLISH_NUTRITION"
          ? await this.source(operation.sourceId)
          : operation.type === "CREATE_FOOD" && operation.product
            ? await this.source(operation.product.sourceId)
            : null,
    });
  }

  async reserve(reviewId: string, operation: ReviewOperation) {
    if (operation.type !== "CREATE_FOOD") return;
    const slug = slugifyFoodName(operation.canonicalName);
    const normalized = normalizeFoodText(operation.fields.nameVi);
    if (
      await this.tx.food.findFirst({
        where: {
          OR: [
            { canonicalName: operation.canonicalName },
            { slug },
            { normalizedName: normalized },
          ],
        },
      })
    )
      throw new AppError(
        "CONFLICT",
        "Proposed food identity is already published",
      );
    await this.tx.foodReviewReservation.deleteMany({ where: { reviewId } });
    await this.tx.foodReviewReservation.createMany({
      data: [
        "canonical:" + operation.canonicalName,
        "slug:" + slug,
        "name:" + normalized,
      ].map((key) => ({ key, reviewId })),
    });
  }

  async create(
    id: string,
    authorId: string,
    input: DraftInput,
    baseline: Prisma.InputJsonValue,
  ) {
    await this.tx.foodReview.create({
      data: {
        id,
        authorId,
        operation: input.operation.type,
        targetFoodId: input.targetFoodId,
        predecessorId: input.predecessorId,
      },
    });
    await this.revision(id, 1, input, baseline);
    await this.audit(id, 1, authorId, "CREATED");
  }

  revision(
    reviewId: string,
    revision: number,
    input: Pick<DraftInput, "operation" | "explanation" | "evidence">,
    baseline: Prisma.InputJsonValue,
  ) {
    return this.tx.foodReviewRevision.create({
      data: {
        reviewId,
        revision,
        payload: json(input.operation),
        evidence: json(input.evidence),
        explanation: input.explanation,
        baseline,
        baselineFingerprint: fingerprint(baseline),
      },
    });
  }

  async update(
    id: string,
    expected: number,
    data: Prisma.FoodReviewUpdateManyMutationInput,
  ) {
    const result = await this.tx.foodReview.updateMany({
      where: { id, revision: expected },
      data,
    });
    if (result.count !== 1)
      throw new AppError("CONFLICT", "Review revision has changed");
  }

  audit(
    reviewId: string,
    revision: number,
    actorId: string,
    action: string,
    reason?: string,
    publication?: Prisma.InputJsonValue,
  ) {
    return this.tx.foodReviewAudit.create({
      data: { reviewId, revision, actorId, action, reason, publication },
    });
  }

  release(reviewId: string) {
    return this.tx.foodReviewReservation.deleteMany({ where: { reviewId } });
  }

  async publish(
    targetFoodId: string | null,
    operation: ReviewOperation,
    reviewId: string,
  ) {
    if (operation.type === "CREATE_FOOD") {
      const { canonicalName, fields, product } = operation;
      const food = await this.tx.food.create({
        data: {
          canonicalName,
          slug: slugifyFoodName(canonicalName),
          normalizedName: normalizeFoodText(fields.nameVi),
          ...fields,
        },
      });
      if (product)
        await this.tx.packagedProduct.create({
          data: { foodId: food.id, variant: product.formulation, ...product },
        });
      return json({ foodId: food.id });
    }
    if (!targetFoodId) throw new AppError("CONFLICT", "Target food is missing");
    const food = await this.food(targetFoodId);
    switch (operation.type) {
      case "UPDATE_FOOD":
        if (operation.fields.nameVi) {
          const reservation = await this.tx.foodReviewReservation.findUnique({
            where: {
              key: "name:" + normalizeFoodText(operation.fields.nameVi),
            },
          });
          if (reservation && reservation.reviewId !== reviewId)
            throw new AppError(
              "CONFLICT",
              "This food name is reserved by another proposal",
            );
        }
        await this.tx.food.update({
          where: { id: food.id },
          data: {
            ...operation.fields,
            ...(operation.fields.nameVi
              ? { normalizedName: normalizeFoodText(operation.fields.nameVi) }
              : {}),
          },
        });
        break;
      case "SET_FOOD_STATUS":
        await this.tx.food.update({
          where: { id: food.id },
          data: {
            status: operation.status,
            isActive: operation.status === "ACTIVE",
          },
        });
        break;
      case "ADD_ALIAS": {
        const normalizedAlias = normalizeFoodText(operation.alias);
        const existing = await this.tx.foodAlias.findUnique({
          where: {
            normalizedAlias_language: {
              normalizedAlias,
              language: operation.language,
            },
          },
        });
        if (existing && (existing.foodId !== food.id || existing.isActive))
          throw new AppError("CONFLICT", "Alias is already owned or active");
        await this.tx.foodAlias.upsert({
          where: {
            normalizedAlias_language: {
              normalizedAlias,
              language: operation.language,
            },
          },
          create: {
            foodId: food.id,
            alias: operation.alias,
            normalizedAlias,
            language: operation.language,
          },
          update: { isActive: true, alias: operation.alias },
        });
        break;
      }
      case "REMOVE_ALIAS": {
        const result = await this.tx.foodAlias.updateMany({
          where: { id: operation.aliasId, foodId: food.id, isActive: true },
          data: { isActive: false },
        });
        if (result.count !== 1)
          throw new AppError("CONFLICT", "Alias is not active on this food");
        break;
      }
      case "PUBLISH_NUTRITION": {
        const source = await this.source(operation.sourceId);
        if (!source)
          throw new AppError("CONFLICT", "Nutrition source is missing");
        if (food.packagedProduct && food.packagedProduct.sourceId !== source.id)
          throw new AppError(
            "CONFLICT",
            "Nutrition source does not match the packaged product",
          );
        const normalized = normalizeNutrition({
          ...operation,
          foodId: food.id,
          source: source.name,
          values: operation.values,
        });
        const existingVersion = await this.tx.nutritionVersion.findUnique({
          where: {
            sourceId_version: {
              sourceId: source.id,
              version: operation.sourceVersion,
            },
          },
        });
        // A source-version is immutable; corrections must supply a new version.
        if (existingVersion)
          throw new AppError("CONFLICT", "Use a new nutrition source version");
        const version = await this.tx.nutritionVersion.create({
          data: {
            sourceId: source.id,
            version: operation.sourceVersion,
            effectiveFrom: new Date(),
          },
        });
        await this.tx.foodNutrition.updateMany({
          where: { foodId: food.id, isActive: true },
          data: { isActive: false },
        });
        await this.tx.foodNutrition.create({
          data: {
            foodId: food.id,
            nutritionVersionId: version.id,
            servingAmount: normalized.referenceQuantity,
            servingUnit: normalized.referenceUnit,
            referenceBasis: normalized.referenceBasis,
            preparationState: operation.preparationState,
            ...Object.fromEntries(
              nutrientFields.map((k) => [k, normalized[k]]),
            ),
          },
        });
        if (food.packagedProduct)
          await this.tx.packagedProduct.update({
            where: { foodId: food.id },
            data: { currentNutritionVersionId: version.id },
          });
        return json({
          foodId: food.id,
          nutritionVersionId: version.id,
          sourceId: source.id,
        });
      }
      case "WITHDRAW_NUTRITION":
        await this.tx.foodNutrition.updateMany({
          where: { foodId: food.id },
          data: { isActive: false },
        });
        if (food.packagedProduct)
          await this.tx.packagedProduct.update({
            where: { foodId: food.id },
            data: { currentNutritionVersionId: null },
          });
        break;
      case "UPDATE_PRODUCT":
        if (!food.packagedProduct)
          throw new AppError("CONFLICT", "Food has no packaged product");
        await this.tx.packagedProduct.update({
          where: { foodId: food.id },
          data: operation.fields,
        });
        break;
      case "ADD_BARCODE":
        if (!food.packagedProduct)
          throw new AppError("CONFLICT", "Barcodes require a packaged product");
        await this.tx.foodBarcode.create({
          data: {
            barcode: operation.barcode,
            normalizedBarcode: normalizeBarcode(operation.barcode),
            foodId: food.id,
          },
        });
        break;
      case "SET_BARCODE_STATUS": {
        const result = await this.tx.foodBarcode.updateMany({
          where: { barcode: operation.barcode, foodId: food.id },
          data: { status: operation.status },
        });
        if (result.count !== 1)
          throw new AppError(
            "CONFLICT",
            "Barcode does not belong to this food",
          );
        break;
      }
    }
    return json({ foodId: food.id });
  }
}

export type ReviewRecord = Awaited<ReturnType<ReviewTransaction["review"]>>;
export type PublishedFood = Awaited<ReturnType<ReviewTransaction["food"]>>;
