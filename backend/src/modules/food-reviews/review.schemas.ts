import { z } from "zod";
import { paginationSchema } from "../../common/middleware/request-validation.js";
import {
  COOKING_METHODS,
  FOOD_CATEGORIES,
  FOOD_REGIONS,
  FOOD_TYPES,
  SERVING_UNITS,
  normalizeFoodText,
  slugifyFoodName,
} from "../foods/food-taxonomy.js";
import { validBarcode, canonicalBarcode } from "../foods/barcode.js";

const text = (max: number) => z.string().trim().min(1).max(max);
const quantity = z
  .number()
  .finite()
  .min(0.001)
  .max(999999999)
  .multipleOf(0.001);
export const reviewIdSchema = z.object({ id: z.string().uuid() }).strict();
export const revisionSchema = z
  .object({ revision: z.number().int().positive() })
  .strict();
export const rejectionSchema = revisionSchema
  .extend({ reason: text(4000) })
  .strict();
const fields = {
  nameVi: text(160).refine((v) => normalizeFoodText(v).length > 0),
  nameEn: text(160).nullable().optional(),
  description: text(4000).nullable().optional(),
  category: z.enum(FOOD_CATEGORIES).nullable().optional(),
  subcategory: text(100).nullable().optional(),
  cuisine: text(100).nullable().optional(),
  foodType: z.enum(FOOD_TYPES).nullable().optional(),
  region: z.enum(FOOD_REGIONS).nullable().optional(),
  cookingMethod: z.enum(COOKING_METHODS).nullable().optional(),
  servingUnit: z.enum(SERVING_UNITS).nullable().optional(),
  defaultServingSize: quantity.nullable().optional(),
};
const productFields = {
  productName: text(160),
  packageQuantity: quantity,
  packageUnit: z.enum(["g", "ml", "piece"]),
};
const product = z
  .object({
    ...productFields,
    brand: text(160),
    formulation: text(160),
    sourceId: z.string().uuid(),
  })
  .strict();
const nutrient = z.number().finite().min(0).max(999999999).nullable();
export const nutrientFields = [
  "calories",
  "protein",
  "carbohydrates",
  "fat",
  "fiber",
  "sugar",
  "sodium",
] as const;
const values = z
  .object({
    calories: nutrient,
    protein: nutrient,
    carbohydrates: nutrient,
    fat: nutrient,
    fiber: nutrient,
    sugar: nutrient,
    sodium: nutrient,
  })
  .strict();
const barcode = text(14)
  .refine(
    validBarcode,
    "A valid GTIN-8, UPC-A, EAN-13 or GTIN-14 check digit is required",
  )
  .transform(canonicalBarcode);
const lifecycle = z.enum(["ACTIVE", "INACTIVE", "DEPRECATED"]);
export const reviewPaginationSchema = paginationSchema.extend({
  page: z.coerce.number().int().min(1).max(100000).default(1),
});

export const operationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("CREATE_FOOD"),
      canonicalName: text(160),
      fields: z.object(fields).strict(),
      product: product.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("UPDATE_FOOD"),
      fields: z
        .object(fields)
        .partial()
        .strict()
        .refine(
          (v) => Object.keys(v).length > 0,
          "At least one field is required",
        ),
    })
    .strict(),
  z
    .object({
      type: z.literal("ADD_ALIAS"),
      alias: text(200).refine((v) => normalizeFoodText(v).length > 0),
      language: text(10)
        .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)
        .default("vi"),
    })
    .strict(),
  z
    .object({ type: z.literal("REMOVE_ALIAS"), aliasId: z.string().uuid() })
    .strict(),
  z
    .object({
      type: z.literal("PUBLISH_NUTRITION"),
      sourceId: z.string().uuid(),
      sourceVersion: text(80).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
      referenceQuantity: quantity,
      referenceUnit: z.enum(["g", "ml", "serving"]),
      preparationState: text(100),
      values,
    })
    .strict(),
  z.object({ type: z.literal("WITHDRAW_NUTRITION") }).strict(),
  z
    .object({
      type: z.literal("UPDATE_PRODUCT"),
      fields: z
        .object(productFields)
        .partial()
        .strict()
        .refine(
          (v) => Object.keys(v).length > 0,
          "At least one field is required",
        ),
    })
    .strict(),
  z.object({ type: z.literal("ADD_BARCODE"), barcode }).strict(),
  z
    .object({
      type: z.literal("SET_BARCODE_STATUS"),
      barcode,
      status: lifecycle,
    })
    .strict(),
  z.object({ type: z.literal("SET_FOOD_STATUS"), status: lifecycle }).strict(),
]);

