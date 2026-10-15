import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import { parseOrThrow } from "../../common/middleware/request-validation.js";
import { permissionsForRole } from "../../common/types/permissions.js";
import type { RequestUser } from "../../common/types/request-context.js";
import { normalizeNutrition } from "../nutrition/nutrition-normalization.js";
import {
  draftSchema,
  operationSchema,
  type DraftInput,
  type EditDraftInput,
  type Evidence,
  type ReviewOperation,
} from "./review.schemas.js";
import {
  type ReviewRepository,
  fingerprint,
  json,
  type PublishedFood,
  type ReviewRecord,
  type ReviewTransaction,
} from "./review.repository.js";

export function requireReviewPermission(
  user: RequestUser,
  permission: string,
): void {
  if (!permissionsForRole(user.role).includes(permission))
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "You do not have permission for this review action",
    );
}

function own(user: RequestUser, review: ReviewRecord) {
  requireReviewPermission(user, "food-reviews:write");
  if (review.authorId !== user.id)
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Only the author can change this proposal",
    );
}

function expected(review: ReviewRecord, revision: number, states: string[]) {
  if (review.revision !== revision)
    throw new AppError(
      "CONFLICT",
      "Review revision has changed; reload before deciding",
    );
  if (!states.includes(review.state))
    throw new AppError(
      "INVALID_STATE",
      "This action is not allowed in the current review state",
    );
}

function publishedFoodId(review: ReviewRecord): string | null {
  const publication = review.history.find(
    (event) => event.action === "APPROVED",
  )?.publication;
  return publication &&
    typeof publication === "object" &&
    !Array.isArray(publication) &&
    typeof publication.foodId === "string"
    ? publication.foodId
    : null;
}

export function evidenceWarnings(
  operation: ReviewOperation,
  evidence: Evidence[],
  food: PublishedFood | null,
): string[] {
  const warnings: string[] = [];
  if (
    operation.type === "PUBLISH_NUTRITION" &&
    !evidence.some(
      (e) =>
        e.kind === "NUTRITION" &&
        e.foodId === food?.id &&
        e.sourceId === operation.sourceId &&
        e.sourceVersion === operation.sourceVersion,
    )
  )
    warnings.push(
      "Nutrition evidence must identify this food, source and source version; AI suggestions are not nutrition evidence.",
    );
  if (
    operation.type === "WITHDRAW_NUTRITION" &&
    !evidence.some(
      (e) =>
        e.kind === "NUTRITION" &&
        e.foodId === food?.id &&
        food?.nutritionRecords.some(
          (n) =>
            n.isActive &&
            n.nutritionVersion.sourceId === e.sourceId &&
            n.nutritionVersion.version === e.sourceVersion,
        ),
    )
  )
    warnings.push(
      "Withdrawal evidence must identify a currently available food/source version.",
    );
  const product =
    operation.type === "CREATE_FOOD"
      ? operation.product
      : food?.packagedProduct;
  if (
    operation.type === "UPDATE_PRODUCT" ||
    operation.type === "ADD_BARCODE" ||
    operation.type === "SET_BARCODE_STATUS" ||
    (operation.type === "CREATE_FOOD" && product) ||
    (operation.type === "PUBLISH_NUTRITION" && product)
  ) {
    if (
      !product ||
      !evidence.some(
        (e) =>
          e.kind === "PRODUCT" &&
          e.brand === product.brand &&
          e.formulation === product.formulation &&
          e.sourceId === product.sourceId &&
          (operation.type === "CREATE_FOOD" || e.foodId === food?.id) &&
          (!("barcode" in operation) || e.barcode === operation.barcode),
      )
    )
      warnings.push(
        "Product evidence must match the brand, formulation, source, target food and any barcode being changed.",
      );
  }
  if (operation.type === "PUBLISH_NUTRITION") {
    const normalized = normalizeNutrition({
      ...operation,
      foodId: food?.id ?? "new",
      source: "review",
      values: operation.values,
    });
    if (normalized.consistencyWarning)
      warnings.push(
        "Calories differ substantially from macro energy; verify against the source.",
      );
  }
  return warnings;
}

async function validateDomain(
  tx: ReviewTransaction,
  input: Pick<DraftInput, "operation" | "evidence">,
  targetFoodId?: string,
) {
  const food = targetFoodId ? await tx.food(targetFoodId) : null;
  const op = input.operation;
  if (
    op.type === "PUBLISH_NUTRITION" ||
    (op.type === "CREATE_FOOD" && op.product)
  ) {
    const id =
      op.type === "PUBLISH_NUTRITION" ? op.sourceId : op.product!.sourceId;
    const source = await tx.source(id);
    if (!source || source.sourceType === "USER_SUBMITTED")
      throw new AppError(
        "VALIDATION_ERROR",
        "A trusted catalog source is required",
      );
    if (
      op.type === "PUBLISH_NUTRITION" &&
      food?.packagedProduct &&
      food.packagedProduct.sourceId !== id
    )
      throw new AppError(
        "VALIDATION_ERROR",
        "Nutrition source must match the product source",
      );
  }
  if (
    op.type === "UPDATE_FOOD" &&
    op.fields.foodType !== undefined &&
    Boolean(food?.packagedProduct) !== (op.fields.foodType === "PACKAGED_FOOD")
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "A metadata edit cannot change packaged-product identity",
    );
  if (
    ["UPDATE_PRODUCT", "ADD_BARCODE", "SET_BARCODE_STATUS"].includes(op.type) &&
    !food?.packagedProduct
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "This operation requires a packaged product",
    );
  const warnings = evidenceWarnings(op, input.evidence, food);
  const errors = warnings.filter((w) => !w.startsWith("Calories"));
  if (errors.length)
    throw new AppError(
      "VALIDATION_ERROR",
      "Evidence does not support the proposed operation",
      { details: errors },
    );
  return warnings;
}

