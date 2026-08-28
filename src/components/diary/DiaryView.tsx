import { useState, useMemo } from "react";
import { Icon } from "../../icons";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { MacroBalanceCard } from "./MacroBalanceCard";
import { MealDetailModal } from "./MealDetailModal";
import { calculateDailyTotals } from "../../services/nutritionEngine";
import { weeklyNutrientTrends } from "../../data";
import type { Meal, MealType, UserGoals, View } from "../../types";

interface DiaryViewProps {
  meals: Meal[];
  goals: UserGoals;
  onDeleteMeal: (id: string) => void;
  onNavigate: (view: View) => void;
  initialSearch?: string;
}

export function DiaryView({
  meals,
  goals,
  onDeleteMeal,
  onNavigate,
  initialSearch = "",
}: DiaryViewProps) {
  const [selectedDay, setSelectedDay] = useState("Sat");
  const [activeFilter, setActiveFilter] = useState<"All" | "High Protein" | "Fiber Rich">("All");
  const [query, setQuery] = useState(initialSearch);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

  const filteredMeals = useMemo(() => {
    return meals.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.description.toLowerCase().includes(query.toLowerCase()) ||
        m.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()));

      if (!matchSearch) return false;

      if (activeFilter === "High Protein") return m.protein >= 20;
      if (activeFilter === "Fiber Rich") return m.fiber >= 5;
      return true;
    });
  }, [meals, query, activeFilter]);

  const dailyTotals = useMemo(() => {
    return calculateDailyTotals(meals);
  }, [meals]);

  const mealTypes: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <p className="section-kicker">Transparent Food Journal</p>
          <h2>Food Diary</h2>
          <p className="view-header-subtitle">
            A clear, non-judgmental record of everything you have logged.
          </p>
        </div>
        <Button
          variant="primary"
          icon="plus"
          onClick={() => onNavigate("analyze")}
        >
          Log a Meal
        </Button>
      </div>

      {/* 7-Day Interactive Calendar Strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          overflowX: "auto",
          paddingBottom: "var(--space-2)",
          marginBottom: "var(--space-5)",
        }}
        role="tablist"
        aria-label="Day selection"
      >
        {weeklyNutrientTrends.map((d) => {
          const isSelected = selectedDay === d.day;
          return (
            <button
              key={d.day}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedDay(d.day)}
              style={{
                flex: "1",
                minWidth: "85px",
                padding: "8px 10px",
                borderRadius: "var(--radius-md)",
                backgroundColor: isSelected ? "var(--brand-primary)" : "var(--bg-surface)",
                color: isSelected ? "#fff" : "var(--text-primary)",
                border: "1px solid",
                borderColor: isSelected ? "var(--brand-primary)" : "var(--border-subtle)",
                boxShadow: isSelected ? "0 4px 14px rgba(31, 99, 70, 0.25)" : "var(--shadow-xs)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
              }}
            >
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", opacity: isSelected ? 0.9 : 0.6 }}>
                {d.day}
              </span>
              <strong style={{ fontSize: "0.9375rem" }}>
                {d.date.replace(/^[A-Za-z]+\s*/, "")}
              </strong>
              <small style={{ fontSize: "0.6875rem", opacity: isSelected ? 0.9 : 0.7 }}>
                {d.day === "Sat" ? `${meals.length} meals` : `${d.protein}g P`}
              </small>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          marginBottom: "var(--space-5)",
        }}
      >
        <div style={{ display: "flex", gap: "6px" }}>
          {(["All", "High Protein", "Fiber Rich"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`btn btn-sm ${activeFilter === filter ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.75rem", padding: "4px 10px" }}
            >
              {filter}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: "220px" }}>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: "34px", paddingRight: "10px", height: "36px", fontSize: "0.8125rem" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter meals by name..."
            aria-label="Filter diary entries"
          />
          <div style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
            <Icon name="search" size={15} />
          </div>
        </div>
      </div>

      <div className="diary-view-layout">
        <div>
          {filteredMeals.length === 0 ? (
            <EmptyState
              icon="book"
              title="No meals found"
              description="No entries matched your search filter. Try another keyword or capture your current meal."
              actionLabel="Analyze a meal"
              onAction={() => onNavigate("analyze")}
            />
          ) : (
            mealTypes.map((type) => {
              const typeMeals = filteredMeals.filter((m) => m.type === type);
              if (typeMeals.length === 0) return null;

              return (
                <div key={type} className="diary-timeline-group">
                  <div className="diary-group-header">
                    <span>{type}</span>
                    <div className="diary-group-line" />
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      {typeMeals.reduce((s, m) => s + m.calories, 0)} kcal
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {typeMeals.map((meal) => (
                      <article
                        key={meal.id}
                        className="meal-row-card"
                        onClick={() => setSelectedMeal(meal)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedMeal(meal);
                          }
                        }}
                      >
                        <div className="meal-thumbnail-box">
                          <img src={meal.image} alt={meal.name} loading="lazy" />
                        </div>
                        <div className="meal-meta-content">
                          <div className="meal-header-sub">
                            <span className="meal-time-stamp">{meal.time}</span>
                            <span>·</span>
                            <span>{meal.portion}</span>
                          </div>
                          <h4 className="meal-title-text">{meal.name}</h4>
                          <p className="meal-ingredients-preview">{meal.description}</p>
                          <div className="meal-nutrients-pills">
                            <span style={{ color: "var(--text-primary)" }}>{meal.calories} kcal</span>
                            <span>·</span>
                            <span style={{ color: "var(--nutrient-protein-text)" }}>{meal.protein}g protein</span>
                            <span>·</span>
                            <span style={{ color: "var(--nutrient-fiber-text)" }}>{meal.fiber}g fiber</span>
                          </div>
                        </div>
                        <Icon name="chevron-right" size={16} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
                      </article>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div>
          <MacroBalanceCard totals={dailyTotals} goals={goals} />
        </div>
      </div>

      <MealDetailModal
        meal={selectedMeal}
        isOpen={selectedMeal !== null}
        onClose={() => setSelectedMeal(null)}
        onDeleteMeal={onDeleteMeal}
      />
    </div>
  );
}
