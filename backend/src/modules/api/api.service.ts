import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../../common/errors/app-error.js";
import { NoopBarcodeProvider, type BarcodeProvider } from "../../integrations/barcode/barcode-provider.js";

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
}
interface ScaledNutrition extends NutritionTotals { sugar: number; sodium: number }

export interface FoodDto {
  id: string;
  name: { vi: string; en: string | null };
  category: string | null;
  cuisine: string | null;
  nutrition?: Record<string, unknown>;
}

export interface MealItemInput {
  foodId: string;
  quantity: number;
  unit: string;
  displayName?: string;
}

export interface MealInput {
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "OTHER";
  capturedAt: Date;
  name?: string;
  notes?: string;
  items: MealItemInput[];
}

export interface MealDto {
  id: string;
  mealType: MealInput["mealType"];
  name: string;
  capturedAt: string;
  status: string;
  notes: string | null;
  confirmedAt: string | null;
  items: Array<MealItemInput & { id: string; nutrition?: NutritionTotals }>;
  totals: NutritionTotals;
}

export interface AnalysisDto {
  analysisId: string;
  mealId: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  inputType: string;
  inputReference: string | null;
  predictions: Array<{
    id: string;
    predictedName: string;
    foodId: string | null;
    quantity: number | null;
    unit: string | null;
    confidence: number | null;
  }>;
  error?: { code: string; message: string };
}

export interface BusinessApiService {
  searchFoods(input: { query: string; locale: string; page: number; pageSize: number }): Promise<{ data: FoodDto[]; total: number }>;
  getFood(userId: string, id: string): Promise<FoodDto>;
  createMeal(userId: string, input: MealInput): Promise<MealDto>;
  listMeals(userId: string, input: { from?: Date; to?: Date; mealType?: MealInput["mealType"]; status?: string; page: number; pageSize: number }): Promise<{ data: MealDto[]; total: number }>;
  getMeal(userId: string, id: string): Promise<MealDto>;
  updateMeal(userId: string, id: string, input: { name?: string; notes?: string; capturedAt?: Date; mealType?: MealInput["mealType"] }): Promise<MealDto>;
  deleteMeal(userId: string, id: string): Promise<void>;
  createAnalysis(userId: string, input: { mealId?: string; inputType: string; inputReference: string }): Promise<AnalysisDto>;
  getAnalysis(userId: string, id: string): Promise<AnalysisDto>;
  confirmAnalysis(userId: string, id: string, items: MealItemInput[]): Promise<MealDto>;
  dailyNutrition(userId: string, date: Date): Promise<Record<string, unknown>>;
  weeklyNutrition(userId: string, from: Date, to: Date): Promise<Record<string, unknown>>;
  chat(userId: string, message: string): Promise<{ message: string; context: string[] }>;
  listRecipes(input: { tags?: string[]; cuisine?: string; page: number; pageSize: number }): Promise<{ data: Record<string, unknown>[]; total: number }>;
  createWater(userId: string, input: { amountMl: number; loggedAt: Date }): Promise<Record<string, unknown>>;
  listWater(userId: string, input: { from?: Date; to?: Date; page: number; pageSize: number }): Promise<{ data: Record<string, unknown>[]; total: number }>;
  listInsights(userId: string, input: { page: number; pageSize: number }): Promise<{ data: Record<string, unknown>[]; total: number }>;
  scanBarcode(userId: string, barcode: string): Promise<Record<string, unknown>>;
}

const emptyTotals = (): NutritionTotals => ({ calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 });
const addTotals = (left: NutritionTotals, right: NutritionTotals): NutritionTotals => ({
  calories: left.calories + right.calories,
  protein: left.protein + right.protein,
  carbohydrates: left.carbohydrates + right.carbohydrates,
  fat: left.fat + right.fat,
  fiber: left.fiber + right.fiber,
});
const pageOf = <T>(rows: T[], page: number, pageSize: number) => rows.slice((page - 1) * pageSize, page * pageSize);

