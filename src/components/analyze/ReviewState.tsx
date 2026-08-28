import { useState } from "react";
import { Icon } from "../../icons";
import { Button } from "../common/Button";
import { ConfidenceBadge } from "../common/Badge";
import type { DetectedItem } from "../../types";

interface ReviewStateProps {
  previewImage: string | null;
  detectedItems: DetectedItem[];
  overallPortion: string;
  onUpdatePortion: (portion: string) => void;
  onUpdateItemAmount: (id: string, newAmount: number) => void;
  onRemoveItem: (id: string) => void;
  onAddItem: (item: DetectedItem) => void;
  onOpenAddModal: () => void;
  onConfirm: () => void;
}

const quickToppings = [
  { id: "quick_egg", name: "Poached Egg", detail: "1 whole egg", amount: 50, unit: "g", baseCalories: 140, baseProtein: 12, baseCarbs: 1, baseFat: 10, baseFiber: 0, confidence: 0.95, source: "USDA FoodData Central" },
  { id: "quick_herbs", name: "Extra Fresh Basil & Mint", detail: "Rau thơm tươi", amount: 30, unit: "g", baseCalories: 30, baseProtein: 2, baseCarbs: 4, baseFat: 0, baseFiber: 3, confidence: 0.98, source: "Curated Vietnamese Food Table" },
  { id: "quick_lime", name: "Lime & Fresh Chili", detail: "Chanh & ớt tươi", amount: 15, unit: "g", baseCalories: 10, baseProtein: 0, baseCarbs: 2, baseFat: 0, baseFiber: 1, confidence: 0.99, source: "Curated Vietnamese Food Table" },
];

