import { z } from "zod";
import { paginationSchema } from "../../common/middleware/request-validation.js";

const id = z.string().trim().min(1).max(128);
const date = z.coerce.date();
const mealType = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "OTHER"]);
const unit = z.string().trim().min(1).max(32);
const itemSchema = z
  .object({
    foodId: id,
    quantity: z.coerce.number().positive().max(100_000),
    unit,
    displayName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();
const rangeFields = { from: date.optional(), to: date.optional() };
const withValidRange = <T extends z.AnyZodObject>(schema: T) =>
  schema.refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be before or equal to to",
    path: ["from"],
  });

export const foodSearchSchema = paginationSchema
  .extend({
    q: z.string().trim().max(160).default(""),
    locale: z.string().trim().min(2).max(16).default("vi"),
    foodType: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    subcategory: z.string().trim().min(1).max(100).optional(),
    region: z.string().trim().min(1).max(32).optional(),
    cookingMethod: z.string().trim().min(1).max(32).optional(),
    cuisine: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export const idParamsSchema = z.object({ id }).strict();
export const createMealSchema = z
  .object({
    mealType,
    capturedAt: date,
    name: z.string().trim().min(1).max(160).optional(),
    notes: z.string().trim().max(5_000).optional(),
    items: z.array(itemSchema).min(1).max(100),
  })
  .strict();
export const listMealsSchema = withValidRange(
  paginationSchema
    .extend({
      ...rangeFields,
      mealType: mealType.optional(),
      status: z
        .enum(["DRAFT", "ANALYZING", "REVIEW", "CONFIRMED", "FAILED"])
        .optional(),
    })
    .strict(),
);
export const updateMealSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    notes: z.string().trim().max(5_000).optional(),
    capturedAt: date.optional(),
    mealType: mealType.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one editable field is required",
  );
export const createAnalysisSchema = z
  .object({
    mealId: id.optional(),
    inputType: z.enum(["IMAGE", "TEXT", "BARCODE", "MANUAL"]).default("IMAGE"),
    inputReference: z.string().trim().min(1).max(2_000),
  })
  .strict();
export const confirmAnalysisSchema = z
  .object({ items: z.array(itemSchema).min(1).max(100) })
  .strict();
export const dailyNutritionSchema = z
  .object({ date: z.coerce.date() })
  .strict();
export const weeklyNutritionSchema = paginationSchema
  .extend(rangeFields)
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "from must be before or equal to to",
    path: ["from"],
  })
  .refine((value) => value.from && value.to, {
    message: "from and to are required",
    path: ["from"],
  });
export const chatSchema = z
  .object({ message: z.string().trim().min(1).max(4_000) })
  .strict();
export const recipesSchema = paginationSchema
  .extend({
    tags: z.preprocess(
      (value) =>
        typeof value === "string"
          ? value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : value,
      z.array(z.string().min(1).max(64)).max(20).optional(),
    ),
    cuisine: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export const waterSchema = z
  .object({
    amountMl: z.coerce.number().int().positive().max(100_000),
    loggedAt: date,
  })
  .strict();
export const waterListSchema = withValidRange(
  paginationSchema.extend(rangeFields).strict(),
);
export const insightsSchema = paginationSchema.strict();
export const barcodeSchema = z
  .object({
    barcode: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z-]{6,64}$/),
  })
  .strict();

export type FoodSearchQuery = z.infer<typeof foodSearchSchema>;
export type CreateMealBody = z.infer<typeof createMealSchema>;
export type ListMealsQuery = z.infer<typeof listMealsSchema>;
export type UpdateMealBody = z.infer<typeof updateMealSchema>;
export type CreateAnalysisBody = z.infer<typeof createAnalysisSchema>;
export type ConfirmAnalysisBody = z.infer<typeof confirmAnalysisSchema>;