interface MemoryFood {
  id: string;
  name: { vi: string; en: string | null };
  category: string | null;
  cuisine: string | null;
  aliases: string[];
  nutrition: NutritionTotals;
}
interface MemoryMeal extends MealDto { userId: string; deleted: boolean; }
interface MemoryAnalysis extends AnalysisDto { userId: string; corrections?: MealItemInput[]; }
type NutritionRecordLike = { nutritionVersionId: string; servingAmount: unknown; servingUnit: string; calories: unknown; protein: unknown; carbohydrates: unknown; fat: unknown; fiber: unknown; sugar: unknown; sodium: unknown; nutritionVersion: { sourceId: string; effectiveFrom: Date; version: string; source: { name: string; provider: string } } };
type MealItemLike = { id: string; foodId: string | null; quantity: unknown; unit: string; displayName: string; nutritionSnapshot: { calories: unknown; protein: unknown; carbohydrates: unknown; fat: unknown; fiber: unknown } | null };
type MealLike = { id: string; mealType: MealDto["mealType"]; name: string; capturedAt: Date; status: string; notes: string | null; confirmedAt: Date | null; items: MealItemLike[] };
type PredictionLike = { id: string; predictedName: string; foodId: string | null; estimatedQuantity: unknown; estimatedUnit: string | null; confidence: unknown };

/** Deterministic service used when the app is booted without DATABASE_URL and in API contract tests. */
export class InMemoryBusinessApiService implements BusinessApiService {
  constructor(private readonly barcodeProvider: BarcodeProvider = new NoopBarcodeProvider()) {}
  private readonly foods: MemoryFood[] = [{ id: "food-demo", name: { vi: "Phở bò", en: "Beef pho" }, category: "NOODLE", cuisine: "VIETNAMESE", aliases: ["pho", "phở"], nutrition: emptyTotals() }];
  private readonly meals: MemoryMeal[] = [];
  private readonly analyses: MemoryAnalysis[] = [];
  private readonly water: Array<Record<string, unknown> & { userId: string; loggedAt: Date }> = [];

  async searchFoods({ query, page, pageSize }: { query: string; locale: string; page: number; pageSize: number }) {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return { data: [], total: 0 };
    const found = this.foods.filter((food) => [food.name.vi, food.name.en ?? "", food.id, ...food.aliases].some((field) => field.toLocaleLowerCase().includes(value)));
    return { data: pageOf(found, page, pageSize).map((food) => this.publicFood(food)), total: found.length };
  }

  async getFood(_userId: string, id: string) {
    const food = this.foods.find((candidate) => candidate.id === id);
    if (!food) throw new AppError("FOOD_NOT_FOUND", "Food was not found");
    return this.publicFood(food, true);
  }

  async createMeal(userId: string, input: MealInput) {
    const items = input.items.map((item) => this.toMealItem(item));
    const meal: MemoryMeal = { id: randomUUID(), userId, mealType: input.mealType, name: input.name ?? "Untitled meal", capturedAt: input.capturedAt.toISOString(), status: "CONFIRMED", notes: input.notes ?? null, confirmedAt: new Date().toISOString(), items, totals: items.reduce((sum, item) => addTotals(sum, item.nutrition ?? emptyTotals()), emptyTotals()), deleted: false };
    this.meals.push(meal);
    return this.publicMeal(meal);
  }

  async listMeals(userId: string, input: { from?: Date; to?: Date; mealType?: MealInput["mealType"]; status?: string; page: number; pageSize: number }) {
    const rows = this.meals.filter((meal) => !meal.deleted && meal.userId === userId && (!input.from || new Date(meal.capturedAt) >= input.from) && (!input.to || new Date(meal.capturedAt) <= input.to) && (!input.mealType || meal.mealType === input.mealType) && (!input.status || meal.status === input.status));
    rows.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    return { data: pageOf(rows.map((meal) => this.publicMeal(meal)), input.page, input.pageSize), total: rows.length };
  }