export function ReviewState({
  previewImage,
  detectedItems,
  overallPortion,
  onUpdatePortion,
  onUpdateItemAmount,
  onRemoveItem,
  onAddItem,
  onOpenAddModal,
  onConfirm,
}: ReviewStateProps) {
  const bgImg = previewImage || "/images/pho-bo.jpg";
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const handleAddQuickTopping = (topping: typeof quickToppings[0]) => {
    onAddItem({
      id: `${topping.id}_${Date.now()}`,
      name: topping.name,
      detail: topping.detail,
      portion: `${topping.amount} ${topping.unit}`,
      amount: topping.amount,
      unit: topping.unit,
      baseCalories: topping.baseCalories,
      baseProtein: topping.baseProtein,
      baseCarbs: topping.baseCarbs,
      baseFat: topping.baseFat,
      baseFiber: topping.baseFiber,
      confidence: topping.confidence,
      removable: true,
      source: topping.source,
    });
  };

  return (
    <div className="review-layout-split">
      <div
        className="reviewed-photo-card"
        style={{ backgroundImage: `url(${bgImg})`, position: "relative" }}
      >
        <button
          type="button"
          className={`bounding-box-label bounding-box--beef ${highlightedId === "beef" ? "bounding-box--active" : ""}`}
          onClick={() => setHighlightedId(highlightedId === "beef" ? null : "beef")}
          style={{
            cursor: "pointer",
            boxShadow: highlightedId === "beef" ? "0 0 12px #38a169, 0 0 0 2px #fff" : "none",
            transform: highlightedId === "beef" ? "scale(1.08)" : "none",
            transition: "all var(--transition-fast)",
          }}
        >
          <Icon name="check" size={12} /> Lean Beef Slices
        </button>

        <button
          type="button"
          className={`bounding-box-label bounding-box--noodles ${highlightedId === "noodles" ? "bounding-box--active" : ""}`}
          onClick={() => setHighlightedId(highlightedId === "noodles" ? null : "noodles")}
          style={{
            cursor: "pointer",
            boxShadow: highlightedId === "noodles" ? "0 0 12px #38a169, 0 0 0 2px #fff" : "none",
            transform: highlightedId === "noodles" ? "scale(1.08)" : "none",
            transition: "all var(--transition-fast)",
          }}
        >
          <Icon name="check" size={12} /> Rice Noodles
        </button>

        <button
          type="button"
          className={`bounding-box-label bounding-box--herbs ${highlightedId === "herbs" ? "bounding-box--active" : ""}`}
          onClick={() => setHighlightedId(highlightedId === "herbs" ? null : "herbs")}
          style={{
            cursor: "pointer",
            boxShadow: highlightedId === "herbs" ? "0 0 12px #38a169, 0 0 0 2px #fff" : "none",
            transform: highlightedId === "herbs" ? "scale(1.08)" : "none",
            transition: "all var(--transition-fast)",
          }}
        >
          <Icon name="check" size={12} /> Fresh Herbs & Sprouts
        </button>

        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "12px",
            right: "12px",
            backgroundColor: "rgba(24, 43, 33, 0.85)",
            backdropFilter: "blur(6px)",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Tap any box to inspect ingredient</span>
          <span style={{ color: "#a7f3d0", fontWeight: 700 }}>4 Items Identified</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ marginBottom: "var(--space-2)" }}>
          <div>
            <p className="section-kicker">Interactive Verification</p>
            <h3 style={{ fontSize: "1.25rem" }}>Confirm Ingredients & Portions</h3>
          </div>
          <ConfidenceBadge confidence={0.87} />
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
          Fine-tune portion grams or tap quick-add condiments to complete your nutrition estimate.
        </p>

        {/* Detected List with Interactive Highlight & Sliders */}
        <div className="detected-items-table">
          {detectedItems.map((item) => {
            const isHighlighted = highlightedId === item.id;
            return (
              <div
                key={item.id}
                className="detected-row-item"
                onMouseEnter={() => setHighlightedId(item.id)}
                onMouseLeave={() => setHighlightedId(null)}
                style={{
                  borderColor: isHighlighted ? "var(--brand-accent)" : "var(--border-subtle)",
                  backgroundColor: isHighlighted ? "var(--brand-primary-subtle)" : "var(--bg-surface-subtle)",
                  transition: "all var(--transition-fast)",
                }}
              >
                <div className="detected-name-box">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <strong>{item.name}</strong>
                    <span style={{ fontSize: "0.6875rem", color: "var(--text-subtle)" }}>({Math.round((item.baseCalories * item.amount) / 100)} kcal)</span>
                  </div>
                  <small>{item.detail}</small>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onUpdateItemAmount(item.id, Math.max(10, item.amount - 20))}
                    style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                    aria-label={`Decrease ${item.name}`}
                  >
                    -
                  </button>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, minWidth: "48px", textAlign: "center" }}>
                    {item.amount}{item.unit}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onUpdateItemAmount(item.id, item.amount + 20)}
                    style={{ padding: "2px 8px", fontSize: "0.75rem" }}
                    aria-label={`Increase ${item.name}`}
                  >
                    +
                  </button>
                </div>

                {item.removable !== false && (
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    style={{ color: "var(--text-subtle)", padding: "4px", marginLeft: "4px" }}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Add Condiments & Toppings */}
        <div style={{ margin: "var(--space-3) 0 var(--space-4)" }}>
          <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>
            + Quick Add Sides & Condiments:
          </span>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {quickToppings.map((top) => (
              <button
                key={top.id}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleAddQuickTopping(top)}
                style={{ fontSize: "0.75rem", padding: "4px 8px" }}
              >
                + {top.name}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={onOpenAddModal}
              style={{ fontSize: "0.75rem", padding: "4px 8px" }}
            >
              <Icon name="plus" size={13} /> Custom Food...
            </button>
          </div>
        </div>

        {/* Serving Size Picker */}
        <div className="form-group" style={{ marginTop: "var(--space-3)" }}>
          <label htmlFor="meal-portion-select" className="form-label">
            Overall Bowl Size
          </label>
          <select
            id="meal-portion-select"
            className="form-input"
            value={overallPortion}
            onChange={(e) => onUpdatePortion(e.target.value)}
          >
            <option value="1 small bowl (approx 350g)">1 small bowl (approx 350g)</option>
            <option value="1 medium bowl (approx 500g)">1 medium bowl (approx 500g)</option>
            <option value="1 large bowl (approx 680g)">1 large bowl (approx 680g)</option>
          </select>
        </div>

        <Button
          variant="primary"
          size="lg"
          icon="arrow"
          iconPosition="right"
          fullWidth
          onClick={onConfirm}
        >
          Confirm & Compute Nutrition
        </Button>
      </div>
    </div>
  );
}
