import { useState } from "react";
import { Icon } from "../../icons";
import { Tabs } from "../common/Tabs";
import { ProgressRing } from "../common/ProgressRing";
import { NutrientRhythmChart } from "./NutrientRhythmChart";
import type { View } from "../../types";

export function InsightsView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [timeframe, setTimeframe] = useState<"7D" | "30D" | "90D">("7D");
  const [simulatedProtein, setSimulatedProtein] = useState(90);
  const [streakDays, setStreakDays] = useState([true, true, true, true, true, false, false]);

  const toggleDayStreak = (index: number) => {
    setStreakDays((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const daysLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <p className="section-kicker">Transparent Health Patterns</p>
          <h2>Nutrition Insights</h2>
          <p className="view-header-subtitle">
            Grounded behavioral trends and habit insights—never arbitrary body scores.
          </p>
        </div>
        <Tabs
          tabs={[
            { id: "7D", label: "7 Days" },
            { id: "30D", label: "30 Days" },
            { id: "90D", label: "90 Days" },
          ]}
          activeTab={timeframe}
          onChange={(t) => setTimeframe(t as any)}
        />
      </div>

      <div className="insights-top-split">
        <div className="balance-score-card">
          <div style={{ maxWidth: "340px" }}>
            <p className="section-kicker">7-Day Habit Harmony</p>
            <h3 style={{ fontSize: "1.375rem", marginBottom: "var(--space-2)" }}>
              Balanced Nutrition Cadence
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Your protein intake has achieved <strong>86% consistency</strong> over the past week. Adding a leafy green or seasonal vegetable to dinner will lift fiber to optimal levels.
            </p>
          </div>
          <ProgressRing
            progress={82}
            size={120}
            strokeWidth={10}
            valueText="82%"
            label="Balance"
            color="var(--brand-primary)"
          />
        </div>

        {/* Interactive Habit Streak Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <p className="section-kicker">Habit Consistency</p>
              <h4 style={{ fontSize: "1rem" }}>Meal Logging Streak</h4>
            </div>
            <span className="badge badge-green">
              {streakDays.filter(Boolean).length} of 7 Days Logged
            </span>
          </div>

          <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            Tap days to log retrospective habits or check off today's milestones:
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", margin: "var(--space-4) 0" }}>
            {daysLabels.map((day, idx) => {
              const isChecked = streakDays[idx];
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDayStreak(idx)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                  }}
                  aria-label={`Toggle streak for ${day}`}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: isChecked ? "var(--brand-primary)" : "var(--bg-surface-subtle)",
                      color: isChecked ? "#fff" : "var(--text-muted)",
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid",
                      borderColor: isChecked ? "var(--brand-primary)" : "var(--border-default)",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    {isChecked ? <Icon name="check" size={16} strokeWidth={2.5} /> : day}
                  </div>
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    {day}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <NutrientRhythmChart />

      {/* Interactive What-If Nutrition Target Simulator */}
      <div
        className="card"
        style={{
          marginTop: "var(--space-6)",
          padding: "var(--space-6)",
          background: "linear-gradient(135deg, #ffffff 0%, #f7faf6 100%)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="card-header" style={{ marginBottom: "var(--space-3)" }}>
          <div>
            <p className="section-kicker">Interactive What-If Simulator</p>
            <h4 style={{ fontSize: "1.125rem" }}>Simulate Daily Protein Target</h4>
          </div>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--brand-primary)" }}>
            {simulatedProtein} g / day
          </span>
        </div>

        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
          Drag the slider to preview how adjusting your protein intake will reshape your daily meal plans:
        </p>

        <input
          type="range"
          min="50"
          max="160"
          step="5"
          value={simulatedProtein}
          onChange={(e) => setSimulatedProtein(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--brand-primary)", cursor: "pointer", marginBottom: "var(--space-4)" }}
          aria-label="Simulated protein target"
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "var(--space-4)",
            padding: "var(--space-4)",
            backgroundColor: "var(--bg-surface-subtle)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.8125rem",
          }}
        >
          <div>
            <strong style={{ display: "block", color: "var(--text-primary)" }}>Breakfast Target</strong>
            <span style={{ color: "var(--text-muted)" }}>~{Math.round(simulatedProtein * 0.3)}g (e.g. 2 eggs + Greek yogurt)</span>
          </div>
          <div>
            <strong style={{ display: "block", color: "var(--text-primary)" }}>Lunch Target</strong>
            <span style={{ color: "var(--text-muted)" }}>~{Math.round(simulatedProtein * 0.4)}g (e.g. Phở Bò + extra beef)</span>
          </div>
          <div>
            <strong style={{ display: "block", color: "var(--text-primary)" }}>Dinner Target</strong>
            <span style={{ color: "var(--text-muted)" }}>~{Math.round(simulatedProtein * 0.3)}g (e.g. Lemongrass chicken)</span>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: "var(--space-6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          backgroundColor: "var(--bg-surface-subtle)",
          border: "1px solid var(--border-strong)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--brand-primary)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="sparkles" size={20} />
          </div>
          <div>
            <strong style={{ fontSize: "0.9375rem", color: "var(--text-primary)" }}>
              Weekly Reflection Summary
            </strong>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
              You maintain high-protein breakfasts and steady hydration. Your next growth habit: integrating colorful cruciferous vegetables.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate("assistant")}
          style={{ whiteSpace: "nowrap" }}
        >
          Discuss with AI <Icon name="arrow" size={14} />
        </button>
      </div>
    </div>
  );
}
