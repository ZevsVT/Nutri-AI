import { Icon } from "../../icons";
import { Button } from "../common/Button";
import { MultiRingMacroTracker } from "../common/MultiRingMacroTracker";
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
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.9)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-4) var(--space-5)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <MultiRingMacroTracker totals={totals} goals={goals} size={150} />
      </div>
    </section>
  );
}
