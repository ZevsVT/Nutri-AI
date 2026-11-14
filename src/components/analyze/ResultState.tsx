import { Button } from "../common/Button";
import type { SavedMeal, SavedNutrition } from "../../services/mealService";

const nutrients = [
  ["calories", "Energy", "kcal"],
  ["protein", "Protein", "g"],
  ["carbohydrates", "Carbohydrates", "g"],
  ["fat", "Fat", "g"],
  ["fiber", "Fiber", "g"],
] as const satisfies ReadonlyArray<readonly [keyof SavedNutrition, string, string]>;

function NutritionSummary({ totals }: { totals: SavedNutrition }) {
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

export function ResultState({ meal, onReset }: { meal: SavedMeal; onReset: () => void }) {
  return (
    <section className="card">
      <h3>{meal.name}</h3>
      <p role="status">Meal saved to your food diary.</p>
      <NutritionSummary totals={meal.totals} />
      <ul>
        {meal.items.map((item) => (
          <li key={item.id}>
            <strong>{item.displayName}</strong> · {item.quantity} {item.unit}
            {item.provenance && <p>{item.provenance.source} ({item.provenance.version})</p>}
          </li>
        ))}
      </ul>
      <Button onClick={onReset}>Log another meal</Button>
    </section>
  );
}
