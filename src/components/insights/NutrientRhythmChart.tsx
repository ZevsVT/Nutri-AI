import { useState } from "react";
import { weeklyNutrientTrends } from "../../data";
import { Icon } from "../../icons";

type ChartMode = "macros" | "energy" | "plants";

export function NutrientRhythmChart() {
  const [chartMode, setChartMode] = useState<ChartMode>("macros");
  const [hoveredDay, setHoveredDay] = useState<typeof weeklyNutrientTrends[0] | null>(null);

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div>
          <p className="section-kicker">Multi-Metric Visualization</p>
          <h4 style={{ fontSize: "1rem" }}>Weekly Nutrition Rhythm</h4>
        </div>

        {/* Chart Metric Mode Selector */}
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            className={`btn btn-sm ${chartMode === "macros" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setChartMode("macros")}
            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
          >
            Protein & Fiber
          </button>
          <button
            type="button"
            className={`btn btn-sm ${chartMode === "energy" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setChartMode("energy")}
            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
          >
            Energy (kcal)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${chartMode === "plants" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setChartMode("plants")}
            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
          >
            Plants & Water
          </button>
        </div>
      </div>

      {/* Dynamic Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", fontSize: "0.75rem", marginBottom: "var(--space-2)" }}>
        {chartMode === "macros" && (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--nutrient-protein-bar)" }} />
              Protein (Target: 90g)
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--nutrient-fiber-bar)" }} />
              Fiber (Target: 28g)
            </span>
          </>
        )}
        {chartMode === "energy" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--nutrient-calories-bar)" }} />
            Calories (Target: 2,000 kcal)
          </span>
        )}
        {chartMode === "plants" && (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--nutrient-fiber-bar)" }} />
              Plant Groups
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--nutrient-water-bar)" }} />
              Hydration (L)
            </span>
          </>
        )}
      </div>

      {/* Chart Canvas */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          height: "170px",
          padding: "var(--space-4) var(--space-2) 0",
          borderBottom: "1px solid var(--border-subtle)",
          position: "relative",
        }}
      >
        {weeklyNutrientTrends.map((item) => {
          const isHovered = hoveredDay?.day === item.day;

          let primaryBarHeight = "0%";
          let secondaryBarHeight = "0%";

          if (chartMode === "macros") {
            primaryBarHeight = `${Math.min(100, Math.round((item.protein / 100) * 100))}%`;
            secondaryBarHeight = `${Math.min(100, Math.round((item.fiber / 35) * 100))}%`;
          } else if (chartMode === "energy") {
            primaryBarHeight = `${Math.min(100, Math.round((item.calories / 2400) * 100))}%`;
          } else {
            primaryBarHeight = `${Math.min(100, Math.round((item.plantCount / 8) * 100))}%`;
            secondaryBarHeight = `${Math.min(100, Math.round((item.waterL / 3) * 100))}%`;
          }

          return (
            <div
              key={item.day}
              className="chart-bar-column"
              onMouseEnter={() => setHoveredDay(item)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{ cursor: "pointer" }}
            >
              <div className="chart-bars-wrap">
                <div
                  className="chart-single-bar"
                  style={{
                    height: primaryBarHeight,
                    backgroundColor:
                      chartMode === "macros"
                        ? "var(--nutrient-protein-bar)"
                        : chartMode === "energy"
                        ? "var(--nutrient-calories-bar)"
                        : "var(--nutrient-fiber-bar)",
                    opacity: hoveredDay && !isHovered ? 0.35 : 1,
                    transition: "height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
                {chartMode !== "energy" && (
                  <div
                    className="chart-single-bar"
                    style={{
                      height: secondaryBarHeight,
                      backgroundColor:
                        chartMode === "macros"
                          ? "var(--nutrient-fiber-bar)"
                          : "var(--nutrient-water-bar)",
                      opacity: hoveredDay && !isHovered ? 0.35 : 1,
                      transition: "height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: isHovered ? 700 : 500,
                  color: isHovered ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {item.day}
              </span>
            </div>
          );
        })}
      </div>

      {/* Interactive Inspector */}
      {hoveredDay ? (
        <div
          style={{
            marginTop: "var(--space-3)",
            padding: "10px 14px",
            backgroundColor: "var(--bg-surface-subtle)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.8125rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <strong>{hoveredDay.fullDay} ({hoveredDay.date})</strong>
          <span style={{ color: "var(--text-secondary)" }}>
            {hoveredDay.protein}g protein · {hoveredDay.fiber}g fiber · {hoveredDay.calories} kcal · {hoveredDay.plantCount} plant types · {hoveredDay.waterL}L water
          </span>
        </div>
      ) : (
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "var(--space-2)", textAlign: "center" }}>
          Hover or tap on any day to reveal full nutritional composition.
        </p>
      )}
    </div>
  );
}