  async getMeal(userId: string, id: string) {
    const meal = this.findMeal(userId, id);
    return this.publicMeal(meal);
  }

  async updateMeal(userId: string, id: string, input: { name?: string; notes?: string; capturedAt?: Date; mealType?: MealInput["mealType"] }) {
    const meal = this.findMeal(userId, id);
    if (meal.status === "CONFIRMED" && (input.mealType || input.capturedAt)) throw new AppError("INVALID_STATE", "Confirmed meal nutrition cannot be changed");
    Object.assign(meal, input.name === undefined ? {} : { name: input.name }, input.notes === undefined ? {} : { notes: input.notes }, input.capturedAt === undefined ? {} : { capturedAt: input.capturedAt.toISOString() }, input.mealType === undefined ? {} : { mealType: input.mealType });
    return this.publicMeal(meal);
  }

  async deleteMeal(userId: string, id: string) { this.findMeal(userId, id).deleted = true; }

  async createAnalysis(userId: string, input: { mealId?: string; inputType: string; inputReference: string }) {
    let mealId = input.mealId;
    if (mealId) this.findMeal(userId, mealId);
    else mealId = (await this.createMeal(userId, { mealType: "OTHER", capturedAt: new Date(), items: [] })).id;
    const analysis: MemoryAnalysis = { analysisId: randomUUID(), mealId, userId, status: "PENDING", inputType: input.inputType, inputReference: input.inputReference, predictions: [] };
    this.analyses.push(analysis);
    return this.publicAnalysis(analysis);
  }

  async getAnalysis(userId: string, id: string) { return this.publicAnalysis(this.findAnalysis(userId, id)); }

  async confirmAnalysis(userId: string, id: string, items: MealItemInput[]) {
    const analysis = this.findAnalysis(userId, id);
    if (analysis.status === "FAILED") throw new AppError("ANALYSIS_FAILED", "Meal analysis failed");
    if (analysis.status === "PENDING" || analysis.status === "PROCESSING") throw new AppError("ANALYSIS_NOT_READY", "Meal analysis is not ready");
    const meal = this.findMeal(userId, analysis.mealId);
    const mapped = items.map((item) => this.toMealItem(item));
    meal.items = mapped; meal.status = "CONFIRMED"; meal.confirmedAt = new Date().toISOString(); meal.totals = mapped.reduce((sum, item) => addTotals(sum, item.nutrition ?? emptyTotals()), emptyTotals());
    analysis.corrections = items;
    return this.publicMeal(meal);
  }

  async dailyNutrition(userId: string, date: Date) { const day = date.toISOString().slice(0, 10); const meals = this.meals.filter((meal) => meal.userId === userId && !meal.deleted && meal.status === "CONFIRMED" && meal.capturedAt.slice(0, 10) === day); return this.summary(meals); }
  async weeklyNutrition(userId: string, from: Date, to: Date) { const meals = this.meals.filter((meal) => meal.userId === userId && !meal.deleted && meal.status === "CONFIRMED" && new Date(meal.capturedAt) >= from && new Date(meal.capturedAt) <= to); return this.summary(meals); }
  async chat(userId: string, message: string) { const summary = await this.dailyNutrition(userId, new Date()); return { message: `Based on your confirmed meals, ${message.trim()} — today’s recorded calories are ${summary.totals.calories}.`, context: ["confirmed_meals", "daily_nutrition"] }; }
  async listRecipes(input: { tags?: string[]; cuisine?: string; page: number; pageSize: number }) { void input; return { data: [], total: 0 }; }
  async createWater(userId: string, input: { amountMl: number; loggedAt: Date }) { const row = { id: randomUUID(), userId, amountMl: input.amountMl, loggedAt: input.loggedAt.toISOString(), createdAt: new Date().toISOString() }; this.water.push({ ...row, loggedAt: input.loggedAt }); return row; }
  async listWater(userId: string, input: { from?: Date; to?: Date; page: number; pageSize: number }) { const rows = this.water.filter((row) => row.userId === userId && (!input.from || row.loggedAt >= input.from) && (!input.to || row.loggedAt <= input.to)); return { data: pageOf(rows, input.page, input.pageSize), total: rows.length }; }
  async listInsights(userId: string, input: { page: number; pageSize: number }) { void userId; void input; return { data: [], total: 0 }; }
  async scanBarcode(_userId: string, barcode: string) { const product = await this.barcodeProvider.lookup(barcode); return { barcode, status: product ? "RESOLVED" : "UNRESOLVED", product, source: product?.source ?? null }; }

