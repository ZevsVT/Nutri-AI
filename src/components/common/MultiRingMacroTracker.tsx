import { useState } from "react";
import type { UserGoals } from "../../types";

interface MultiRingMacroTrackerProps {
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  goals: UserGoals;
  size?: number;
}

export function MultiRingMacroTracker({
  totals,
  goals,
  size = 170,
}: MultiRingMacroTrackerProps) {
  const [activeMacro, setActiveMacro] = useState<"calories" | "protein" | "carbs" | "fat" | null>(null);

  const calPct = Math.min(100, Math.round((totals.calories / goals.calories) * 100));
  const proPct = Math.min(100, Math.round((totals.protein / goals.protein) * 100));
  const carbPct = Math.min(100, Math.round((totals.carbs / goals.carbs) * 100));
  const fatPct = Math.min(100, Math.round((totals.fat / goals.fat) * 100));

  const rings = [
    { id: "calories", label: "Energy", current: totals.calories, target: goals.calories, unit: "kcal", pct: calPct, radius: 70, stroke: 9, color: "var(--nutrient-calories-bar)", bg: "var(--nutrient-calories-bg)" },
    { id: "protein", label: "Protein", current: totals.protein, target: goals.protein, unit: "g", pct: proPct, radius: 56, stroke: 9, color: "var(--nutrient-protein-bar)", bg: "var(--nutrient-protein-bg)" },
    { id: "carbs", label: "Carbs", current: totals.carbs, target: goals.carbs, unit: "g", pct: carbPct, radius: 42, stroke: 9, color: "var(--nutrient-carbs-bar)", bg: "var(--nutrient-carbs-bg)" },
    { id: "fat", label: "Fat", current: totals.fat, target: goals.fat, unit: "g", pct: fatPct, radius: 28, stroke: 9, color: "var(--nutrient-fat-bar)", bg: "var(--nutrient-fat-bg)" },
  ] as const;

  const centerInfo = activeMacro
    ? rings.find((r) => r.id === activeMacro)
    : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-5)",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
        role="region"
        aria-label="Concentric Macro Rings"
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          {rings.map((ring) => {
            const circumference = 2 * Math.PI * ring.radius;
            const offset = circumference - (ring.pct / 100) * circumference;
            const isHovered = activeMacro === ring.id;

            return (
              <g
                key={ring.id}
                onMouseEnter={() => setActiveMacro(ring.id)}
                onMouseLeave={() => setActiveMacro(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Background Ring */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={ring.radius}
                  stroke={ring.bg}
                  strokeWidth={ring.stroke}
                  fill="transparent"
                />
                {/* Active Progress Ring */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={ring.radius}
                  stroke={ring.color}
                  strokeWidth={isHovered ? ring.stroke + 2 : ring.stroke}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  fill="transparent"
                  style={{
                    transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 0.2s ease",
                    filter: isHovered ? "drop-shadow(0 0 6px rgba(0,0,0,0.15))" : "none",
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Center Text */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {centerInfo ? (
            <>
              <strong style={{ fontSize: "1.125rem", color: centerInfo.color, letterSpacing: "-0.03em" }}>
                {centerInfo.pct}%
              </strong>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                {centerInfo.label}
              </span>
            </>
          ) : (
            <>
              <strong style={{ fontSize: "1.25rem", color: "var(--brand-primary)", letterSpacing: "-0.04em" }}>
                {Math.round((calPct + proPct + carbPct + fatPct) / 4)}%
              </strong>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Balance
              </span>
            </>
          )}
        </div>
      </div>

      {/* Interactive Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "140px" }}>
        {rings.map((ring) => {
          const isHovered = activeMacro === ring.id;
          return (
            <button
              key={ring.id}
              type="button"
              onMouseEnter={() => setActiveMacro(ring.id)}
              onMouseLeave={() => setActiveMacro(null)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 8px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: isHovered ? "var(--bg-surface-subtle)" : "transparent",
                border: "1px solid",
                borderColor: isHovered ? "var(--border-strong)" : "transparent",
                transition: "all var(--transition-fast)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: ring.color,
                  }}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: isHovered ? 700 : 500, color: "var(--text-secondary)" }}>
                  {ring.label}
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {ring.current} <small style={{ color: "var(--text-muted)", fontWeight: 500 }}>{ring.unit}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
