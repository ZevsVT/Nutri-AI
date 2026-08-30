import { useState } from "react";
import type { UserGoals } from "../../types";

interface MultiRingMacroTrackerProps {
  totals: { calories: number; protein: number; carbs: number; fat: number };
  goals: UserGoals;
  size?: number;
}

type MacroId = "calories" | "protein" | "carbs" | "fat";

export function MultiRingMacroTracker({ totals, goals, size = 170 }: MultiRingMacroTrackerProps) {
  const [activeMacro, setActiveMacro] = useState<MacroId | null>(null);
  const center = 100;
  const rings = [
    { id: "calories" as const, label: "Energy", current: totals.calories, target: goals.calories, unit: "kcal", pct: Math.min(100, Math.round((totals.calories / goals.calories) * 100)), radius: 82, stroke: 10, color: "var(--nutrient-calories-bar)", bg: "var(--nutrient-calories-bg)", glow: "var(--nutrient-calories-glow)" },
    { id: "protein" as const, label: "Protein", current: totals.protein, target: goals.protein, unit: "g", pct: Math.min(100, Math.round((totals.protein / goals.protein) * 100)), radius: 64, stroke: 10, color: "var(--nutrient-protein-bar)", bg: "var(--nutrient-protein-bg)", glow: "var(--nutrient-protein-glow)" },
    { id: "carbs" as const, label: "Carbs", current: totals.carbs, target: goals.carbs, unit: "g", pct: Math.min(100, Math.round((totals.carbs / goals.carbs) * 100)), radius: 46, stroke: 10, color: "var(--nutrient-carbs-bar)", bg: "var(--nutrient-carbs-bg)", glow: "var(--nutrient-carbs-glow)" },
    { id: "fat" as const, label: "Fat", current: totals.fat, target: goals.fat, unit: "g", pct: Math.min(100, Math.round((totals.fat / goals.fat) * 100)), radius: 28, stroke: 10, color: "var(--nutrient-fat-bar)", bg: "var(--nutrient-fat-bg)", glow: "var(--nutrient-fat-glow)" },
  ];
  const centerInfo = rings.find((ring) => ring.id === activeMacro);
  const balance = Math.round(rings.reduce((sum, ring) => sum + ring.pct, 0) / rings.length);

  return (
    <div className="macro-tracker">
      <div className="macro-tracker__visual" style={{ width: size, height: size }} role="img" aria-label={`Nutrition balance ${balance}%`}>
        <div className="macro-tracker__halo" aria-hidden="true" />
        <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
          {rings.map((ring, index) => {
            const circumference = 2 * Math.PI * ring.radius;
            const offset = circumference - (ring.pct / 100) * circumference;
            const endAngle = -90 + ring.pct * 3.6;
            const endX = center + ring.radius * Math.cos((endAngle * Math.PI) / 180);
            const endY = center + ring.radius * Math.sin((endAngle * Math.PI) / 180);
            const isActive = activeMacro === ring.id;
            return (
              <g key={ring.id} className={`macro-ring macro-ring--${index + 1} ${isActive ? "is-active" : ""}`}>
                <circle className="macro-ring__track" cx={center} cy={center} r={ring.radius} stroke={ring.bg} strokeWidth={ring.stroke} fill="none" transform={`rotate(-90 ${center} ${center})`} />
                <circle className="macro-ring__glow" cx={center} cy={center} r={ring.radius} stroke={ring.color} strokeWidth={ring.stroke + 3} strokeDasharray={circumference} strokeDashoffset={offset} fill="none" transform={`rotate(-90 ${center} ${center})`} />
                <circle className="macro-ring__progress" cx={center} cy={center} r={ring.radius} stroke={ring.color} strokeWidth={isActive ? ring.stroke + 2 : ring.stroke} strokeDasharray={circumference} strokeDashoffset={offset} fill="none" strokeLinecap="round" transform={`rotate(-90 ${center} ${center})`} style={{ "--ring-offset": offset, "--ring-circumference": circumference } as React.CSSProperties} />
                <circle className="macro-ring__dot" cx={endX} cy={endY} r={isActive ? 4 : 3} fill={ring.color} />
              </g>
            );
          })}
        </svg>
        <div className="macro-tracker__center">
          <strong style={{ color: centerInfo?.color || "var(--brand-primary)" }}>{centerInfo ? `${centerInfo.pct}%` : `${balance}%`}</strong>
          <span>{centerInfo?.label || "Balance"}</span>
          <small>{centerInfo ? `${centerInfo.current} ${centerInfo.unit}` : "today"}</small>
        </div>
      </div>
      <div className="macro-tracker__legend" aria-label="Macronutrient details">
        {rings.map((ring) => {
          const isActive = activeMacro === ring.id;
          return (
            <button key={ring.id} type="button" className={`macro-metric ${isActive ? "is-active" : ""}`} onMouseEnter={() => setActiveMacro(ring.id)} onMouseLeave={() => setActiveMacro(null)} onFocus={() => setActiveMacro(ring.id)} onBlur={() => setActiveMacro(null)} aria-pressed={isActive}>
              <span className="macro-metric__topline"><span className="macro-metric__name"><i style={{ backgroundColor: ring.color, boxShadow: `0 0 0 4px ${ring.glow}` }} />{ring.label}</span><span className="macro-metric__value">{ring.current}<small>{ring.unit}</small></span></span>
              <span className="macro-metric__bar"><span style={{ width: `${ring.pct}%`, backgroundColor: ring.color }} /></span>
              <span className="macro-metric__target">{ring.pct}% of {ring.target}{ring.unit === "kcal" ? " kcal" : ` ${ring.unit}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