  private findMeal(userId: string, id: string) { const meal = this.meals.find((candidate) => candidate.id === id && candidate.userId === userId && !candidate.deleted); if (!meal) throw new AppError("MEAL_NOT_FOUND", "Meal was not found"); return meal; }
  private findAnalysis(userId: string, id: string) { const analysis = this.analyses.find((candidate) => candidate.analysisId === id && candidate.userId === userId); if (!analysis) throw new AppError("ANALYSIS_NOT_FOUND", "Meal analysis was not found"); return analysis; }
  private toMealItem(item: MealItemInput) { if (item.quantity <= 0) throw new AppError("VALIDATION_ERROR", "Quantity must be positive"); const food = this.foods.find((candidate) => candidate.id === item.foodId); if (!food) throw new AppError("FOOD_NOT_FOUND", "Food was not found"); return { ...item, id: randomUUID(), displayName: item.displayName ?? food.name.vi, nutrition: emptyTotals() }; }
  private publicFood(food: MemoryFood, includeNutrition = false): FoodDto { return { id: food.id, name: food.name, category: food.category, cuisine: food.cuisine, ...(includeNutrition ? { nutrition: { ...food.nutrition } } : {}) }; }
  private publicMeal(meal: MemoryMeal): MealDto { const { userId, deleted, ...publicMeal } = meal; void userId; void deleted; return publicMeal; }
  private publicAnalysis(analysis: MemoryAnalysis): AnalysisDto { const { userId, corrections, ...publicAnalysis } = analysis; void userId; void corrections; return publicAnalysis; }
  private summary(meals: MemoryMeal[]) { return { period: { from: meals.at(-1)?.capturedAt ?? null, to: meals[0]?.capturedAt ?? null }, totals: meals.reduce((sum, meal) => addTotals(sum, meal.totals), emptyTotals()), mealCount: meals.length, meals: meals.map((meal) => this.publicMeal(meal)) }; }
}

/** Production adapter hook. It is deliberately explicit so persistence can be supplied without leaking Prisma into HTTP handlers. */
export class PrismaBusinessApiService implements BusinessApiService {
  constructor(public readonly prisma: PrismaClient, private readonly barcodeProvider: BarcodeProvider = new NoopBarcodeProvider()) {}

