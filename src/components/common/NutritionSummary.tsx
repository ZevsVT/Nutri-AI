import type { SavedNutrition } from "../../services/mealService";

const nutrients = [
  ["calories", "Energy", "kcal"],
  ["protein", "Protein", "g"],
  ["carbohydrates", "Carbohydrates", "g"],
  ["fat", "Fat", "g"],
  ["fiber", "Fiber", "g"],
] as const satisfies ReadonlyArray<readonly [keyof SavedNutrition, string, string]>;

export function NutritionSummary({ totals }: { totals: SavedNutrition }) {
  return (
    <dl className="result-nutrition-grid">
      {nutrients.map(([key, name, unit]) => (
        <div className="result-nutrient-tile" key={key}>
          <dt>{name}</dt>
          <dd>{totals[key] === null ? "Unknown" : `${totals[key]} ${unit}`}</dd>
        </div>
      ))}
    </dl>
  );
}
