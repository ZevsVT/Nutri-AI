import { useState } from "react";
import { Icon } from "../../icons";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { searchFoods } from "../../data";
import type { FoodDatabaseEntry, Meal, MealType } from "../../types";

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMeal: (meal: Meal) => void;
}

export function QuickLogModal({
  isOpen,
  onClose,
  onSaveMeal,
}: QuickLogModalProps) {
  const [mealType, setMealType] = useState<MealType>("Snack");
  const [customName, setCustomName] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodDatabaseEntry | null>(null);
  const [amountGrams, setAmountGrams] = useState(150);

  const handleSelectFood = (food: FoodDatabaseEntry) => {
    setSelectedFood(food);
    setCustomName(food.name);
    setAmountGrams(food.defaultAmount);
  };

  const handleSave = () => {
    if (!customName.trim()) return;

    const baseCal = selectedFood ? selectedFood.calories : 150;
    const basePro = selectedFood ? selectedFood.protein : 12;
    const baseCarb = selectedFood ? selectedFood.carbs : 18;
    const baseFat = selectedFood ? selectedFood.fat : 5;
    const baseFib = selectedFood ? selectedFood.fiber : 3;

    const multiplier = amountGrams / 100;

    const newMeal: Meal = {
      id: `manual-log-${Date.now()}`,
      type: mealType,
      name: customName,
      description: `${amountGrams}g portion · Manually logged`,
      time: "Just now",
      date: "Today, Aug 22",
      art: "meal-art--breakfast",
      image: "/images/chicken-bowl.jpg",
      calories: Math.round(baseCal * multiplier),
      protein: Math.round(basePro * multiplier),
      carbs: Math.round(baseCarb * multiplier),
      fat: Math.round(baseFat * multiplier),
      fiber: Math.round(baseFib * multiplier),
      confidence: 1.0,
      portion: `${amountGrams} g`,
      tags: [mealType, "Manual Entry"],
      source: selectedFood ? selectedFood.source : "User Entry",
    };

    onSaveMeal(newMeal);
    setCustomName("");
    setSelectedFood(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Food Log"
      subtitle="Log a meal or snack quickly from canonical nutrition databases."
    >
      <div className="form-group">
        <label className="form-label">Meal Type</label>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["Breakfast", "Lunch", "Dinner", "Snack"] as MealType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`btn btn-sm ${mealType === type ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setMealType(type)}
              style={{ flex: 1, fontSize: "0.75rem" }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="quick-food-name" className="form-label">Food Name or Dish</label>
        <input
          id="quick-food-name"
          className="form-input"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="e.g. Grilled Salmon, Broken Rice, Tofu..."
        />
      </div>

      {/* Suggested Quick Picks */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
          Quick Database Picks:
        </span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {searchFoods.slice(0, 5).map((food) => (
            <button
              key={food.id}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleSelectFood(food)}
              style={{
                fontSize: "0.75rem",
                padding: "4px 8px",
                borderColor: selectedFood?.id === food.id ? "var(--brand-primary)" : "var(--border-subtle)",
                backgroundColor: selectedFood?.id === food.id ? "var(--brand-primary-subtle)" : "transparent",
              }}
            >
              {food.name.split("(")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Portion Grams */}
      <div
        style={{
          padding: "var(--space-3) var(--space-4)",
          backgroundColor: "var(--bg-surface-subtle)",
          borderRadius: "var(--radius-md)",
          marginBottom: "var(--space-5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Portion Weight (grams):</span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setAmountGrams((g) => Math.max(25, g - 25))}
          >
            -25g
          </button>
          <strong style={{ minWidth: "50px", textAlign: "center" }}>{amountGrams}g</strong>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setAmountGrams((g) => g + 25)}
          >
            +25g
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon="check"
          disabled={!customName.trim()}
          onClick={handleSave}
        >
          Add to Food Diary
        </Button>
      </div>
    </Modal>
  );
}
