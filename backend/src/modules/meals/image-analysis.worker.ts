import type { Prisma, PrismaClient } from "@prisma/client";
import type { FastifyBaseLogger } from "fastify";
import {
  visionResultSchema,
  type MealVisionProvider,
} from "../../integrations/ai/openai-vision.js";
import { activeFoodWhere } from "../foods/food.repository.js";
import { normalizeFoodText } from "../foods/food-taxonomy.js";
import { latestNutrition } from "../nutrition/nutrition-record.js";
import type { StorageService } from "../storage/storage.service.js";
import { estimatePortion } from "./portion-estimation.js";

const unavailableMessage =
  "Could not analyze this photo. Try again or enter the meal manually.";

export class ImageAnalysisWorker {
  private timer?: NodeJS.Timeout;
  private running?: Promise<unknown>;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    private readonly vision: MealVisionProvider,
    private readonly logger: FastifyBaseLogger,
  ) {}

  start() {
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = this.processNext()
        .catch(() => this.logger.error("image_analysis_worker_failed"))
        .finally(() => {
          this.running = undefined;
        });
    }, 1000);
    this.timer.unref();
  }

  async stop() {
    clearInterval(this.timer);
    await this.running;
  }

  async processNext() {
    const scope = {
      provider: this.vision.provider,
      inputType: "IMAGE",
      meal: { deletedAt: null, status: "ANALYZING" },
    } satisfies Prisma.AIAnalysisWhereInput;
    const stale = await this.prisma.aIAnalysis.findFirst({
      where: {
        ...scope,
        status: "RUNNING",
        startedAt: { lt: new Date(Date.now() - 5 * 60_000) },
      },
    });
    if (stale) await this.fail(stale.id, stale.mealId);

    const job = await this.prisma.aIAnalysis.findFirst({
      where: { ...scope, status: "PENDING" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!job) return false;

    const claim = await this.prisma.aIAnalysis.updateMany({
      where: { id: job.id, status: "PENDING", meal: scope.meal },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        model: this.vision.model,
      },
    });
    if (!claim.count) return false;

    try {
      const objectId = this.storage.parseReference(job.inputReference ?? "");
      const image = await this.storage.readForUser(objectId, job.userId);
      const result = visionResultSchema.parse(await this.vision.analyze(image));
      const predictions: Prisma.AIFoodPredictionCreateManyInput[] = [];
      for (const item of result.items) {
        const foodId = await this.matchFood(item.label);
        const reference =
          item.portion && foodId
            ? await this.portionReference(foodId)
            : undefined;
        const portion = estimatePortion(item.portion, reference);
        predictions.push({
          analysisId: job.id,
          predictedName: item.label,
          confidence: item.confidence,
          foodId,
          estimatedQuantity: portion?.quantity,
          estimatedUnit: portion?.unit,
          modelMetadata: portion ? { portion: portion.evidence } : undefined,
        });
      }
      await this.prisma.$transaction(async (tx) => {
        const completed = await tx.aIAnalysis.updateMany({
          where: { id: job.id, status: "RUNNING", meal: scope.meal },
          data: {
            status: "COMPLETED",
            modelVersion: result.modelVersion,
            completedAt: new Date(),
          },
        });
        if (!completed.count) return;
        const meal = await tx.meal.updateMany({
          where: { id: job.mealId, ...scope.meal },
          data: { status: "REVIEW" },
        });
        if (!meal.count) return;
        await tx.aIFoodPrediction.createMany({ data: predictions });
      });
    } catch {
      this.logger.warn({ event: "image_analysis_failed", analysisId: job.id });
      await this.fail(job.id, job.mealId);
    }
    return true;
  }

  private async matchFood(label: string) {
    const normalized = normalizeFoodText(label);
    if (!normalized) return null;
    // Exact normalized catalog matches are safe to suggest. Fuzzy results
    // remain available in the user's catalog search during review.
    const matches = await this.prisma.food.findMany({
      where: {
        AND: activeFoodWhere,
        OR: [
          { normalizedName: normalized },
          { nameVi: { equals: label, mode: "insensitive" } },
          { nameEn: { equals: label, mode: "insensitive" } },
          {
            aliases: { some: { normalizedAlias: normalized, isActive: true } },
          },
        ],
      },
      select: { id: true },
      take: 2,
    });
    return matches.length === 1 ? (matches[0]?.id ?? null) : null;
  }

  private async portionReference(foodId: string) {
    const food = await this.prisma.food.findFirst({
      where: { id: foodId, AND: activeFoodWhere },
      include: {
        packagedProduct: true,
        nutritionRecords: {
          include: { nutritionVersion: { include: { source: true } } },
        },
      },
    });
    return (
      (food &&
        latestNutrition(
          food.nutritionRecords,
          food.packagedProduct?.currentNutritionVersionId,
        )) ||
      undefined
    );
  }

  private async fail(analysisId: string, mealId: string) {
    await this.prisma.$transaction(async (tx) => {
      const failed = await tx.aIAnalysis.updateMany({
        where: { id: analysisId, status: "RUNNING" },
        data: {
          status: "FAILED",
          errorCode: "AI_ANALYSIS_ERROR",
          errorMessage: unavailableMessage,
          completedAt: new Date(),
        },
      });
      if (!failed.count) return;
      await tx.meal.updateMany({
        where: { id: mealId, status: "ANALYZING", deletedAt: null },
        data: { status: "FAILED" },
      });
    });
  }
}
