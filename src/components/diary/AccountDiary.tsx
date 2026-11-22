import { useEffect, useState } from "react";
import { ApiError } from "../../services/apiClient";
import { listMeals, mealTypes, readMeal, type SavedMeal } from "../../services/mealService";
import { Button } from "../common/Button";
import { SavedMealDetail } from "./SavedMealDetail";

export function AccountDiary({ revision, selectedId, onSelect, onWrite, onNew, onOpenBarcode, onExpired }: {
  revision: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onWrite: () => void;
  onNew: () => void;
  onOpenBarcode: () => void;
  onExpired: () => void;
}) {
  const [page, setPage] = useState(1);
  const [day, setDay] = useState("");
  const [mealType, setMealType] = useState("");
  const [status, setStatus] = useState("CONFIRMED");
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [selected, setSelected] = useState<SavedMeal | null>(null);
  const [busy, setBusy] = useState(true);
  const [detailBusy, setDetailBusy] = useState(false);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setListError("");
    void listMeals({ page, day, mealType, status }, controller.signal).then(({ data, meta }) => {
      if (controller.signal.aborted) return;
      const last = meta?.totalPages ?? 0;
      if (page > Math.max(1, last)) {
        setPage(Math.max(1, last));
        return;
      }
      setMeals(data);
      setPageCount(last);
      setBusy(false);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) onExpired();
      setListError(error instanceof Error ? error.message : "Could not load your meals.");
      setBusy(false);
    });
    return () => controller.abort();
  }, [page, day, mealType, status, revision, onExpired]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      setDetailError("");
      return;
    }
    const controller = new AbortController();
    setDetailBusy(true);
    setDetailError("");
    void readMeal(selectedId, controller.signal).then((meal) => {
      if (controller.signal.aborted) return;
      setSelected(meal);
      setDetailBusy(false);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) onExpired();
      setDetailError(error instanceof Error ? error.message : "Could not open the meal.");
      setDetailBusy(false);
    });
    return () => controller.abort();
  }, [selectedId, revision, onExpired]);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Food Diary</h2>
        <div className="dropzone-actions">
          <Button icon="scan" onClick={onOpenBarcode}>Scan barcode</Button>
          <Button variant="primary" onClick={onNew}>Log a meal</Button>
        </div>
      </div>
      <section className="card">
        <div className="dropzone-actions">
          <label className="form-label">
            Meal date
            <input className="form-input" type="date" value={day}
              onChange={(e) => { setDay(e.target.value); setPage(1); }} />
          </label>
          <label className="form-label">
            Meal type
            <select className="form-input" value={mealType} onChange={(e) => { setMealType(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              {Object.entries(mealTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="form-label">
            Status
            <select className="form-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="CONFIRMED">Confirmed</option>
              <option value="">All statuses</option>
            </select>
          </label>
        </div>
        {listError ? <div role="alert">{listError} <Button onClick={onWrite}>Retry</Button></div>
          : busy ? <p role="status">Loading your meals…</p>
            : !meals.length ? <p>No meals match these filters.</p>
              : (
                <ul>
                  {meals.map((meal) => (
                    <li key={meal.id}>
                      <Button onClick={() => onSelect(meal.id)}>{meal.name}</Button>
                      {" · "}{mealTypes[meal.mealType]} · {new Date(meal.capturedAt).toLocaleString()}
                      {" · "}{meal.totals.calories === null ? "Energy unknown" : `${meal.totals.calories} kcal`}
                    </li>
                  ))}
                </ul>
              )}
        {!busy && !listError && pageCount > 1 && (
          <div>
            <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span> Page {page} of {pageCount} </span>
            <Button disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </section>
      {selectedId && detailError && (
        <p role="alert">{detailError} <Button onClick={onWrite}>Retry detail</Button> <Button onClick={() => onSelect(null)}>Dismiss</Button></p>
      )}
      {selectedId && detailBusy && <p role="status">Loading meal details…</p>}
      {selected && selected.id === selectedId && !detailBusy && !detailError && (
        <SavedMealDetail key={`${selected.id}-${revision}`} meal={selected} onClose={() => onSelect(null)}
          onUpdated={onWrite} onDeleted={() => { onSelect(null); onWrite(); }} onExpired={onExpired} />
      )}
    </div>
  );
}
