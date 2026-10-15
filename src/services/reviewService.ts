export const operationTypes = [
  "CREATE_FOOD",
  "UPDATE_FOOD",
  "ADD_ALIAS",
  "REMOVE_ALIAS",
  "PUBLISH_NUTRITION",
  "WITHDRAW_NUTRITION",
  "UPDATE_PRODUCT",
  "ADD_BARCODE",
  "SET_BARCODE_STATUS",
  "SET_FOOD_STATUS",
] as const;
export type OperationType = (typeof operationTypes)[number];
export type Operation = { type: OperationType } & Record<string, unknown>;
export interface CatalogFood {
  id: string;
  nameVi: string;
  canonicalName: string;
  status: string;
  aliases?: {
    id: string;
    alias: string;
    language: string;
    isActive: boolean;
  }[];
  packagedProduct?: Record<string, unknown> | null;
  barcodes?: { barcode: string; status: string }[];
  nutritionRecords?: {
    isActive: boolean;
    nutritionVersion: { sourceId: string; version: string };
  }[];
  [key: string]: unknown;
}
export interface Evidence {
  kind: "CATALOG" | "PRODUCT" | "NUTRITION";
  reference: string;
  url?: string;
  sourceId?: string;
  sourceVersion?: string;
  foodId?: string;
  barcode?: string;
  brand?: string;
  formulation?: string;
}
export interface ReviewSummary {
  id: string;
  authorId: string;
  operation: OperationType;
  targetFoodId: string | null;
  state: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  revision: number;
  predecessorId: string | null;
  createdAt: string;
  submittedAt: string | null;
}
export interface ReviewDetail extends ReviewSummary {
  stale: boolean;
  current: CatalogFood | null;
  content: {
    payload: Operation;
    evidence: Evidence[];
    explanation: string;
    baseline: { food: CatalogFood | null };
    baselineFingerprint: string;
  };
  warnings: string[];
  successor: { id: string } | null;
  comparison: {
    baseline: Record<string, unknown>;
    current: Record<string, unknown>;
    proposed: Record<string, unknown>;
    changes: { field: string; kind: string; before: unknown; after: unknown }[];
  };
  history: ReviewEvent[];
}
export interface ReviewEvent {
  id: string;
  action: string;
  actorId: string;
  revision: number;
  reason: string | null;
  createdAt: string;
  publication: unknown;
  content?: unknown;
}
export interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
export interface Draft {
  targetFoodId?: string;
  predecessorId?: string;
  operation: Operation;
  explanation: string;
  evidence: Evidence[];
}
export class ReviewRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
export async function reviewRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${base}/api/v1/admin${path}`, {
    method,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-food-review-request": "1",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    const details = result.error?.details;
    throw new ReviewRequestError(
      response.status,
      [
        result.error?.message ?? "Review request failed",
        ...(Array.isArray(details)
          ? details.map((d: string | { path?: string; message?: string }) =>
              typeof d === "string" ? d : `${d.path}: ${d.message}`,
            )
          : []),
      ].join(". "),
    );
  }
  return (
    result.meta ? { data: result.data, meta: result.meta } : result.data
  ) as T;
}

export function initialOperation(
  type: OperationType,
  food: CatalogFood | null,
): Operation {
  switch (type) {
    case "CREATE_FOOD":
      return {
        type,
        canonicalName: "",
        fields: { nameVi: "", foodType: "DISH" },
      };
    case "UPDATE_FOOD":
      return { type, fields: { nameVi: food?.nameVi ?? "" } };
    case "ADD_ALIAS":
      return { type, alias: "", language: "vi" };
    case "REMOVE_ALIAS":
      return {
        type,
        aliasId: food?.aliases?.find((a) => a.isActive)?.id ?? "",
      };
    case "PUBLISH_NUTRITION":
      return {
        type,
        sourceId: food?.packagedProduct?.sourceId ?? "",
        sourceVersion: "",
        referenceQuantity: 100,
        referenceUnit: "g",
        preparationState: String(food?.cookingMethod ?? "as sold"),
        values: {
          calories: null,
          protein: null,
          carbohydrates: null,
          fat: null,
          fiber: null,
          sugar: null,
          sodium: null,
        },
      };
    case "UPDATE_PRODUCT":
      return {
        type,
        fields: { productName: food?.packagedProduct?.productName ?? "" },
      };
    case "ADD_BARCODE":
      return { type, barcode: "" };
    case "SET_BARCODE_STATUS":
      return {
        type,
        barcode: food?.barcodes?.[0]?.barcode ?? "",
        status: "INACTIVE",
      };
    case "SET_FOOD_STATUS":
      return {
        type,
        status: food?.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      };
    case "WITHDRAW_NUTRITION":
      return { type };
  }
}
