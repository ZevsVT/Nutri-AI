import { useEffect, useState } from "react";
import { Button } from "../common/Button";
import {
  initialOperation,
  operationTypes,
  reviewRequest,
  type CatalogFood,
  type Draft,
  type Evidence,
  type OperationType,
} from "../../services/reviewService";

type Field = {
  name: string;
  options?: readonly string[];
  numeric?: boolean;
  required?: boolean;
  max?: number;
};
const foodFields: Field[] = [
  { name: "nameVi", required: true },
  { name: "nameEn" },
  { name: "description", max: 4000 },
  {
    name: "foodType",
    options: [
      "INGREDIENT",
      "DISH",
      "MEAL",
      "BEVERAGE",
      "CONDIMENT",
      "SNACK",
      "DESSERT",
      "PACKAGED_FOOD",
    ],
  },
  {
    name: "category",
    options: [
      "STAPLE",
      "RICE",
      "NOODLES",
      "MAIN_DISH",
      "SOUP",
      "MEAT",
      "POULTRY",
      "SEAFOOD",
      "EGGS",
      "VEGETABLES",
      "FRUITS",
      "PLANT_PROTEIN",
      "SNACK",
      "DESSERT",
      "BEVERAGE",
      "CONDIMENT",
      "PACKAGED_FOOD",
    ],
  },
  { name: "subcategory", max: 100 },
  { name: "cuisine", max: 100 },
  { name: "region", options: ["NORTH", "CENTRAL", "SOUTH", "NATIONWIDE"] },
  {
    name: "cookingMethod",
    options: [
      "RAW",
      "BOILED",
      "STEAMED",
      "GRILLED",
      "BAKED",
      "FRIED",
      "STIR_FRIED",
      "BRAISED",
      "SIMMERED",
      "FERMENTED",
      "DRIED",
      "OTHER",
    ],
  },
  {
    name: "servingUnit",
    options: [
      "GRAM",
      "MILLILITER",
      "BOWL",
      "PLATE",
      "PIECE",
      "SLICE",
      "CUP",
      "TABLESPOON",
      "TEASPOON",
      "SERVING",
    ],
  },
  { name: "defaultServingSize", numeric: true },
];
const productFields: Field[] = [
  { name: "productName", required: true },
  { name: "packageQuantity", numeric: true, required: true },
  { name: "packageUnit", options: ["g", "ml", "piece"], required: true },
];
const nutrients = [
  "calories",
  "protein",
  "carbohydrates",
  "fat",
  "fiber",
  "sugar",
  "sodium",
];
const title = (value: string) =>
  value.replace(/([A-Z])/g, " $1").replace(/_/g, " ");

