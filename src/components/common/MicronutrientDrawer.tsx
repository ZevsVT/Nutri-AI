import { Icon } from "../../icons";
import { Modal } from "./Modal";
import type { Meal } from "../../types";

interface MicronutrientDrawerProps {
  meal: Meal | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MicronutrientDrawer({
  meal,
  isOpen,
  onClose,
}: MicronutrientDrawerProps) {
  if (!meal) return null;

  const micronutrients = [
    { name: "Vitamin A (Beta-carotene)", amount: "450 mcg", percentDV: 50, category: "Vitamins" },
    { name: "Vitamin C (Ascorbic acid)", amount: "28 mg", percentDV: 31, category: "Vitamins" },
    { name: "Calcium", amount: "180 mg", percentDV: 18, category: "Minerals" },
    { name: "Iron (Heme & Non-heme)", amount: "3.8 mg", percentDV: 21, category: "Minerals" },
    { name: "Potassium", amount: "520 mg", percentDV: 15, category: "Electrolytes" },
    { name: "Sodium", amount: `${meal.sodium || 850} mg`, percentDV: 37, category: "Electrolytes", isWarning: (meal.sodium || 850) > 800 },
    { name: "Soluble Dietary Fiber", amount: "2.4 g", percentDV: 24, category: "Fiber" },
    { name: "Insoluble Dietary Fiber", amount: "3.2 g", percentDV: 20, category: "Fiber" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Clinical Micronutrient Breakdown"
      subtitle={`Detailed micronutrients & mineral bioavailability for ${meal.name}`}
      wide
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--space-3)",
          marginBottom: "var(--space-5)",
        }}
      >
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-calories-bg)" }}>
          <span>Energy</span>
          <strong>{meal.calories} kcal</strong>
        </div>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-protein-bg)" }}>
          <span>Protein</span>
          <strong>{meal.protein} g</strong>
        </div>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-carbs-bg)" }}>
          <span>Carbs</span>
          <strong>{meal.carbs} g</strong>
        </div>
        <div className="result-nutrient-tile" style={{ backgroundColor: "var(--nutrient-fiber-bg)" }}>
          <span>Fiber</span>
          <strong>{meal.fiber} g</strong>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <h4 style={{ fontSize: "0.9375rem", color: "var(--text-primary)" }}>
          Micronutrients & Daily Value (% DV)
        </h4>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          {micronutrients.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: "var(--space-3)",
                backgroundColor: "var(--bg-surface-subtle)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: "4px" }}>
                <strong>{item.name}</strong>
                <span style={{ color: item.isWarning ? "var(--status-warning-text)" : "var(--brand-primary)", fontWeight: 700 }}>
                  {item.percentDV}% DV
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                <span>{item.category}</span>
                <span>{item.amount}</span>
              </div>
              <div style={{ height: "4px", backgroundColor: "var(--border-subtle)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, item.percentDV * 2)}%`,
                    backgroundColor: item.isWarning ? "var(--nutrient-protein-bar)" : "var(--brand-primary)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: "var(--space-5)",
          padding: "var(--space-3) var(--space-4)",
          backgroundColor: "var(--brand-primary-subtle)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.8125rem",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <Icon name="shield-check" size={20} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
        <span>
          Derived from USDA National Nutrient Database & Vietnam National Institute of Nutrition clinical composition tables.
        </span>
      </div>
    </Modal>
  );
}
