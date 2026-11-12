import { apiRequest } from "./apiClient";
import type { MealEntryInput, SavedMeal } from "./mealService";

export interface AnalysisPrediction {
  id: string;
  predictedName: string;
  foodId: string | null;
  quantity: number | null;
  unit: string | null;
  confidence: number | null;
  portionEstimate?: {
    basis: "VISIBLE_MEASUREMENT" | "VISIBLE_SERVING_COUNT";
    confidence: number;
    source: string;
    version: string;
    servingReference?: { amount: number; unit: string };
  } | null;
}

export interface MealAnalysis {
  analysisId: string;
  mealId: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  inputType: string;
  predictions: AnalysisPrediction[];
  error?: { code: string; message: string };
}

export async function startImageAnalysis(file: File, signal: AbortSignal) {
  const body = new FormData();
  body.set("file", file);
  const { data: upload } = await apiRequest<{ objectId: string; reference: string }>(
    "/storage/uploads", { method: "POST", body, signal },
  );
  try {
    const { data } = await apiRequest<MealAnalysis>("/meal-analysis", {
      method: "POST",
      body: JSON.stringify({ inputType: "IMAGE", inputReference: upload.reference }),
      signal,
    });
    return data;
  } catch (error) {
    void apiRequest(`/storage/objects/${upload.objectId}`, { method: "DELETE" }).catch(() => {});
    throw error;
  }
}

export async function transcribeMealAudio(audio: Blob, signal: AbortSignal) {
  const body = new FormData();
  body.set("file", audio, "meal.wav");
  const { data } = await apiRequest<{ transcript: string }>("/meal-analysis/transcribe", {
    method: "POST", body, signal,
  });
  return data.transcript;
}

export async function startTextAnalysis(transcript: string, signal: AbortSignal) {
  const { data } = await apiRequest<MealAnalysis>("/meal-analysis", {
    method: "POST", body: JSON.stringify({ inputType: "TEXT", inputReference: transcript }),
    signal,
  });
  if (data.status !== "READY") throw new Error("Text analysis is unavailable. Enter the meal manually.");
  return data;
}

export async function pollMealAnalysis(
  initial: MealAnalysis,
  signal: AbortSignal,
) {
  let analysis = initial;
  while (analysis.status === "PENDING" || analysis.status === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    signal.throwIfAborted();
    const { data } = await apiRequest<MealAnalysis>(
      `/meal-analysis/${analysis.analysisId}`, { signal },
    );
    analysis = data;
  }
  return analysis;
}

export function discardMealAnalysis(mealId: string) {
  return apiRequest(`/meals/${mealId}?draftOnly=true`, { method: "DELETE" });
}

export async function confirmMealAnalysis(
  analysisId: string,
  items: Array<MealEntryInput & { predictionId?: string }>,
) {
  return (await apiRequest<SavedMeal>(`/meal-analysis/${analysisId}/confirm`, {
    method: "POST", body: JSON.stringify({ items }),
  })).data;
}
