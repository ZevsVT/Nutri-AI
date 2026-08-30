import { Icon } from "../../icons";
import { Button } from "../common/Button";
import type { UserGoals } from "../../types";

interface DailyHeroProps {
  onAnalyze: () => void;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  goals: UserGoals;
}

export function DailyHero({ onAnalyze, totals, goals }: DailyHeroProps) {
  const caloriePercent = Math.min(100, Math.round((totals.calories / goals.calories) * 100));
  const caloriesLeft = Math.max(0, goals.calories - totals.calories);
  const macros = [
    { label: "Protein", value: totals.protein, target: goals.protein, unit: "g", color: "var(--nutrient-protein-bar)" },
    { label: "Carbs", value: totals.carbs, target: goals.carbs, unit: "g", color: "var(--nutrient-carbs-bar)" },
    { label: "Fat", value: totals.fat, target: goals.fat, unit: "g", color: "var(--nutrient-fat-bar)" },
  ];

  return (
    <section className="dashboard-hero-card">
      <div className="hero-text-content">
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 12px",
            backgroundColor: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255, 255, 255, 0.9)",
            borderRadius: "var(--radius-pill)",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--brand-primary)",
            boxShadow: "0 2px 8px rgba(45, 106, 79, 0.08)",
          }}
        >
          <Icon name="sparkles" size={13} />
          Today's Cadence · High Rhythm
        </span>
        <h3>
          Make your next meal<br />
          <em>count for more.</em>
        </h3>
        <p>
          You’re maintaining high-quality protein across breakfast and lunch. Adding colorful herbs, fiber, or seasonal fruit will complete today's targets.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Button
            variant="primary"
            size="md"
            icon="scan"
            onClick={onAnalyze}
            className="animate-pulse-glow"
          >
            Analyze Next Meal
          </Button>
        </div>
      </div>

      <div
        className="daily-summary-panel"
      >
        <div className="daily-summary-panel__header">
          <div>
            <span className="daily-summary-panel__eyebrow">Today's snapshot</span>
            <strong>Nutrition in motion</strong>
          </div>
          <span className="daily-summary-panel__status"><i /> On track</span>
        </div>

        <div className="calorie-summary">
          <div className="calorie-summary__value"><strong>{caloriesLeft.toLocaleString()}</strong><span>kcal left</span></div>
          <span className="calorie-summary__total">{totals.calories.toLocaleString()} / {goals.calories.toLocaleString()} kcal</span>
          <div className="calorie-summary__track"><span style={{ width: `${caloriePercent}%` }} /></div>
        </div>

        <div className="macro-summary-list">
          {macros.map((macro) => {
            const percent = Math.min(100, Math.round((macro.value / macro.target) * 100));
            return (
              <div className="macro-summary-row" key={macro.label}>
                <div className="macro-summary-row__label"><span><i style={{ backgroundColor: macro.color }} />{macro.label}</span><strong>{macro.value}<small> / {macro.target}{macro.unit}</small></strong></div>
                <div className="macro-summary-row__track"><span style={{ width: `${percent}%`, backgroundColor: macro.color }} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
