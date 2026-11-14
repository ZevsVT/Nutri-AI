import { useEffect, useRef, useState } from "react";
import { searchCatalog, type CatalogFood } from "../../services/mealService";
import { Button } from "./Button";

export function FoodSearch({ onSelect }: { onSelect: (food: CatalogFood) => void }) {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<CatalogFood[]>([]);
  const [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function search() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setFoods([]);
    setMessage("Searching foods…");
    try {
      const results = await searchCatalog(query.trim(), controller.signal);
      if (controller.signal.aborted) return;
      setFoods(results);
      setMessage(results.length ? "" : "No matching foods. Try another name.");
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(error instanceof Error ? error.message : "Food search failed.");
    }
  }

  return (
    <div className="form-group">
      <label className="form-label">
        Food name
        <input className="form-input" value={query} maxLength={160}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              void search();
            }
          }}
        />
      </label>
      <Button disabled={!query.trim()} onClick={() => void search()}>Search catalog</Button>
      {message && <p role="status">{message}</p>}
      {foods.length > 0 && (
        <ul>
          {foods.map((food) => (
            <li key={food.id}>
              <Button onClick={() => onSelect(food)}>{food.name.vi}{food.name.en && ` · ${food.name.en}`}</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