export function DraftEditor({
  draft,
  food,
  editing,
  pending,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft;
  food: CatalogFood | null;
  editing: boolean;
  pending: boolean;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [sourceError, setSourceError] = useState("");
  useEffect(() => {
    let active = true;
    reviewRequest<{ id: string; name: string }[]>(
      "/nutrition-sources?pageSize=100",
    )
      .then((r) => {
        if (active) setSources(r);
      })
      .catch((e) => {
        if (active) setSourceError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const op = draft.operation;
  const update = (values: Record<string, unknown>) =>
    onChange({ ...draft, operation: { ...op, ...values } });
  const fields = (op.fields ?? {}) as Record<string, unknown>;
  const product = (op.product ?? {}) as Record<string, unknown>;
  function renderFields(
    definitions: Field[],
    values: Record<string, unknown>,
    change: (next: Record<string, unknown>) => void,
    optional = false,
  ) {
    return definitions.map((field) => {
      const included = Object.prototype.hasOwnProperty.call(values, field.name);
      return (
        <div className="review-field" key={field.name}>
          {optional && (
            <label className="review-check">
              <input
                type="checkbox"
                checked={included}
                onChange={(e) => {
                  const next = { ...values };
                  if (e.target.checked)
                    next[field.name] = food?.[field.name] ?? null;
                  else delete next[field.name];
                  change(next);
                }}
              />
              Change {title(field.name)}
            </label>
          )}
          <label>
            {title(field.name)}
            {field.options ? (
              <select
                disabled={optional && !included}
                required={field.required && (!optional || included)}
                value={String(values[field.name] ?? "")}
                onChange={(e) =>
                  change({ ...values, [field.name]: e.target.value || null })
                }
              >
                <option value="">
                  {field.required ? "Choose…" : "Unknown / clear"}
                </option>
                {field.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                disabled={optional && !included}
                type={field.numeric ? "number" : "text"}
                min={field.numeric ? "0.001" : undefined}
                max={field.numeric ? "999999999" : undefined}
                step={field.numeric ? "any" : undefined}
                maxLength={field.max ?? 160}
                required={field.required && (!optional || included)}
                value={String(values[field.name] ?? "")}
                onChange={(e) =>
                  change({
                    ...values,
                    [field.name]:
                      e.target.value === ""
                        ? null
                        : field.numeric
                          ? Number(e.target.value)
                          : e.target.value,
                  })
                }
              />
            )}
          </label>
        </div>
      );
    });
  }
  function evidenceChange(index: number, changes: Partial<Evidence>) {
    onChange({
      ...draft,
      evidence: draft.evidence.map((e, i) =>
        i === index ? { ...e, ...changes } : e,
      ),
    });
  }
  const productNeeded =
    op.type === "CREATE_FOOD" && fields.foodType === "PACKAGED_FOOD";
  return (
    <form
      className="review-editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h2>{editing ? "Edit your draft" : "New proposal"}</h2>
      <p>
        Saving stages a proposal. Publication requires approval by another
        administrator.
      </p>
      {draft.predecessorId && <p>Successor to {draft.predecessorId}</p>}
      <fieldset disabled={pending}>
        <legend>Proposed changes</legend>
        <label>
          Operation
          <select
            value={op.type}
            disabled={editing}
            onChange={(e) => updateOperation(e.target.value as OperationType)}
          >
            {operationTypes
              .filter((t) =>
                food
                  ? t !== "CREATE_FOOD" &&
                    (food.packagedProduct ||
                      ![
                        "UPDATE_PRODUCT",
                        "ADD_BARCODE",
                        "SET_BARCODE_STATUS",
                      ].includes(t))
                  : t === "CREATE_FOOD",
              )
              .map((t) => (
                <option key={t}>{t}</option>
              ))}
          </select>
        </label>
        {op.type === "CREATE_FOOD" && (
          <label>
            Canonical identity (permanent)
            <input
              required
              maxLength={160}
              value={String(op.canonicalName ?? "")}
              onChange={(e) => update({ canonicalName: e.target.value })}
            />
          </label>
        )}
        {(op.type === "CREATE_FOOD" || op.type === "UPDATE_FOOD") && (
          <div className="review-fields">
            {renderFields(
              foodFields,
              fields,
              (next) => {
                const operation: typeof op = { ...op, fields: next };
                if (
                  op.type === "CREATE_FOOD" &&
                  next.foodType !== "PACKAGED_FOOD"
                )
                  delete operation.product;
                onChange({ ...draft, operation });
              },
              op.type === "UPDATE_FOOD",
            )}
          </div>
        )}
        {productNeeded && (
          <>
            <h3>Permanent product identity</h3>
            <div className="review-fields">
              {renderFields(
                [
                  ...productFields,
                  { name: "brand", required: true },
                  { name: "formulation", required: true },
                  { name: "sourceId", required: true, max: 36 },
                ],
                product,
                (next) => update({ product: next }),
              )}
            </div>
          </>
        )}
        {op.type === "UPDATE_PRODUCT" && (
          <div className="review-fields">
            {renderFields(
              productFields,
              fields,
              (next) => update({ fields: next }),
              true,
            )}
          </div>
        )}
        {op.type === "ADD_ALIAS" && (
          <div className="review-fields">
            {renderFields(
              [
                { name: "alias", required: true, max: 200 },
                { name: "language", required: true, max: 10 },
              ],
              op,
              (next) => onChange({ ...draft, operation: { ...op, ...next } }),
            )}
          </div>
        )}
        {op.type === "REMOVE_ALIAS" && (
          <label>
            Alias to remove
            <select
              required
              value={String(op.aliasId ?? "")}
              onChange={(e) => update({ aliasId: e.target.value })}
            >
              <option value="">Choose…</option>
              {food?.aliases
                ?.filter((a) => a.isActive)
                .map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.alias} ({a.language})
                  </option>
                ))}
            </select>
          </label>
        )}
        {op.type === "PUBLISH_NUTRITION" && (
          <>
            <p>
              Use source facts. Leave unknown nutrients blank. Energy: kcal;
              sodium: mg; other nutrients: g.
            </p>
            <div className="review-fields">
              {renderFields(
                [
                  { name: "sourceId", required: true, max: 36 },
                  { name: "sourceVersion", required: true, max: 80 },
                  { name: "referenceQuantity", required: true, numeric: true },
                  {
                    name: "referenceUnit",
                    required: true,
                    options: ["g", "ml", "serving"],
                  },
                  { name: "preparationState", required: true, max: 100 },
                ],
                op,
                (next) => onChange({ ...draft, operation: { ...op, ...next } }),
              )}
            </div>
            <div className="review-fields">
              {nutrients.map((n) => (
                <label key={n}>
                  {n}
                  <input
                    type="number"
                    min="0"
                    max="999999999"
                    step="any"
                    value={String(
                      (op.values as Record<string, unknown>)[n] ?? "",
                    )}
                    onChange={(e) =>
                      update({
                        values: {
                          ...(op.values as object),
                          [n]:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </>
        )}
        {op.type === "WITHDRAW_NUTRITION" && (
          <p>
            This withdraws all current nutrition availability. Past versions and
            diary snapshots remain retained.
          </p>
        )}
        {(op.type === "ADD_BARCODE" || op.type === "SET_BARCODE_STATUS") && (
          <label>
            Barcode
            <input
              required
              inputMode="numeric"
              maxLength={14}
              value={String(op.barcode ?? "")}
              onChange={(e) => update({ barcode: e.target.value })}
            />
          </label>
        )}
        {(op.type === "SET_FOOD_STATUS" ||
          op.type === "SET_BARCODE_STATUS") && (
          <label>
            Lifecycle
            <select
              value={String(op.status)}
              onChange={(e) => update({ status: e.target.value })}
            >
              {["ACTIVE", "INACTIVE", "DEPRECATED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Explanation
          <textarea
            required
            maxLength={4000}
            value={draft.explanation}
            onChange={(e) =>
              onChange({ ...draft, explanation: e.target.value })
            }
          />
        </label>
        <h3>Supporting evidence</h3>
        <p>
          Product identity and nutrition require separate evidence. URLs are
          retained as references and never fetched automatically. Nutrition
          evidence must match the food, source and version; product evidence
          must match brand, formulation, source and barcode.
        </p>
        {sourceError && (
          <p role="alert">
            Sources could not load: {sourceError}. You can enter a known source
            ID.
          </p>
        )}
        <details>
          <summary>Available trusted sources (first 100)</summary>
          <ul>
            {sources.map((s) => (
              <li key={s.id}>
                {s.name}: {s.id}
              </li>
            ))}
          </ul>
        </details>
        {draft.evidence.map((e, i) => (
          <fieldset key={i}>
            <legend>Evidence {i + 1}</legend>
            <label>
              Evidence kind
              <select
                value={e.kind}
                onChange={(event) =>
                  evidenceChange(i, {
                    kind: event.target.value as Evidence["kind"],
                    ...(food ? { foodId: food.id } : {}),
                  })
                }
              >
                {["CATALOG", "PRODUCT", "NUTRITION"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              Source / document reference
              <input
                required
                maxLength={1000}
                value={e.reference}
                onChange={(event) =>
                  evidenceChange(i, { reference: event.target.value })
                }
              />
            </label>
            <label>
              Evidence URL (optional)
              <input
                type="url"
                maxLength={2000}
                value={e.url ?? ""}
                onChange={(event) =>
                  evidenceChange(i, { url: event.target.value || undefined })
                }
              />
            </label>
            {(e.kind === "PRODUCT" || e.kind === "NUTRITION") && (
              <div className="review-fields">
                {(e.kind === "PRODUCT"
                  ? [
                      "sourceId",
                      "brand",
                      "formulation",
                      ...(op.type === "ADD_BARCODE" ||
                      op.type === "SET_BARCODE_STATUS"
                        ? ["barcode"]
                        : []),
                    ]
                  : ["sourceId", "sourceVersion"]
                ).map((key) => (
                  <label key={key}>
                    {title(key)}
                    <input
                      required
                      maxLength={
                        key === "sourceId"
                          ? 36
                          : key === "sourceVersion"
                            ? 80
                            : key === "barcode"
                              ? 14
                              : 160
                      }
                      value={e[key as keyof Evidence] ?? ""}
                      onChange={(event) =>
                        evidenceChange(i, {
                          [key]: event.target.value,
                          ...(food ? { foodId: food.id } : {}),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            <Button
              disabled={draft.evidence.length <= 1}
              onClick={() =>
                onChange({
                  ...draft,
                  evidence: draft.evidence.filter((_, j) => i !== j),
                })
              }
            >
              Remove evidence
            </Button>
          </fieldset>
        ))}
        <Button
          disabled={draft.evidence.length >= 20}
          onClick={() =>
            onChange({
              ...draft,
              evidence: [
                ...draft.evidence,
                {
                  kind: "CATALOG",
                  reference: "",
                  ...(food ? { foodId: food.id } : {}),
                },
              ],
            })
          }
        >
          Add evidence
        </Button>
      </fieldset>
      <div className="review-toolbar">
        <Button type="submit" loading={pending}>
          Save draft
        </Button>
        <Button disabled={pending} onClick={onCancel}>
          Cancel editor
        </Button>
      </div>
    </form>
  );

  function updateOperation(type: OperationType) {
    onChange({ ...draft, operation: initialOperation(type, food) });
  }
}