export const evidenceSchema = z
  .object({
    kind: z.enum(["CATALOG", "PRODUCT", "NUTRITION"]),
    reference: text(1000),
    url: z
      .string()
      .url()
      .max(2000)
      .refine((v) => /^https?:\/\//.test(v))
      .optional(),
    sourceId: z.string().uuid().optional(),
    sourceVersion: text(80).optional(),
    barcode: barcode.optional(),
    brand: text(160).optional(),
    formulation: text(160).optional(),
    foodId: z.string().uuid().optional(),
  })
  .strict();

export const draftSchema = z
  .object({
    targetFoodId: z.string().uuid().optional(),
    predecessorId: z.string().uuid().optional(),
    operation: operationSchema,
    explanation: text(4000),
    evidence: z.array(evidenceSchema).min(1).max(20),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.operation.type === "CREATE_FOOD") === Boolean(v.targetFoodId))
      ctx.addIssue({
        code: "custom",
        message:
          "New foods have no target; other operations require a target food",
        path: ["targetFoodId"],
      });
    if (v.operation.type === "CREATE_FOOD") {
      if (!slugifyFoodName(v.operation.canonicalName))
        ctx.addIssue({
          code: "custom",
          message: "Canonical name must produce a searchable identity",
        });
      if (
        Boolean(v.operation.product) !==
        (v.operation.fields.foodType === "PACKAGED_FOOD")
      )
        ctx.addIssue({
          code: "custom",
          message: "Packaged foods require product identity and source",
        });
    }
  });
export const editDraftSchema = z
  .object({
    revision: z.number().int().positive(),
    operation: operationSchema,
    explanation: text(4000),
    evidence: z.array(evidenceSchema).min(1).max(20),
  })
  .strict();
export const reviewQuerySchema = reviewPaginationSchema
  .extend({
    state: z
      .enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "WITHDRAWN"])
      .optional(),
    operation: z
      .enum([
        "CREATE_FOOD",
        "UPDATE_FOOD",
        "ADD_ALIAS",
        "REMOVE_ALIAS",
        "PUBLISH_NUTRITION",
        "WITHDRAW_NUTRITION",
        "UPDATE_PRODUCT",
        "ADD_BARCODE",
        "SET_BARCODE_STATUS",
        "SET_FOOD_STATUS",
      ])
      .optional(),
    authorId: z.string().uuid().optional(),
    targetFoodId: z.string().uuid().optional(),
  })
  .strict();
export const foodQuerySchema = reviewPaginationSchema
  .extend({
    q: text(200).optional(),
    status: lifecycle.optional(),
    foodType: z.enum(FOOD_TYPES).optional(),
    category: z.enum(FOOD_CATEGORIES).optional(),
    region: z.enum(FOOD_REGIONS).optional(),
  })
  .strict();
export type ReviewOperation = z.infer<typeof operationSchema>;
export type DraftInput = z.infer<typeof draftSchema>;
export type EditDraftInput = z.infer<typeof editDraftSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type ReviewQuery = z.infer<typeof reviewQuerySchema>;
export type FoodQuery = z.infer<typeof foodQuerySchema>;
