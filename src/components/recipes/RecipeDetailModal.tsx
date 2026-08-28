import { useState } from "react";
import { Icon } from "../../icons";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import type { Recipe } from "../../types";

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onLogMeal: (recipe: Recipe) => void;
}

export function RecipeDetailModal({
  recipe,
  isOpen,
  onClose,
  onLogMeal,
}: RecipeDetailModalProps) {
  const [servings, setServings] = useState(2);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});

  if (!recipe) return null;

  const baseServings = recipe.servings || 2;
  const scale = servings / baseServings;

  const scaledCalories = Math.round(recipe.calories * scale);
  const baseProtein = parseInt(recipe.protein, 10) || 30;
  const scaledProtein = Math.round(baseProtein * scale);
  const baseFiber = parseInt(recipe.fiber, 10) || 8;
  const scaledFiber = Math.round(baseFiber * scale);

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={recipe.title}
      subtitle={`${recipe.tag} · ${recipe.time} · ${scaledCalories} kcal`}
      wide
    >
      <div
        style={{
          position: "relative",
          height: "200px",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          backgroundImage: `url(${recipe.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          marginBottom: "var(--space-4)",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "12px",
            display: "flex",
            gap: "6px",
          }}
        >
          <span className="badge badge-green">{recipe.tag}</span>
          {recipe.cuisine && <span className="badge badge-subtle">{recipe.cuisine}</span>}
        </div>
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
        {recipe.description}
      </p>

      {/* Interactive Servings Stepper */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-3) var(--space-4)",
          backgroundColor: "var(--bg-surface-subtle)",
          borderRadius: "var(--radius-md)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div>
          <strong style={{ fontSize: "0.875rem", display: "block", color: "var(--text-primary)" }}>
            Adjust Servings
          </strong>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Live recalculates ingredients and macro nutrition
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setServings((s) => Math.max(1, s - 1))}
            style={{ width: "30px", height: "30px", padding: 0 }}
          >
            -
          </button>
          <strong style={{ minWidth: "80px", textAlign: "center", fontSize: "0.9375rem" }}>
            {servings} {servings === 1 ? "serving" : "servings"}
          </strong>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setServings((s) => Math.min(8, s + 1))}
            style={{ width: "30px", height: "30px", padding: 0 }}
          >
            +
          </button>
        </div>
      </div>

      {/* Scaled Macro Nutrition Grid */}
      <div className="result-nutrition-grid" style={{ marginBottom: "var(--space-5)" }}>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-calories-bg)" }}>
          <span style={{ color: "var(--nutrient-calories-text)" }}>Calories</span>
          <strong>{scaledCalories} kcal</strong>
        </div>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-protein-bg)" }}>
          <span style={{ color: "var(--nutrient-protein-text)" }}>Protein</span>
          <strong>{scaledProtein} g</strong>
        </div>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-carbs-bg)" }}>
          <span style={{ color: "var(--nutrient-carbs-text)" }}>Carbs</span>
          <strong>{Math.round(45 * scale)} g</strong>
        </div>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-fiber-bg)" }}>
          <span style={{ color: "var(--nutrient-fiber-text)" }}>Fiber</span>
          <strong>{scaledFiber} g</strong>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "var(--space-6)", marginBottom: "var(--space-6)" }}>
        <div>
          <h4 style={{ fontSize: "0.9375rem", marginBottom: "var(--space-3)", color: "var(--text-primary)" }}>
            Ingredients (Tap to check off)
          </h4>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8125rem", padding: 0 }}>
            {recipe.ingredients.map((ing, idx) => {
              const isChecked = checkedIngredients[idx];
              return (
                <li
                  key={idx}
                  onClick={() => toggleIngredient(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid var(--border-subtle)",
                    paddingBottom: "6px",
                    cursor: "pointer",
                    textDecoration: isChecked ? "line-through" : "none",
                    opacity: isChecked ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "var(--radius-xs)",
                        border: "1px solid",
                        borderColor: isChecked ? "var(--brand-primary)" : "var(--border-default)",
                        backgroundColor: isChecked ? "var(--brand-primary)" : "transparent",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {isChecked && <Icon name="check" size={12} strokeWidth={3} />}
                    </div>
                    <span>{ing.name}</span>
                  </div>
                  <strong style={{ color: "var(--text-secondary)" }}>{ing.amount}</strong>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h4 style={{ fontSize: "0.9375rem", marginBottom: "var(--space-3)", color: "var(--text-primary)" }}>
            Step-by-Step Instructions
          </h4>
          <ol style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8125rem", paddingLeft: "18px", color: "var(--text-secondary)" }}>
            {recipe.instructions.map((step, idx) => (
              <li key={idx} style={{ lineHeight: 1.45 }}>{step}</li>
            ))}
          </ol>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-subtle)" }}>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="primary"
          icon="plus"
          onClick={() => {
            onLogMeal(recipe);
            onClose();
          }}
        >
          Log Recipe as Meal ({scaledCalories} kcal)
        </Button>
      </div>
    </Modal>
  );
}
