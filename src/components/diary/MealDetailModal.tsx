import { Icon } from "../../icons";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { ConfidenceBadge } from "../common/Badge";
import type { Meal } from "../../types";

interface MealDetailModalProps {
  meal: Meal | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteMeal?: (mealId: string) => void;
}

export function MealDetailModal({
  meal,
  isOpen,
  onClose,
  onDeleteMeal,
}: MealDetailModalProps) {
  if (!meal) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={meal.name}
      subtitle={`${meal.type} · Logged at ${meal.time} · ${meal.portion}`}
    >
      <div
        style={{
          position: "relative",
          height: "180px",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          backgroundImage: `url(${meal.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          marginBottom: "var(--space-4)",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "10px",
            backgroundColor: "rgba(30, 49, 39, 0.8)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "var(--radius-xs)",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
        >
          {meal.tags.join(" · ")}
        </div>
      </div>

      <div className="result-nutrition-grid" style={{ margin: "var(--space-4) 0" }}>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-calories-bg)" }}>
          <span style={{ color: "var(--nutrient-calories-text)" }}>Calories</span>
          <strong>{meal.calories} kcal</strong>
        </div>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-protein-bg)" }}>
          <span style={{ color: "var(--nutrient-protein-text)" }}>Protein</span>
          <strong>{meal.protein} g</strong>
        </div>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-carbs-bg)" }}>
          <span style={{ color: "var(--nutrient-carbs-text)" }}>Carbs</span>
          <strong>{meal.carbs} g</strong>
        </div>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-fat-bg)" }}>
          <span style={{ color: "var(--nutrient-fat-text)" }}>Fat</span>
          <strong>{meal.fat} g</strong>
        </div>
      </div>

      {meal.items && meal.items.length > 0 && (
        <div style={{ marginBottom: "var(--space-5)" }}>
          <h4 style={{ fontSize: "0.875rem", marginBottom: "var(--space-2)", color: "var(--text-secondary)" }}>
            Verified Ingredients Breakdown
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {meal.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  backgroundColor: "var(--bg-surface-subtle)",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "0.8125rem",
                }}
              >
                <div>
                  <strong>{item.name}</strong>
                  <span style={{ color: "var(--text-muted)", marginLeft: "6px", fontSize: "0.75rem" }}>
                    ({item.portion})
                  </span>
                </div>
                <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                  {item.calories} kcal · {item.protein}g P
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-subtle)" }}>
        <ConfidenceBadge confidence={meal.confidence} />
        {onDeleteMeal && (
          <Button
            variant="danger"
            size="sm"
            icon="trash"
            onClick={() => {
              onDeleteMeal(meal.id);
              onClose();
            }}
          >
            Delete Entry
          </Button>
        )}
      </div>
    </Modal>
  );
}
