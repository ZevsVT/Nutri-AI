import { Icon } from "../../icons";

interface QuickHabitTrackerProps {
  waterMl: number;
  targetWaterMl: number;
  onAddWater: (amountMl: number) => void;
  plantCount: number;
  targetPlantCount: number;
  onIncrementPlants: () => void;
}

export function QuickHabitTracker({
  waterMl,
  targetWaterMl,
  onAddWater,
  plantCount,
  targetPlantCount,
  onIncrementPlants,
}: QuickHabitTrackerProps) {
  const waterPct = Math.min(100, Math.round((waterMl / targetWaterMl) * 100));

  return (
    <div className="habit-tracker-card">
      <div className="card-header" style={{ marginBottom: "var(--space-3)" }}>
        <div>
          <p className="section-kicker">Interactive Habits</p>
          <h4 style={{ fontSize: "1rem" }}>Daily Hydration & Plants</h4>
        </div>
      </div>

      {/* Hydration with Visual Liquid Bar */}
      <div className="habit-item-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="habit-icon-group">
            <div className="habit-icon-box habit-icon-box--water">
              <Icon name="water" size={16} />
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                Hydration Tracker
              </strong>
              <small style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                {waterMl} / {targetWaterMl} ml ({waterPct}%)
              </small>
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onAddWater(250)}
              title="Add 1 glass (250 ml)"
              style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "var(--radius-xs)" }}
            >
              +250ml
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onAddWater(500)}
              title="Add 1 bottle (500 ml)"
              style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "var(--radius-xs)" }}
            >
              +500ml
            </button>
          </div>
        </div>

        {/* Animated Liquid Gauge */}
        <div
          style={{
            height: "8px",
            backgroundColor: "var(--nutrient-water-bg)",
            borderRadius: "var(--radius-pill)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${waterPct}%`,
              backgroundColor: "var(--nutrient-water-bar)",
              borderRadius: "var(--radius-pill)",
              transition: "width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
              boxShadow: "0 0 10px var(--nutrient-water-glow)",
            }}
          />
        </div>
      </div>

      {/* Plant Diversity Tracker */}
      <div className="habit-item-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="habit-icon-group">
            <div className="habit-icon-box habit-icon-box--plant">
              <Icon name="leaf" size={16} />
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                Plant Variety Score
              </strong>
              <small style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                {plantCount} / {targetPlantCount} unique botanical food groups
              </small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onIncrementPlants}
            title="Log another plant food"
            style={{ padding: "4px 10px", fontSize: "0.75rem", borderRadius: "var(--radius-xs)" }}
          >
            +1 Plant
          </button>
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
          {Array.from({ length: targetPlantCount }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: "6px",
                borderRadius: "var(--radius-pill)",
                backgroundColor: i < plantCount ? "var(--nutrient-fiber-bar)" : "var(--bg-surface-muted)",
                transition: "background-color 0.4s ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DailyInsightCard({ onAskAI }: { onAskAI: () => void }) {
  return (
    <article className="ai-insight-box">
      <div className="ai-insight-badge">
        <Icon name="sparkles" size={13} />
        NutriAI Observation
      </div>
      <h4>Consistent Protein Distribution</h4>
      <p>
        You have included a high-quality protein source across breakfast, lunch, and your afternoon snack. For dinner, pairing lean protein with steamed leafy greens will optimize nutrient absorption.
      </p>
      <button
        type="button"
        className="ai-insight-cta"
        onClick={onAskAI}
      >
        <span>Ask AI what to cook for dinner</span>
        <Icon name="arrow" size={14} />
      </button>
    </article>
  );
}
