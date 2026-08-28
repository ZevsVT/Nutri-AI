import { useState, useRef, type ChangeEvent, useMemo } from "react";
import { Icon } from "../../icons";
import { CapturePanel } from "./CapturePanel";
import { ProcessingState } from "./ProcessingState";
import { ReviewState } from "./ReviewState";
import { ResultState } from "./ResultState";
import { AddItemModal } from "./AddItemModal";
import { detectedItems as initialDetectedItems } from "../../data";
import { calculateDetectedTotals } from "../../services/nutritionEngine";
import type { DetectedItem, Meal, View } from "../../types";

interface AnalyzeViewProps {
  onSaveMeal: (meal: Meal) => void;
  onNavigate: (view: View) => void;
}

export function AnalyzeView({ onSaveMeal, onNavigate }: AnalyzeViewProps) {
  const [stage, setStage] = useState<"capture" | "processing" | "review" | "result">("capture");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedItem[]>(initialDetectedItems);
  const [portion, setPortion] = useState("1 medium bowl (approx 500g)");
  const [isSaved, setIsSaved] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculatedNutrition = useMemo(() => {
    return calculateDetectedTotals(detected);
  }, [detected]);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewImage(url);
    setStage("processing");
    setIsSaved(false);
    setTimeout(() => {
      setStage("review");
    }, 1200);
  };

  const handleDemoMeal = () => {
    setPreviewImage("/images/pho-bo.jpg");
    setStage("processing");
    setIsSaved(false);
    setTimeout(() => {
      setStage("review");
    }, 1200);
  };

  const handleUpdateItemAmount = (id: string, newAmount: number) => {
    setDetected((items) =>
      items.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            amount: newAmount,
            portion: `${newAmount} ${item.unit}`,
          };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setDetected((items) => items.filter((item) => item.id !== id));
  };

  const handleAddItem = (newItem: DetectedItem) => {
    setDetected((items) => [...items, newItem]);
  };

  const handleSaveToDiary = () => {
    const newMeal: Meal = {
      id: `meal-${Date.now()}`,
      type: "Dinner",
      name: "Phở Bò (Beef Noodle Soup)",
      description: detected.map((i) => i.name).join(" · "),
      time: "Just now",
      date: "Today, Aug 22",
      art: "meal-art--pho",
      image: previewImage || "/images/pho-bo.jpg",
      calories: calculatedNutrition.calories,
      protein: calculatedNutrition.protein,
      carbs: calculatedNutrition.carbs,
      fat: calculatedNutrition.fat,
      fiber: calculatedNutrition.fiber,
      sodium: calculatedNutrition.sodium,
      confidence: 0.87,
      portion: portion,
      tags: ["Vietnamese", "Analyzed"],
      source: "Curated Vietnamese Food Table",
    };
    onSaveMeal(newMeal);
    setIsSaved(true);
  };

  const handleReset = () => {
    setStage("capture");
    setPreviewImage(null);
    setDetected(initialDetectedItems);
    setIsSaved(false);
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <p className="section-kicker">Multi-Modal Vision Engine</p>
          <h2>Analyze a meal</h2>
          <p className="view-header-subtitle">
            Snap, upload, or describe your plate to get verified nutrition facts.
          </p>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="analyze-flow-stepper" aria-label="Analysis progress">
        <div className={`step-chip ${stage === "capture" || stage === "processing" ? "step-chip--active" : "step-chip--completed"}`}>
          <div className="step-num-bubble">
            {stage === "review" || stage === "result" ? <Icon name="check" size={13} strokeWidth={2.5} /> : "1"}
          </div>
          <span>Capture</span>
        </div>
        <div className="step-divider-line" />
        <div className={`step-chip ${stage === "review" ? "step-chip--active" : stage === "result" ? "step-chip--completed" : ""}`}>
          <div className="step-num-bubble">
            {stage === "result" ? <Icon name="check" size={13} strokeWidth={2.5} /> : "2"}
          </div>
          <span>Review</span>
        </div>
        <div className="step-divider-line" />
        <div className={`step-chip ${stage === "result" ? "step-chip--active" : ""}`}>
          <div className="step-num-bubble">3</div>
          <span>Nutrition</span>
        </div>
      </div>

      {stage === "capture" && (
        <CapturePanel
          fileInputRef={fileInputRef}
          onFileSelect={handleFile}
          onDemoMeal={handleDemoMeal}
        />
      )}

      {stage === "processing" && (
        <ProcessingState previewImage={previewImage} />
      )}

      {stage === "review" && (
        <ReviewState
          previewImage={previewImage}
          detectedItems={detected}
          overallPortion={portion}
          onUpdatePortion={setPortion}
          onUpdateItemAmount={handleUpdateItemAmount}
          onRemoveItem={handleRemoveItem}
          onAddItem={handleAddItem}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onConfirm={() => setStage("result")}
        />
      )}

      {stage === "result" && (
        <ResultState
          previewImage={previewImage}
          nutrition={calculatedNutrition}
          portion={portion}
          isSaved={isSaved}
          onSaveToDiary={handleSaveToDiary}
          onAnalyzeAnother={handleReset}
          onAskAI={() => onNavigate("assistant")}
        />
      )}

      <AddItemModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddItem={handleAddItem}
      />
    </div>
  );
}
