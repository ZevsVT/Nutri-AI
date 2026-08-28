import { Icon } from "../../icons";
import type { Meal } from "../../types";

interface TodayMealsProps {
  meals: Meal[];
  onSelectMeal: (meal: Meal) => void;
  onAddMeal: () => void;
  onViewDiary: () => void;
}

export function TodayMeals({
  meals,
  onSelectMeal,
  onAddMeal,
  onViewDiary,
}: TodayMealsProps) {
  return (
    <section className="meals-section-panel">
      <div className="card-header">
        <div>
          <p className="section-kicker">Today's journal</p>
          <h3 style={{ fontSize: "1.125rem" }}>Logged Meals</h3>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onViewDiary}
          style={{ color: "var(--brand-primary)", fontWeight: 700 }}
        >
          View full diary <Icon name="arrow" size={14} />
        </button>
      </div>

      <div className="meals-list-flow">
        {meals.map((meal) => (
          <article
            key={meal.id}
            className="meal-row-card"
            onClick={() => onSelectMeal(meal)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectMeal(meal);
              }
            }}
            aria-label={`View details for ${meal.name}`}
          >
            <div className="meal-thumbnail-box">
              <img src={meal.image} alt={meal.name} loading="lazy" />
            </div>
            <div className="meal-meta-content">
              <div className="meal-header-sub">
                <span>{meal.type}</span>
                <span>·</span>
                <span className="meal-time-stamp">{meal.time}</span>
              </div>
              <h4 className="meal-title-text">{meal.name}</h4>
              <p className="meal-ingredients-preview">{meal.description}</p>
              <div className="meal-nutrients-pills">
                <span style={{ color: "var(--text-primary)" }}>{meal.calories} kcal</span>
                <span>·</span>
                <span>{meal.protein}g protein</span>
                <span>·</span>
                <span>{meal.fiber}g fiber</span>
                <span
                  style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    backgroundColor: "var(--bg-surface)",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-xs)",
                    fontSize: "0.6875rem",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <span className="confidence-dot" />
                  {Math.round(meal.confidence * 100)}%
                </span>
              </div>
            </div>
            <Icon name="chevron-right" size={16} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
          </article>
        ))}

        <button
          type="button"
          className="meal-add-action-bar"
          onClick={onAddMeal}
        >
          <Icon name="plus" size={16} />
          <span>Log another meal (Photo, barcode, or search)</span>
        </button>
      </div>
    </section>
  );
}