export class ReviewService {
  constructor(readonly repository: ReviewRepository) {}

  async create(user: RequestUser, input: DraftInput) {
    requireReviewPermission(user, "food-reviews:write");
    const id = randomUUID();
    await this.repository.transaction(async (tx) => {
      if (input.predecessorId) {
        const predecessor = await tx.review(input.predecessorId);
        own(user, predecessor);
        if (
          ["DRAFT", "SUBMITTED"].includes(predecessor.state) ||
          (predecessor.targetFoodId ?? publishedFoodId(predecessor)) !==
            (input.targetFoodId ?? null)
        )
          throw new AppError(
            "CONFLICT",
            "A successor must reference your terminal proposal for the same target",
          );
      }
      await validateDomain(tx, input, input.targetFoodId);
      const baseline = await tx.baseline(input.targetFoodId, input.operation);
      await tx.create(id, user.id, input, baseline);
      await tx.reserve(id, input.operation);
    });
    return this.detail(id);
  }

  async edit(user: RequestUser, id: string, input: EditDraftInput) {
    await this.repository.transaction(async (tx) => {
      const review = await tx.review(id);
      own(user, review);
      expected(review, input.revision, ["DRAFT"]);
      const draft = parseOrThrow(
        draftSchema,
        {
          operation: input.operation,
          explanation: input.explanation,
          evidence: input.evidence,
          targetFoodId: review.targetFoodId ?? undefined,
          predecessorId: review.predecessorId ?? undefined,
        },
        "body",
      );
      if (draft.operation.type !== review.operation)
        throw new AppError(
          "VALIDATION_ERROR",
          "Operation type cannot change; create a successor instead",
        );
      await validateDomain(tx, draft, review.targetFoodId ?? undefined);
      const revision = review.revision + 1;
      const previous = review.revisions[0]!;
      const baseline = previous.baseline as {
        food: unknown;
        source: { id: string } | null;
      };
      const sourceId =
        draft.operation.type === "PUBLISH_NUTRITION"
          ? draft.operation.sourceId
          : draft.operation.type === "CREATE_FOOD"
            ? draft.operation.product?.sourceId
            : undefined;
      // A different proposed source captures that source; food values never silently rebase.
      const source =
        sourceId !== baseline.source?.id
          ? sourceId
            ? await tx.source(sourceId)
            : null
          : baseline.source;
      await tx.revision(
        id,
        revision,
        draft,
        json({ food: baseline.food, source }),
      );
      await tx.reserve(id, draft.operation);
      await tx.update(id, review.revision, { revision });
      await tx.audit(id, revision, user.id, "EDITED");
    });
    return this.detail(id);
  }

  async transition(
    user: RequestUser,
    id: string,
    revision: number,
    action: "submit" | "withdraw" | "approve" | "reject",
    reason?: string,
  ) {
    await this.repository.transaction(async (tx) => {
      const review = await tx.review(id);
      if (action === "submit" || action === "withdraw") own(user, review);
      else requireReviewPermission(user, "food-reviews:decide");
      expected(
        review,
        revision,
        action === "submit"
          ? ["DRAFT"]
          : action === "withdraw"
            ? ["DRAFT", "SUBMITTED"]
            : ["SUBMITTED"],
      );
      if (action === "approve" && review.authorId === user.id)
        throw new AppError(
          "AUTHORIZATION_ERROR",
          "Authors cannot approve their own proposals",
        );
      if (action === "reject" && !reason?.trim())
        throw new AppError("VALIDATION_ERROR", "Rejection requires a reason");
      const content = review.revisions[0]!;
      const operation = parseOrThrow(operationSchema, content.payload, "body");
      const input = parseOrThrow(
        draftSchema,
        {
          operation,
          targetFoodId: review.targetFoodId ?? undefined,
          explanation: content.explanation,
          evidence: content.evidence,
        },
        "body",
      );
      if (action === "submit" || action === "approve") {
        const current = await tx.baseline(
          review.targetFoodId ?? undefined,
          operation,
        );
        if (fingerprint(current) !== content.baselineFingerprint)
          throw new AppError(
            "CONFLICT",
            "Published data changed; withdraw and create a successor with a fresh baseline",
          );
        await validateDomain(tx, input, review.targetFoodId ?? undefined);
      }
      const publication =
        action === "approve"
          ? await tx.publish(review.targetFoodId, operation, review.id)
          : undefined;
      const state = {
        submit: "SUBMITTED",
        withdraw: "WITHDRAWN",
        approve: "APPROVED",
        reject: "REJECTED",
      } as const;
      await tx.update(id, revision, {
        state: state[action],
        ...(action === "submit"
          ? { submittedAt: new Date() }
          : { decidedAt: new Date() }),
      });
      await tx.audit(id, revision, user.id, state[action], reason, publication);
      if (action === "reject" || action === "withdraw") await tx.release(id);
    });
    return this.detail(id);
  }

