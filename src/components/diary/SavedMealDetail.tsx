import { useState } from "react";
import { ApiError } from "../../services/apiClient";
import { deleteMeal, localDateTime, mealTypes, updateMeal, type SavedMeal } from "../../services/mealService";
import { NutritionSummary } from "../common/NutritionSummary";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";

export function SavedMealDetail({ meal, onClose, onUpdated, onDeleted, onExpired }: {
  meal: SavedMeal;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
  onExpired: () => void;
}) {
  const [name, setName] = useState(meal.name);
  const [notes, setNotes] = useState(meal.notes ?? "");
  const [mealType, setMealType] = useState(meal.mealType);
  const [capturedAt, setCapturedAt] = useState(localDateTime(new Date(meal.capturedAt)));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const confirmed = meal.status === "CONFIRMED";

  async function write(action: () => Promise<unknown>, done: () => void) {
    setError("");
    setBusy(true);
    try {
      await action();
      done();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      setError(failure instanceof Error ? failure.message : "Could not update this meal.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const date = new Date(capturedAt);
    if (!confirmed && !Number.isFinite(date.getTime())) {
      setError("Enter a valid date and time.");
      return;
    }
    const whenChanged = capturedAt !== localDateTime(new Date(meal.capturedAt));
    void write(() => updateMeal(meal.id, {
      name: name.trim(), notes,
      ...(!confirmed && mealType !== meal.mealType ? { mealType } : {}),
      ...(!confirmed && whenChanged ? { capturedAt: date.toISOString() } : {}),
    }), onUpdated);
  }

  return (
    <Modal isOpen onClose={() => { if (!busy) onClose(); }} title={meal.name}
      subtitle={`${mealTypes[meal.mealType]} · ${new Date(meal.capturedAt).toLocaleString()} · ${meal.status.toLowerCase()}`} wide>
      {confirmed && <NutritionSummary totals={meal.totals} />}
      <ul>
        {meal.items.map((item) => (
          <li key={item.id}>
            {item.displayName} · {item.quantity} {item.unit}
            {item.provenance && ` · ${item.provenance.source} (${item.provenance.version})`}
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        <fieldset disabled={busy || confirmDelete} style={{ border: 0, padding: 0 }}>
          <label className="form-label">Name<input className="form-input" value={name} required maxLength={160} onChange={(e) => setName(e.target.value)} /></label>
          <label className="form-label">Notes<textarea className="form-input" value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} /></label>
          {!confirmed && (
            <>
              <label className="form-label">
                Meal type
                <select className="form-input" value={mealType} onChange={(e) => setMealType(e.target.value as SavedMeal["mealType"])}>
                  {Object.entries(mealTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="form-label">Date and time<input className="form-input" value={capturedAt} type="datetime-local" required onChange={(e) => setCapturedAt(e.target.value)} /></label>
            </>
          )}
          <Button type="submit" variant="primary" disabled={!name.trim()}>Save changes</Button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {confirmDelete ? (
        <>
          <p>Delete this meal from your diary?</p>
          <Button variant="danger" loading={busy} onClick={() => void write(() => deleteMeal(meal.id), onDeleted)}>Delete meal</Button>
          <Button disabled={busy} onClick={() => setConfirmDelete(false)}>Keep meal</Button>
        </>
      ) : <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete entry</Button>}
    </Modal>
  );
}
