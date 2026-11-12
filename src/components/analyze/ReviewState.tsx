import { useState } from "react";
import { Button } from "../common/Button";
import { FoodSearch } from "../common/FoodSearch";
import type { AnalysisPrediction } from "../../services/mealAnalysisService";
import type { CatalogFood, MealEntryInput } from "../../services/mealService";

type ReviewRow = {
  key: string;
  prediction?: AnalysisPrediction;
  foodId: string;
  name: string;
  amount: string;
  unit: string;
};

export function ReviewState({
  predictions,
  onConfirm,
  onCancel,
  manual = false,
}: {
  predictions: AnalysisPrediction[];
  onConfirm: (items: Array<MealEntryInput & { predictionId?: string }>) => Promise<void>;
  onCancel: () => void;
  manual?: boolean;
}) {
  const [rows, setRows] = useState<ReviewRow[]>(() => predictions.map((item) => ({
    key: item.id,
    prediction: item,
    foodId: item.foodId ?? "",
    name: item.predictedName,
    amount: item.quantity?.toString() ?? "",
    unit: item.unit ?? "",
  })));
  const [selecting, setSelecting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(key: string, fields: Partial<ReviewRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...fields } : row));
  }

  function select(food: CatalogFood) {
    const fields = { foodId: food.id, name: food.name.vi, amount: "", unit: food.servingUnit ?? "" };
    if (selecting === "add") {
      setRows((current) => [...current, { key: crypto.randomUUID(), ...fields }]);
    } else if (selecting) {
      update(selecting, fields);
    }
    setSelecting(null);
  }

  async function save() {
    if (saving) return;
    setError("");
    if (!rows.length) {
      setError("Add at least one food before confirming.");
      return;
    }
    const invalid = rows.findIndex((row) =>
      !row.foodId || !row.name.trim() || !row.unit.trim() ||
      !Number.isFinite(Number(row.amount)) || Number(row.amount) < 0.001 || Number(row.amount) > 100_000);
    if (invalid !== -1) {
      setError(`Select a catalog food and enter a valid name, quantity, and unit for item ${invalid + 1}.`);
      return;
    }
    setSaving(true);
    try {
      await onConfirm(rows.map((row) => ({
        predictionId: row.prediction?.id,
        foodId: row.foodId,
        displayName: row.name.trim(),
        quantity: Number(row.amount),
        unit: row.unit.trim(),
      })));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not confirm this meal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      {!manual && <h3>Review meal suggestions</h3>}
      <p>Check each food and enter the amount you ate before confirming.</p>
      {!rows.length && <p>{manual ? "Add a food from the catalog." : "There are no suggestions to review. Add a food from the catalog or try another photo."}</p>}
      <fieldset disabled={saving} style={{ border: 0, padding: 0 }}>
        {rows.map((row, index) => (
          <fieldset key={row.key} className="form-group">
            <legend>Item {index + 1}</legend>
            {row.prediction && (
              <p>
                Suggested {row.prediction.predictedName}
                {row.prediction.confidence !== null &&
                  ` · ${Math.round(row.prediction.confidence * 100)}% recognition confidence`}
                {row.prediction.portionEstimate
                  ? ` · ${Math.round(row.prediction.portionEstimate.confidence * 100)}% portion confidence · ${row.prediction.portionEstimate.source} (${row.prediction.portionEstimate.version})`
                  : " · Portion unknown"}
                {row.prediction.portionEstimate?.servingReference &&
                  ` · One serving is ${row.prediction.portionEstimate.servingReference.amount} ${row.prediction.portionEstimate.servingReference.unit}`}
              </p>
            )}
            {!row.foodId && <p>Select a matching food from the catalog.</p>}
            <Button onClick={() => setSelecting(row.key)}>{row.foodId ? "Replace food" : "Find a match"}</Button>
            <Button onClick={() => {
              setRows((current) => current.filter((item) => item.key !== row.key));
              if (selecting === row.key) setSelecting(null);
            }}>Remove item</Button>
            <label className="form-label">
              Display name
              <input className="form-input" value={row.name} maxLength={160}
                onChange={(e) => update(row.key, { name: e.target.value })} />
            </label>
            <label className="form-label">
              Quantity
              <input className="form-input" value={row.amount} type="number" min="0.001" max="100000" step="0.001"
                onChange={(e) => update(row.key, { amount: e.target.value })} />
            </label>
            <label className="form-label">
              Unit
              <input className="form-input" value={row.unit} maxLength={32} placeholder="g, ml, or serving"
                onChange={(e) => update(row.key, { unit: e.target.value })} />
            </label>
            {selecting === row.key && <FoodSearch onSelect={select} />}
          </fieldset>
        ))}
        <Button disabled={rows.length >= 100} onClick={() => setSelecting("add")}>Add food</Button>
        {selecting === "add" && <FoodSearch onSelect={select} />}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <Button variant="primary" loading={saving} onClick={() => void save()}>Confirm meal</Button>
      <Button disabled={saving} onClick={onCancel}>{manual ? "Cancel" : "Discard and start again"}</Button>
    </section>
  );
}
