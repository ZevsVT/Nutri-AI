import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import type { UserGoals } from "../../types";

interface EditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: UserGoals;
  onSaveGoals: (goals: UserGoals) => void;
}

export function EditGoalModal({
  isOpen,
  onClose,
  goals,
  onSaveGoals,
}: EditGoalModalProps) {
  const [calories, setCalories] = useState(goals.calories);
  const [protein, setProtein] = useState(goals.protein);
  const [fiber, setFiber] = useState(goals.fiber);
  const [waterMl, setWaterMl] = useState(goals.waterMl);

  const handleSave = () => {
    onSaveGoals({
      ...goals,
      calories,
      protein,
      fiber,
      waterMl,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Daily Nutrition Targets"
      subtitle="Customize targets according to your wellness goals."
    >
      <div className="form-group">
        <label htmlFor="goal-calories" className="form-label">
          Daily Calories (kcal)
        </label>
        <input
          id="goal-calories"
          type="number"
          className="form-input"
          value={calories}
          onChange={(e) => setCalories(Number(e.target.value))}
        />
      </div>

      <div className="form-group">
        <label htmlFor="goal-protein" className="form-label">
          Daily Protein Target (g)
        </label>
        <input
          id="goal-protein"
          type="number"
          className="form-input"
          value={protein}
          onChange={(e) => setProtein(Number(e.target.value))}
        />
      </div>

      <div className="form-group">
        <label htmlFor="goal-fiber" className="form-label">
          Daily Dietary Fiber (g)
        </label>
        <input
          id="goal-fiber"
          type="number"
          className="form-input"
          value={fiber}
          onChange={(e) => setFiber(Number(e.target.value))}
        />
      </div>

      <div className="form-group">
        <label htmlFor="goal-water" className="form-label">
          Daily Hydration (ml)
        </label>
        <input
          id="goal-water"
          type="number"
          className="form-input"
          value={waterMl}
          onChange={(e) => setWaterMl(Number(e.target.value))}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Targets
        </Button>
      </div>
    </Modal>
  );
}