  async detail(id: string) {
    const review = await this.repository.review(id);
    const content = review.revisions[0]!;
    const operation = parseOrThrow(operationSchema, content.payload, "body");
    const currentFoodId = review.targetFoodId ?? publishedFoodId(review);
    const current = currentFoodId
      ? await this.repository.food(currentFoodId)
      : null;
    const evidence = content.evidence as unknown as Evidence[];
    const baseline = content.baseline as unknown as {
      food: PublishedFood | null;
    };
    const baselineValues = comparisonValues(operation, baseline.food);
    const proposedValues = proposedComparison(operation, baselineValues);
    return {
      ...review,
      current,
      content,
      warnings: evidenceWarnings(operation, evidence, baseline.food),
      stale:
        fingerprint(
          await this.repository.baseline(
            review.targetFoodId ?? undefined,
            operation,
          ),
        ) !== content.baselineFingerprint,
      comparison: {
        baseline: baselineValues,
        current: comparisonValues(operation, current),
        proposed: proposedValues,
        changes: Object.entries(proposedValues)
          .filter(
            ([key, value]) =>
              JSON.stringify(value) !== JSON.stringify(baselineValues[key]),
          )
          .map(([field, after]) => ({
            field,
            kind:
              after == null || after === false
                ? "removed"
                : baselineValues[field] == null
                  ? "added"
                  : "changed",
            before: baselineValues[field] ?? null,
            after,
          })),
      },
    };
  }
}

function comparisonValues(
  operation: ReviewOperation,
  food: PublishedFood | null,
): Record<string, unknown> {
  if (!food) return {};
  switch (operation.type) {
    case "CREATE_FOOD":
      return {
        canonicalName: food.canonicalName,
        ...Object.fromEntries(
          Object.keys(operation.fields).map((key) => [
            key,
            food[key as keyof PublishedFood],
          ]),
        ),
        product: food.packagedProduct
          ? Object.fromEntries(
              Object.keys(operation.product ?? {}).map((key) => [
                key,
                food.packagedProduct![
                  key as keyof NonNullable<PublishedFood["packagedProduct"]>
                ],
              ]),
            )
          : null,
      };
    case "UPDATE_FOOD":
      return Object.fromEntries(
        Object.keys(operation.fields).map((k) => [
          k,
          food[k as keyof PublishedFood],
        ]),
      );
    case "UPDATE_PRODUCT":
      return Object.fromEntries(
        Object.keys(operation.fields).map((k) => [
          k,
          food.packagedProduct?.[
            k as keyof NonNullable<PublishedFood["packagedProduct"]>
          ],
        ]),
      );
    case "SET_FOOD_STATUS":
      return { status: food.status };
    case "ADD_ALIAS":
      return {
        alias:
          food.aliases.find(
            (a) =>
              a.alias === operation.alias &&
              a.language === operation.language &&
              a.isActive,
          )?.alias ?? null,
      };
    case "REMOVE_ALIAS":
      return {
        alias:
          food.aliases.find((a) => a.id === operation.aliasId && a.isActive)
            ?.alias ?? null,
      };
    case "ADD_BARCODE":
    case "SET_BARCODE_STATUS":
      return {
        barcode: operation.barcode,
        status:
          food.barcodes.find((b) => b.barcode === operation.barcode)?.status ??
          null,
      };
    case "PUBLISH_NUTRITION":
    case "WITHDRAW_NUTRITION":
      return { nutrition: food.nutritionRecords.filter((n) => n.isActive) };
  }
}

function proposedComparison(
  operation: ReviewOperation,
  baseline: Record<string, unknown>,
): Record<string, unknown> {
  switch (operation.type) {
    case "CREATE_FOOD":
      return {
        canonicalName: operation.canonicalName,
        ...operation.fields,
        product: operation.product ?? null,
      };
    case "UPDATE_FOOD":
    case "UPDATE_PRODUCT":
      return operation.fields;
    case "SET_FOOD_STATUS":
      return { status: operation.status };
    case "ADD_ALIAS":
      return { alias: operation.alias };
    case "REMOVE_ALIAS":
      return { alias: null };
    case "ADD_BARCODE":
      return { ...baseline, status: "ACTIVE" };
    case "SET_BARCODE_STATUS":
      return { ...baseline, status: operation.status };
    case "PUBLISH_NUTRITION":
      return { nutrition: operation };
    case "WITHDRAW_NUTRITION":
      return { nutrition: null };
  }
}
