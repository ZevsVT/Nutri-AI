import { Prisma, type PrismaClient } from "@prisma/client";

export const correctionEvaluationConsent = "correction-evaluation-v1";

const eligible = Prisma.sql`
  WITH eligible AS (
    SELECT a.id, a.provider, a.model, a."modelVersion", a."feedbackRecordedAt"
    FROM "AIAnalysis" a
    JOIN "Meal" m ON m.id = a."mealId" AND m."userId" = a."userId"
    JOIN LATERAL (
      SELECT status, "grantedAt", "revokedAt"
      FROM "UserConsent"
      WHERE "userId" = a."userId" AND "consentType" = 'AI_PROCESSING'
        AND version = ${correctionEvaluationConsent}
      ORDER BY "createdAt" DESC, id DESC LIMIT 1
    ) consent ON consent.status = 'GRANTED' AND consent."grantedAt" <= CURRENT_TIMESTAMP
      AND consent."revokedAt" IS NULL
    WHERE a.status = 'COMPLETED' AND m.status = 'CONFIRMED'
      AND m."confirmedAt" IS NOT NULL AND m."deletedAt" IS NULL
  )
`;

type Counts = {
  provider: string;
  model: string;
  modelVersion: string | null;
  reviews: bigint;
  predictions: bigint;
  changed: bigint;
  added: bigint;
  removed: bigint;
  replaced: bigint;
  renamed: bigint;
  portion: bigint;
  legacyReviews: bigint;
  legacyRows: bigint;
};

type FoodCounts = Pick<Counts, "provider" | "model" | "modelVersion"> & {
  food: string;
  correction: string;
  count: bigint;
};

const rate = (numerator: number, denominator: number) =>
  denominator ? numerator / denominator : null;

export async function correctionReport(prisma: PrismaClient) {
  const [counts, foods] = await prisma.$transaction(
    [
      prisma.$queryRaw<Counts[]>`
      ${eligible}
      SELECT e.provider, e.model, e."modelVersion",
        COUNT(*) FILTER (WHERE e."feedbackRecordedAt" IS NOT NULL) AS reviews,
        SUM(CASE WHEN e."feedbackRecordedAt" IS NOT NULL THEN p.total ELSE 0 END)::bigint AS predictions,
        SUM(CASE WHEN e."feedbackRecordedAt" IS NOT NULL THEN c.changed ELSE 0 END)::bigint AS changed,
        SUM(CASE WHEN e."feedbackRecordedAt" IS NOT NULL THEN c.added ELSE 0 END)::bigint AS added,
        SUM(CASE WHEN e."feedbackRecordedAt" IS NOT NULL THEN c.removed ELSE 0 END)::bigint AS removed,
        SUM(CASE WHEN e."feedbackRecordedAt" IS NOT NULL THEN c.replaced ELSE 0 END)::bigint AS replaced,
        SUM(CASE WHEN e."feedbackRecordedAt" IS NOT NULL THEN c.renamed ELSE 0 END)::bigint AS renamed,
        SUM(CASE WHEN e."feedbackRecordedAt" IS NOT NULL THEN c.portion ELSE 0 END)::bigint AS portion,
        COUNT(*) FILTER (WHERE e."feedbackRecordedAt" IS NULL) AS "legacyReviews",
        SUM(CASE WHEN e."feedbackRecordedAt" IS NULL THEN c.total ELSE 0 END)::bigint AS "legacyRows"
      FROM eligible e
      JOIN LATERAL (SELECT COUNT(*) AS total FROM "AIFoodPrediction" WHERE "analysisId" = e.id) p ON TRUE
      JOIN LATERAL (
        SELECT COUNT(*) AS total, COUNT(DISTINCT "predictionId") AS changed,
          COUNT(*) FILTER (WHERE "correctionType" = 'FOOD_ADDED') AS added,
          COUNT(*) FILTER (WHERE "correctionType" = 'FOOD_REMOVED') AS removed,
          COUNT(*) FILTER (WHERE "correctionType" = 'FOOD_REPLACED') AS replaced,
          COUNT(*) FILTER (WHERE "correctionType" = 'NAME_CORRECTED') AS renamed,
          COUNT(*) FILTER (WHERE "correctionType" = 'PORTION_CHANGED') AS portion
        FROM "AICorrection" WHERE "analysisId" = e.id
      ) c ON TRUE
      GROUP BY e.provider, e.model, e."modelVersion"
      ORDER BY e.provider, e.model, e."modelVersion" NULLS LAST
    `,
      prisma.$queryRaw<FoodCounts[]>`
      ${eligible}
      SELECT e.provider, e.model, e."modelVersion", f."nameVi" AS food,
        c."correctionType"::text AS correction, COUNT(*) AS count
      FROM eligible e
      JOIN "AICorrection" c ON c."analysisId" = e.id
      JOIN "Food" f ON f.id = COALESCE(c."correctedFoodId", c."originalFoodId")
      WHERE e."feedbackRecordedAt" IS NOT NULL AND f."isActive" AND f.status = 'ACTIVE'
        AND c."correctionType" <> 'NAME_CORRECTED'
      GROUP BY e.provider, e.model, e."modelVersion", f."nameVi", c."correctionType"
      ORDER BY count DESC, e.provider, e.model, e."modelVersion" NULLS LAST, food, correction
      LIMIT 30
    `,
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    models: counts.map(({ provider, model, modelVersion, ...row }) => {
      const reviews = Number(row.reviews);
      const predictions = Number(row.predictions);
      return {
        provider,
        model,
        modelVersion,
        reviews,
        predictions,
        unchangedPredictions: predictions - Number(row.changed),
        correctionCounts: {
          FOOD_ADDED: Number(row.added),
          FOOD_REMOVED: Number(row.removed),
          FOOD_REPLACED: Number(row.replaced),
          NAME_CORRECTED: Number(row.renamed),
          PORTION_CHANGED: Number(row.portion),
        },
        correctionsPerPrediction: {
          FOOD_REMOVED: rate(Number(row.removed), predictions),
          FOOD_REPLACED: rate(Number(row.replaced), predictions),
          NAME_CORRECTED: rate(Number(row.renamed), predictions),
          PORTION_CHANGED: rate(Number(row.portion), predictions),
        },
        additionsPerReview: rate(Number(row.added), reviews),
        legacyReviews: Number(row.legacyReviews),
        legacyRows: Number(row.legacyRows),
      };
    }),
    topCatalogCorrections: foods.map(({ count, ...row }) => ({
      ...row,
      count: Number(count),
    })),
  };
}
