import { useEffect, useRef, useState } from "react";
import { Button } from "../common/Button";
import { CapturePanel } from "./CapturePanel";
import { ProcessingState } from "./ProcessingState";
import { ReviewState } from "./ReviewState";
import { ResultState } from "./ResultState";
import {
  confirmMealAnalysis,
  discardMealAnalysis,
  pollMealAnalysis,
  startImageAnalysis,
  type MealAnalysis,
} from "../../services/mealAnalysisService";
import type { MealEntryInput, SavedMeal } from "../../services/mealService";

export function AnalyzeView({
  onOpenManual,
  onMealSaved,
}: {
  onOpenManual: () => void;
  onMealSaved: (meal: SavedMeal) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [saved, setSaved] = useState<SavedMeal | null>(null);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const draftId = useRef<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function discardDraft() {
    active.current?.abort();
    active.current = null;
    const id = draftId.current;
    draftId.current = null;
    if (id) void discardMealAnalysis(id).catch(() => {});
  }

  useEffect(() => discardDraft, []);

  async function analyze(photo: File) {
    discardDraft();
    const controller = new AbortController();
    active.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]);
    setFile(photo);
    setBusy(true);
    setError("");
    setAnalysis(null);
    setSaved(null);
    try {
      const job = await startImageAnalysis(photo, signal);
      if (controller.signal.aborted) {
        void discardMealAnalysis(job.mealId).catch(() => {});
        return;
      }
      draftId.current = job.mealId;
      const result = await pollMealAnalysis(job, signal);
      if (controller.signal.aborted) return;
      if (result.status === "FAILED")
        throw new Error(result.error?.message ?? "Could not analyze this photo.");
      setAnalysis(result);
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(signal.aborted
          ? "Photo analysis is taking too long. Try again or enter the meal manually."
          : failure instanceof Error ? failure.message : "Could not analyze this photo.");
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function reset() {
    discardDraft();
    setFile(null);
    setAnalysis(null);
    setSaved(null);
    setError("");
    setBusy(false);
  }

  async function confirm(items: Array<MealEntryInput & { predictionId?: string }>) {
    if (!analysis) return;
    const meal = await confirmMealAnalysis(analysis.analysisId, items);
    draftId.current = null;
    setSaved(meal);
    onMealSaved(meal);
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>Analyze a meal</h2>
          <p className="view-header-subtitle">
            Take or upload a photo to get food suggestions you can check.
          </p>
        </div>
      </div>
      {busy ? (
        <>
          <ProcessingState previewImage={preview} />
          <Button onClick={reset}>Cancel</Button>
        </>
      ) : saved ? (
        <ResultState meal={saved} onReset={reset} />
      ) : analysis ? (
        <ReviewState key={analysis.analysisId} predictions={analysis.predictions}
          onConfirm={confirm} onCancel={reset} />
      ) : (
        <>
          {error && (
            <div className="card">
              <p role="alert">{error}</p>
              {file && <Button onClick={() => void analyze(file)}>Retry this photo</Button>}
            </div>
          )}
          <CapturePanel
            onPhoto={(photo) => void analyze(photo)}
            onOpenManual={() => { reset(); onOpenManual(); }}
          />
        </>
      )}
    </div>
  );
}
