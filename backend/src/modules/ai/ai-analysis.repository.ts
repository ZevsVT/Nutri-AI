import type {
  AIInputType,
  AICorrectionType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

export interface CreateAIAnalysisInput {
  mealId: string;
  provider: string;
  model: string;
  modelVersion?: string;
  inputType: AIInputType;
  inputReference?: string;
}

export interface CreateAICorrectionInput {
  analysisId: string;
  predictionId?: string;
  correctionType: AICorrectionType;
  originalFoodId?: string;
  correctedFoodId?: string;
  originalQuantity?: number;
  correctedQuantity?: number;
  originalUnit?: string;
  correctedUnit?: string;
}

export class AIAnalysisRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByIdForUser(id: string, userId: string) {
    return this.prisma.aIAnalysis.findFirst({
      where: { id, userId },
      include: { predictions: true, corrections: true },
    });
  }

  createForUser(userId: string, input: CreateAIAnalysisInput) {
    return this.prisma.$transaction(async (transaction) => {
      const meal = await transaction.meal.findFirst({
        where: { id: input.mealId, userId, deletedAt: null },
        select: { id: true },
      });
      if (!meal) {
        return null;
      }

      return transaction.aIAnalysis.create({
        data: { userId, ...input },
      });
    });
  }

  createCorrectionForUser(userId: string, input: CreateAICorrectionInput) {
    return this.prisma.$transaction(async (transaction) => {
      const analysis = await transaction.aIAnalysis.findFirst({
        where: { id: input.analysisId, userId },
        select: { id: true },
      });
      if (!analysis) {
        return null;
      }

      const data: Prisma.AICorrectionUncheckedCreateInput = {
        analysisId: input.analysisId,
        predictionId: input.predictionId,
        userId,
        correctionType: input.correctionType,
        originalFoodId: input.originalFoodId,
        correctedFoodId: input.correctedFoodId,
        originalQuantity: input.originalQuantity,
        correctedQuantity: input.correctedQuantity,
        originalUnit: input.originalUnit,
        correctedUnit: input.correctedUnit,
      };
      return transaction.aICorrection.create({ data });
    });
  }
}
