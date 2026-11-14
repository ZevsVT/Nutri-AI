import { useState } from "react";
import { MealItemsForm } from "./MealItemsForm";
import { ApiError } from "../../services/apiClient";
import { createMeal, localDateTime, mealTypes, type SavedMeal } from "../../services/mealService";
import { Modal } from "./Modal";

export function QuickLogModal({ onClose, onSaveMeal, onExpired }: {
  onClose: () => void;
  onSaveMeal: (meal: SavedMeal) => void;
  onExpired: () => void;
}) {
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState<SavedMeal["mealType"]>("OTHER");
  const [capturedAt, setCapturedAt] = useState(() => localDateTime());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const close = () => { if (!saving) onClose(); };

  return (
    <Modal isOpen onClose={close} title="Log a meal" wide>
      <fieldset disabled={saving} style={{ border: 0, padding: 0 }}>
        <label className="form-label">
          Meal name
          <input className="form-input" value={name} maxLength={160} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="form-label">
          Meal type
          <select className="form-input" value={mealType} onChange={(e) => setMealType(e.target.value as SavedMeal["mealType"])}>
            {Object.entries(mealTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label className="form-label">
          Date and time
          <input className="form-input" value={capturedAt} type="datetime-local" onChange={(e) => setCapturedAt(e.target.value)} />
        </label>
        <label className="form-label">
          Notes
          <textarea className="form-input" value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </fieldset>
      <MealItemsForm onCancel={close} onConfirm={async (items) => {
        const date = new Date(capturedAt);
        if (!Number.isFinite(date.getTime())) throw new Error("Enter a valid date and time.");
        setSaving(true);
        try {
          const meal = await createMeal({
            mealType, capturedAt: date.toISOString(), name: name.trim() || items[0]?.displayName || "Meal",
            notes, items,
          });
          onSaveMeal(meal);
          onClose();
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) onExpired();
          throw error;
        } finally {
          setSaving(false);
        }
      }} />
    </Modal>
  );
}