  async searchFoods({ query, page, pageSize }: { query: string; locale: string; page: number; pageSize: number }) {
    if (!query.trim()) return { data: [], total: 0 };
    const where = { isActive: true, OR: [{ canonicalName: { contains: query, mode: "insensitive" as const } }, { nameVi: { contains: query, mode: "insensitive" as const } }, { nameEn: { contains: query, mode: "insensitive" as const } }, { aliases: { some: { alias: { contains: query, mode: "insensitive" as const } } } }] };
    const [rows, total] = await this.prisma.$transaction([this.prisma.food.findMany({ where, orderBy: { nameVi: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: { aliases: true } }), this.prisma.food.count({ where })]);
    return { data: rows.map((food) => this.foodDto(food)), total };
  }

  async getFood(_userId: string, id: string) {
    const food = await this.prisma.food.findFirst({ where: { id, isActive: true }, include: { nutritionRecords: { include: { nutritionVersion: { include: { source: true } } } } } });
    if (!food) throw new AppError("FOOD_NOT_FOUND", "Food was not found");
    return this.foodDto(food, true);
  }

  async createMeal(userId: string, input: MealInput) {
    const mealId = await this.prisma.$transaction(async (tx) => {
      const foods = await tx.food.findMany({ where: { id: { in: input.items.map((item) => item.foodId) }, isActive: true }, include: { nutritionRecords: { include: { nutritionVersion: { include: { source: true } } } } } });
      if (foods.length !== new Set(input.items.map((item) => item.foodId)).size) throw new AppError("FOOD_NOT_FOUND", "One or more foods were not found");
      const meal = await tx.meal.create({ data: { userId, mealType: input.mealType, capturedAt: input.capturedAt, name: input.name ?? "Untitled meal", notes: input.notes, status: "CONFIRMED", confirmedAt: new Date() } });
      const totals = emptyTotals();
      for (const item of input.items) {
        const food = foods.find((candidate) => candidate.id === item.foodId);
        const nutrition = this.latestNutrition(food?.nutritionRecords ?? []);
        if (!food || !nutrition) throw new AppError("NUTRITION_DATA_UNAVAILABLE", "Nutrition data is unavailable for one or more foods");
        const itemNutrition = this.scaledNutrition(nutrition, item.quantity);
        Object.assign(totals, addTotals(totals, itemNutrition));
        const createdItem = await tx.mealItem.create({ data: { mealId: meal.id, foodId: food.id, quantity: item.quantity, unit: item.unit, displayName: item.displayName ?? food.nameVi } });
        await tx.mealItemNutrition.create({ data: { mealItemId: createdItem.id, nutritionVersionId: nutrition.nutritionVersionId, sourceId: nutrition.nutritionVersion.sourceId, servingAmount: item.quantity, servingUnit: item.unit, ...itemNutrition, estimated: false } });
      }
      await tx.nutritionAnalysis.create({ data: { mealId: meal.id, status: "COMPLETED", totalCalories: totals.calories, totalProtein: totals.protein, totalCarbohydrates: totals.carbohydrates, totalFat: totals.fat, totalFiber: totals.fiber, method: "versioned_food_source" } });
      return meal.id;
    });
    return this.getMeal(userId, mealId);
  }

  async listMeals(userId: string, input: { from?: Date; to?: Date; mealType?: MealInput["mealType"]; status?: string; page: number; pageSize: number }) {
    const where: Prisma.MealWhereInput = { userId, deletedAt: null, ...(input.mealType ? { mealType: input.mealType } : {}), ...(input.status ? { status: input.status as Prisma.MealWhereInput["status"] } : {}), capturedAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } };
    const [rows, total] = await this.prisma.$transaction([this.prisma.meal.findMany({ where, orderBy: { capturedAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize, include: { items: { include: { food: true, nutritionSnapshot: true } }, nutrition: true } }), this.prisma.meal.count({ where })]);
    return { data: rows.map((meal) => this.mealDto(meal)), total };
  }

  async getMeal(userId: string, id: string) {
    const meal = await this.prisma.meal.findFirst({ where: { id, userId, deletedAt: null }, include: { items: { include: { food: true, nutritionSnapshot: true } }, nutrition: true } });
    if (!meal) throw new AppError("MEAL_NOT_FOUND", "Meal was not found");
    return this.mealDto(meal);
  }

  async updateMeal(userId: string, id: string, input: { name?: string; notes?: string; capturedAt?: Date; mealType?: MealInput["mealType"] }) {
    const existing = await this.prisma.meal.findFirst({ where: { id, userId, deletedAt: null }, select: { id: true, status: true } });
    if (!existing) throw new AppError("MEAL_NOT_FOUND", "Meal was not found");
    if (existing.status === "CONFIRMED" && (input.mealType || input.capturedAt)) throw new AppError("INVALID_STATE", "Confirmed meal nutrition cannot be changed");
    await this.prisma.meal.update({ where: { id }, data: input });
    return this.getMeal(userId, id);
  }

  async deleteMeal(userId: string, id: string) { const result = await this.prisma.meal.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt: new Date(), status: "DELETED" } }); if (result.count === 0) throw new AppError("MEAL_NOT_FOUND", "Meal was not found"); }

  async createAnalysis(userId: string, input: { mealId?: string; inputType: string; inputReference: string }) {
    let mealId = input.mealId;
    if (mealId) { const meal = await this.prisma.meal.findFirst({ where: { id: mealId, userId, deletedAt: null }, select: { id: true } }); if (!meal) throw new AppError("MEAL_NOT_FOUND", "Meal was not found"); }
    else mealId = (await this.prisma.meal.create({ data: { userId, mealType: "OTHER", capturedAt: new Date(), status: "ANALYZING", imageUrl: input.inputReference }, select: { id: true } })).id;
    const analysis = await this.prisma.aIAnalysis.create({ data: { userId, mealId, provider: "application", model: "pending", inputType: input.inputType as "IMAGE" | "TEXT" | "BARCODE" | "MANUAL", inputReference: input.inputReference } });
    return this.analysisDto(analysis, []);
  }

  async getAnalysis(userId: string, id: string) {
    const analysis = await this.prisma.aIAnalysis.findFirst({ where: { id, userId }, include: { predictions: true } });
    if (!analysis) throw new AppError("ANALYSIS_NOT_FOUND", "Meal analysis was not found");
    return this.analysisDto(analysis, analysis.predictions);
  }

  async confirmAnalysis(userId: string, id: string, items: MealItemInput[]) {
    const mealId = await this.prisma.$transaction(async (tx) => {
      const analysis = await tx.aIAnalysis.findFirst({ where: { id, userId }, select: { id: true, mealId: true, status: true } });
      if (!analysis) throw new AppError("ANALYSIS_NOT_FOUND", "Meal analysis was not found");
      if (analysis.status === "FAILED") throw new AppError("ANALYSIS_FAILED", "Meal analysis failed");
      if (analysis.status !== "COMPLETED") throw new AppError("ANALYSIS_NOT_READY", "Meal analysis is not ready");
      const meal = await tx.meal.findFirst({ where: { id: analysis.mealId, userId, deletedAt: null }, select: { id: true, status: true, confirmedAt: true } });
      if (!meal) throw new AppError("MEAL_NOT_FOUND", "Meal was not found");
      if (meal.status === "CONFIRMED" && meal.confirmedAt) return meal.id;
      const foods = await tx.food.findMany({ where: { id: { in: items.map((item) => item.foodId) }, isActive: true }, include: { nutritionRecords: { include: { nutritionVersion: { include: { source: true } } } } } });
      if (foods.length !== new Set(items.map((item) => item.foodId)).size) throw new AppError("FOOD_NOT_FOUND", "One or more foods were not found");
      await tx.mealItem.deleteMany({ where: { mealId: meal.id } });
      const totals = emptyTotals();
      for (const item of items) {
        const food = foods.find((candidate) => candidate.id === item.foodId);
        const nutrition = this.latestNutrition(food?.nutritionRecords ?? []);
        if (!food || !nutrition) throw new AppError("NUTRITION_DATA_UNAVAILABLE", "Nutrition data is unavailable for one or more foods");
        const values = this.scaledNutrition(nutrition, item.quantity); Object.assign(totals, addTotals(totals, values));
        const created = await tx.mealItem.create({ data: { mealId: meal.id, foodId: food.id, quantity: item.quantity, unit: item.unit, displayName: item.displayName ?? food.nameVi } });
        await tx.mealItemNutrition.create({ data: { mealItemId: created.id, nutritionVersionId: nutrition.nutritionVersionId, sourceId: nutrition.nutritionVersion.sourceId, servingAmount: item.quantity, servingUnit: item.unit, ...values, estimated: false } });
        await tx.aICorrection.create({ data: { analysisId: analysis.id, userId, correctionType: "FOOD_ADDED", correctedFoodId: food.id, correctedQuantity: item.quantity, correctedUnit: item.unit } });
      }
      await tx.nutritionAnalysis.upsert({ where: { mealId: meal.id }, update: { status: "COMPLETED", totalCalories: totals.calories, totalProtein: totals.protein, totalCarbohydrates: totals.carbohydrates, totalFat: totals.fat, totalFiber: totals.fiber }, create: { mealId: meal.id, status: "COMPLETED", totalCalories: totals.calories, totalProtein: totals.protein, totalCarbohydrates: totals.carbohydrates, totalFat: totals.fat, totalFiber: totals.fiber } });
      await tx.meal.update({ where: { id: meal.id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
      await tx.aIAnalysis.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
      return meal.id;
    });
    return this.getMeal(userId, mealId);
  }

  async dailyNutrition(userId: string, date: Date) { const from = new Date(date); from.setUTCHours(0, 0, 0, 0); const to = new Date(from); to.setUTCDate(to.getUTCDate() + 1); return this.aggregateNutrition(userId, from, to); }
  async weeklyNutrition(userId: string, from: Date, to: Date) { return this.aggregateNutrition(userId, from, to); }
  async chat(userId: string, message: string) { const summary = await this.dailyNutrition(userId, new Date()); return { message: `Based on your confirmed meals, ${message.trim()} — today’s recorded calories are ${summary.totals.calories}.`, context: ["confirmed_meals", "daily_nutrition"] }; }
  async listRecipes(input: { tags?: string[]; cuisine?: string; page: number; pageSize: number }) { const { cuisine, page, pageSize } = input; void input.tags; const where: Prisma.RecipeWhereInput = { status: "PUBLISHED", ...(cuisine ? { OR: [{ nameVi: { contains: cuisine, mode: "insensitive" } }, { nameEn: { contains: cuisine, mode: "insensitive" } }] } : {}) }; const [rows, total] = await this.prisma.$transaction([this.prisma.recipe.findMany({ where, orderBy: { nameVi: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: { nutrition: true, ingredients: true } }), this.prisma.recipe.count({ where })]); return { data: rows.map((recipe) => ({ id: recipe.id, name: { vi: recipe.nameVi, en: recipe.nameEn }, description: recipe.description, servings: recipe.servings, prepTime: recipe.prepTime, cookTime: recipe.cookTime, difficulty: recipe.difficulty, nutrition: recipe.nutrition })), total }; }
  async createWater(userId: string, input: { amountMl: number; loggedAt: Date }) { return this.prisma.waterLog.create({ data: { userId, amountMl: input.amountMl, loggedAt: input.loggedAt }, select: { id: true, amountMl: true, loggedAt: true, createdAt: true } }); }
  async listWater(userId: string, input: { from?: Date; to?: Date; page: number; pageSize: number }) { const where: Prisma.WaterLogWhereInput = { userId, loggedAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } }; const [rows, total] = await this.prisma.$transaction([this.prisma.waterLog.findMany({ where, orderBy: { loggedAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: { id: true, amountMl: true, loggedAt: true, createdAt: true } }), this.prisma.waterLog.count({ where })]); return { data: rows, total }; }
  async listInsights(userId: string, { page, pageSize }: { page: number; pageSize: number }) { const where = { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }; const [rows, total] = await this.prisma.$transaction([this.prisma.nutritionInsight.findMany({ where, orderBy: { periodStart: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), this.prisma.nutritionInsight.count({ where })]); return { data: rows, total }; }
  async scanBarcode(_userId: string, barcode: string) { const product = await this.barcodeProvider.lookup(barcode); return { barcode, status: product ? "RESOLVED" : "UNRESOLVED", product, source: product?.source ?? null }; }

  private foodDto(food: { id: string; nameVi: string; nameEn: string | null; category: string | null; cuisine: string | null; nutritionRecords?: readonly NutritionRecordLike[] }, includeNutrition = false): FoodDto {
    const dto: FoodDto = { id: food.id, name: { vi: food.nameVi, en: food.nameEn }, category: food.category, cuisine: food.cuisine };
    if (includeNutrition && food.nutritionRecords?.length) { const record = this.latestNutrition(food.nutritionRecords); if (record) dto.nutrition = { servingAmount: Number(record.servingAmount), servingUnit: record.servingUnit, calories: Number(record.calories), protein: Number(record.protein), carbohydrates: Number(record.carbohydrates), fat: Number(record.fat), fiber: Number(record.fiber), source: record.nutritionVersion.source.name, provider: record.nutritionVersion.source.provider, version: record.nutritionVersion.version }; }
    return dto;
  }
  private latestNutrition(records: readonly NutritionRecordLike[]) { return [...records].sort((a, b) => new Date(b.nutritionVersion.effectiveFrom).getTime() - new Date(a.nutritionVersion.effectiveFrom).getTime())[0]; }
  private scaledNutrition(record: NutritionRecordLike, quantity: number): ScaledNutrition { const factor = quantity / Number(record.servingAmount); return { calories: Number(record.calories) * factor, protein: Number(record.protein) * factor, carbohydrates: Number(record.carbohydrates) * factor, fat: Number(record.fat) * factor, fiber: Number(record.fiber) * factor, sugar: Number(record.sugar) * factor, sodium: Number(record.sodium) * factor }; }
  private mealDto(meal: MealLike): MealDto { const items = meal.items.map((item) => ({ id: item.id, foodId: item.foodId ?? "", quantity: Number(item.quantity), unit: item.unit, displayName: item.displayName, nutrition: item.nutritionSnapshot ? { calories: Number(item.nutritionSnapshot.calories), protein: Number(item.nutritionSnapshot.protein), carbohydrates: Number(item.nutritionSnapshot.carbohydrates), fat: Number(item.nutritionSnapshot.fat), fiber: Number(item.nutritionSnapshot.fiber) } : undefined })); return { id: meal.id, mealType: meal.mealType, name: meal.name, capturedAt: meal.capturedAt.toISOString(), status: meal.status, notes: meal.notes, confirmedAt: meal.confirmedAt?.toISOString() ?? null, items, totals: items.reduce((sum: NutritionTotals, item) => addTotals(sum, item.nutrition ?? emptyTotals()), emptyTotals()) }; }
  private analysisDto(analysis: { id: string; mealId: string; status: string; inputType: string; inputReference: string | null }, predictions: readonly PredictionLike[]): AnalysisDto { return { analysisId: analysis.id, mealId: analysis.mealId, status: analysis.status === "RUNNING" ? "PROCESSING" : analysis.status === "COMPLETED" ? "READY" : analysis.status as AnalysisDto["status"], inputType: analysis.inputType, inputReference: analysis.inputReference ?? null, predictions: predictions.map((prediction) => ({ id: prediction.id, predictedName: prediction.predictedName, foodId: prediction.foodId, quantity: prediction.estimatedQuantity === null ? null : Number(prediction.estimatedQuantity), unit: prediction.estimatedUnit, confidence: prediction.confidence === null ? null : Number(prediction.confidence) })) }; }
  private async aggregateNutrition(userId: string, from: Date, to: Date) { const meals = await this.prisma.meal.findMany({ where: { userId, deletedAt: null, status: "CONFIRMED", capturedAt: { gte: from, lt: to } }, include: { items: { include: { nutritionSnapshot: true } } }, orderBy: { capturedAt: "asc" } }); const totals = meals.flatMap((meal) => meal.items).reduce((sum, item) => addTotals(sum, item.nutritionSnapshot ? { calories: Number(item.nutritionSnapshot.calories), protein: Number(item.nutritionSnapshot.protein), carbohydrates: Number(item.nutritionSnapshot.carbohydrates), fat: Number(item.nutritionSnapshot.fat), fiber: Number(item.nutritionSnapshot.fiber) } : emptyTotals()), emptyTotals()); return { period: { from: from.toISOString(), to: to.toISOString() }, totals, mealCount: meals.length, meals: meals.map((meal) => this.mealDto(meal)) }; }
}
