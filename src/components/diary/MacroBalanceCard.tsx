import { Icon } from "../../icons";
import type { UserGoals } from "../../types";

interface MacroBalanceCardProps {
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  goals: UserGoals;
}

export function MacroBalanceCard({ totals, goals }: MacroBalanceCardProps) {
  const proteinPercent = Math.min(100, Math.round((totals.protein / goals.protein) * 100));
  const carbsPercent = Math.min(100, Math.round((totals.carbs / goals.carbs) * 100));
  const fatPercent = Math.min(100, Math.round((totals.fat / goals.fat) * 100));

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: "var(--space-4)" }}>
        <div>
          <p className="section-kicker">Today's Macronutrients</p>
          <h4 style={{ fontSize: "1rem" }}>Nutritional Balance</h4>
        </div>
        <Icon name="chart" size={18} style={{ color: "var(--text-muted)" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: "4px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Protein</span>
            <strong>{totals.protein} g <small style={{ color: "var(--text-muted)", fontWeight: 500 }}>/ {goals.protein}g</small></strong>
          </div>
          <div className="metric-progress-track">
            <div className="metric-progress-fill metric-progress-fill--protein" style={{ width: `${proteinPercent}%` }} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: "4px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Carbohydrates</span>
            <strong>{totals.carbs} g <small style={{ color: "var(--text-muted)", fontWeight: 500 }}>/ {goals.carbs}g</small></strong>
          </div>
          <div className="metric-progress-track">
            <div style={{ height: "100%", backgroundColor: "var(--nutrient-carbs-bar)", borderRadius: "var(--radius-pill)", width: `${carbsPercent}%` }} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", marginBottom: "4px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Healthy Fats</span>
            <strong>{totals.fat} g <small style={{ color: "var(--text-muted)", fontWeight: 500 }}>/ {goals.fat}g</small></strong>
          </div>
          <div className="metric-progress-track">
            <div style={{ height: "100%", backgroundColor: "var(--nutrient-fat-bar)", borderRadius: "var(--radius-pill)", width: `${fatPercent}%` }} />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "var(--space-5)",
          padding: "var(--space-3)",
          backgroundColor: "var(--brand-primary-subtle)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.8125rem",
          color: "var(--brand-primary-hover)",
          display: "flex",
          gap: "8px",
        }}
      >
        <Icon name="sparkles" size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
        <span>
          Protein intake is steady across your main meals. Adding whole grains will easily fulfill today’s fiber recommendation.
        </span>
      </div>
    </div>
  );
}
