import { useState } from "react";
import { Icon } from "../../icons";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { searchFoods } from "../../data";
import type { DetectedItem, FoodDatabaseEntry } from "../../types";

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: DetectedItem) => void;
}

export function AddItemModal({ isOpen, onClose, onAddItem }: AddItemModalProps) {
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodDatabaseEntry | null>(null);
  const [amount, setAmount] = useState<number>(100);

  const filteredFoods = query.trim()
    ? searchFoods.filter(
        (f) =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.category.toLowerCase().includes(query.toLowerCase())
      )
    : searchFoods;

  const handleConfirm = () => {
    if (!selectedFood) return;
    const newItem: DetectedItem = {
      id: `custom-${Date.now()}`,
      name: selectedFood.name,
      detail: selectedFood.category,
      portion: `${amount} ${selectedFood.unit}`,
      amount: amount,
      unit: selectedFood.unit,
      baseCalories: selectedFood.calories,
      baseProtein: selectedFood.protein,
      baseCarbs: selectedFood.carbs,
      baseFat: selectedFood.fat,
      baseFiber: selectedFood.fiber,
      confidence: 0.95,
      removable: true,
      source: selectedFood.source,
    };
    onAddItem(newItem);
    setSelectedFood(null);
    setQuery("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Food Ingredient"
      subtitle="Search USDA FoodData Central and Curated Vietnamese Food Database"
    >
      <div className="form-group">
        <label htmlFor="food-search-input" className="form-label">
          Search food name
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="food-search-input"
            className="form-input"
            style={{ paddingLeft: "36px" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Chicken breast, Rice noodles, Tofu, Avocado..."
            autoFocus
          />
          <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
            <Icon name="search" size={16} />
          </div>
        </div>
      </div>

      <div
        style={{
          maxHeight: "220px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          marginBottom: "var(--space-4)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--space-2)",
        }}
      >
        {filteredFoods.map((food) => {
          const isSelected = selectedFood?.id === food.id;
          return (
            <button
              key={food.id}
              type="button"
              onClick={() => {
                setSelectedFood(food);
                setAmount(food.defaultAmount);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: isSelected ? "var(--brand-primary-subtle)" : "transparent",
                border: isSelected ? "1px solid var(--brand-primary-border)" : "1px solid transparent",
                textAlign: "left",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>{food.name}</strong>
                <small style={{ display: "block", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  {food.category} · {food.source}
                </small>
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                {food.calories} kcal / 100g
              </span>
            </button>
          );
        })}
      </div>

      {selectedFood && (
        <div
          style={{
            backgroundColor: "var(--bg-surface-subtle)",
            padding: "var(--space-3)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-5)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Portion Quantity ({selectedFood.unit}):</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAmount((a) => Math.max(10, a - 25))}
              >
                -25
              </button>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                style={{ width: "70px", padding: "4px 8px", textAlign: "center", borderRadius: "var(--radius-xs)", border: "1px solid var(--border-default)" }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAmount((a) => a + 25)}
              >
                +25
              </button>
            </div>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Estimated: {Math.round((selectedFood.calories * amount) / 100)} kcal · {Math.round((selectedFood.protein * amount) / 100)}g protein · {Math.round((selectedFood.fiber * amount) / 100)}g fiber
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!selectedFood} onClick={handleConfirm}>
          Add to Analysis
        </Button>
      </div>
    </Modal>
  );
}
