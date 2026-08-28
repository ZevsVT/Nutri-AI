import { Icon, type IconName } from "../../icons";
import type { UserGoals } from "../../types";
import { getPercent } from "../../services/nutritionEngine";

interface MetricGridProps {
  totals: {
    calories: number;
    protein: number;
    fiber: number;
    water: number;
  };
  goals: UserGoals;
}

interface MetricItemProps {
  icon: IconName;
  type: "calories" | "protein" | "fiber" | "water";
  label: string;
  value: string;
  target: string;
  progress: number;
  note: string;
}

function MetricItem({ icon, type, label, value, target, progress, note }: MetricItemProps) {
  return (
    <article className="metric-card">
      <div className="metric-card-top">
        <div>
          <span className="metric-label-text">{label}</span>
          <div className="metric-value-row">
            <span className="metric-number">{value}</span>
            <span className="metric-target-text">/ {target}</span>
          </div>
        </div>
        <div className={`metric-icon-box metric-icon-box--${type}`}>
          <Icon name={icon} size={18} />
        </div>
      </div>
      <div>
        <div className="metric-progress-track">
          <div
            className={`metric-progress-fill metric-progress-fill--${type}`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <p style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "6px" }}>
          {note}
        </p>
      </div>
    </article>
  );
}

export function MetricGrid({ totals, goals }: MetricGridProps) {
  const calPercent = getPercent(totals.calories, goals.calories);
  const proteinPercent = getPercent(totals.protein, goals.protein);
  const fiberPercent = getPercent(totals.fiber, goals.fiber);
  const waterPercent = getPercent(totals.water, goals.waterMl);

  return (
    <section className="metric-cards-grid" aria-label="Today's nutrition summary">
      <MetricItem
        icon="flame"
        type="calories"
        label="Energy (Calories)"
        value={`${totals.calories}`}
        target={`${goals.calories} kcal`}
        progress={calPercent}
        note={`${Math.max(0, goals.calories - totals.calories)} kcal remaining`}
      />
      <MetricItem
        icon="utensils"
        type="protein"
        label="Protein"
        value={`${totals.protein} g`}
        target={`${goals.protein} g`}
        progress={proteinPercent}
        note={`${proteinPercent}% of daily target`}
      />
      <MetricItem
        icon="leaf"
        type="fiber"
        label="Fiber"
        value={`${totals.fiber} g`}
        target={`${goals.fiber} g`}
        progress={fiberPercent}
        note="Add fresh fruit or greens"
      />
      <MetricItem
        icon="water"
        type="water"
        label="Hydration"
        value={`${(totals.water / 1000).toFixed(1)} L`}
        target={`${(goals.waterMl / 1000).toFixed(1)} L`}
        progress={waterPercent}
        note={`${Math.max(0, Math.round((goals.waterMl - totals.water) / 250))} glasses to goal`}
      />
    </section>
  );
}
