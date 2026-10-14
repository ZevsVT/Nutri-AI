import { useEffect, useState } from "react";
import { Button } from "../common/Button";
import {
  getCurrentUser,
  login,
  logout,
  type AuthUser,
} from "../../services/authService";
import {
  initialOperation,
  operationTypes,
  reviewRequest,
  ReviewRequestError,
  type CatalogFood,
  type Draft,
  type OperationType,
  type Page,
  type ReviewDetail,
  type ReviewEvent,
  type ReviewSummary,
} from "../../services/reviewService";
import { DraftEditor } from "./DraftEditor";
import "./review.css";

const label = (value: string) => value.toLowerCase().replace(/_/g, " ");
const emptyPage = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};

export function ReviewWorkspace({
  onSession,
}: {
  onSession: (user: AuthUser | null) => void;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"catalog" | "queue">("queue");
  const [foods, setFoods] = useState<Page<CatalogFood>>(emptyPage);
  const [reviews, setReviews] = useState<Page<ReviewSummary>>(emptyPage);
  const [selectedFood, setSelectedFood] = useState<CatalogFood | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [state, setState] = useState("SUBMITTED");
  const [operation, setOperation] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [targetFoodId, setTargetFoodId] = useState("");
  const [status, setStatus] = useState("");
  const [foodType, setFoodType] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<Page<ReviewEvent>>(emptyPage);
  const canRead = user?.permissions.includes("food-reviews:read");
  const canWrite = user?.permissions.includes("food-reviews:write");
  const canDecide = user?.permissions.includes("food-reviews:decide");

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((r) => {
        if (active) {
          setUser(r.user);
          onSession(r.user);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [onSession]);
  useEffect(() => {
    if (!canRead) return;
    let active = true;
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    for (const [key, value] of Object.entries(
      tab === "catalog"
        ? { q, status, foodType, category }
        : { state, operation, authorId, targetFoodId },
    ))
      if (value) params.set(key, value);
    setLoading(true);
    reviewRequest<Page<CatalogFood> | Page<ReviewSummary>>(
      `/${tab === "catalog" ? "foods" : "food-reviews"}?${params}`,
    )
      .then((r) => {
        if (active) {
          if (tab === "catalog") setFoods(r as Page<CatalogFood>);
          else setReviews(r as Page<ReviewSummary>);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    canRead,
    tab,
    page,
    q,
    state,
    operation,
    authorId,
    targetFoodId,
    status,
    foodType,
    category,
    refresh,
  ]);

  async function run(work: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError("");
    setConflict(false);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setConflict(e instanceof ReviewRequestError && e.status === 409);
    } finally {
      setPending(false);
    }
  }
  async function openReview(id: string) {
    const result = await reviewRequest<ReviewDetail>(`/food-reviews/${id}`);
    setDetail(result);
    setSelectedFood(null);
    setDraft(null);
    setDraftRevision(null);
    setReason("");
    setHistory(
      await reviewRequest<Page<ReviewEvent>>(`/food-reviews/${id}/history`),
    );
  }
  function newDraft(
    type: OperationType = selectedFood ? "UPDATE_FOOD" : "CREATE_FOOD",
    predecessorId?: string,
  ) {
    setDraft({
      ...(selectedFood ? { targetFoodId: selectedFood.id } : {}),
      ...(predecessorId ? { predecessorId } : {}),
      operation: initialOperation(type, selectedFood),
      evidence: [{ kind: "CATALOG", reference: "" }],
      explanation: "",
    });
    setDraftRevision(null);
    setDetail(null);
  }
  async function saveDraft(value: Draft) {
    const result =
      draftRevision && detail
        ? await reviewRequest<ReviewDetail>(
            `/food-reviews/${detail.id}`,
            "PATCH",
            {
              revision: draftRevision,
              operation: value.operation,
              explanation: value.explanation,
              evidence: value.evidence,
            },
          )
        : await reviewRequest<ReviewDetail>("/food-reviews", "POST", value);
    await openReview(result.id);
    setRefresh((x) => x + 1);
  }
  async function decide(action: string) {
    if (!detail) return;
    const result = await reviewRequest<ReviewDetail>(
      `/food-reviews/${detail.id}/${action}`,
      "POST",
      { revision: detail.revision, ...(action === "reject" ? { reason } : {}) },
    );
    await openReview(result.id);
    setRefresh((x) => x + 1);
  }

  if (checking)
    return (
      <section className="review-workspace" aria-busy="true">
        Checking review access…
      </section>
    );
  return (
    <section className="review-workspace" aria-label="Food data reviews">
      <header>
        <div>
          <h1>Food data reviews</h1>
          <p>Stage evidence-backed changes for independent review.</p>
        </div>
        {user && (
          <Button
            disabled={pending}
            onClick={() =>
              void run(async () => {
                await logout();
                setUser(null);
                onSession(null);
                setDraft(null);
                setDetail(null);
                setSelectedFood(null);
              })
            }
          >
            Sign out
          </Button>
        )}
      </header>
      {error && (
        <div role="alert" className="review-error">
          {error}
          {conflict && (
            <p>
              Your editor contents are retained. Reload the review to inspect
              the latest state. Withdraw a stale proposal and create a successor
              to capture a fresh baseline.
            </p>
          )}
          {conflict && detail && (
            <Button
              onClick={() =>
                void run(async () => {
                  const latest = await reviewRequest<ReviewDetail>(
                    `/food-reviews/${detail.id}`,
                  );
                  setDetail(latest);
                })
              }
            >
              Reload review state
            </Button>
          )}
        </div>
      )}
      {!user ? (
        <form
          className="review-login"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const result = await login({ email, password });
              setUser(result.user);
              onSession(result.user);
              setPassword("");
            });
          }}
        >
          <h2>Staff sign in</h2>
          <label>
            Email
            <input
              type="email"
              required
              maxLength={320}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <Button type="submit" loading={pending}>
            Sign in
          </Button>
        </form>
      ) : !canRead ? (
        <p role="alert">
          Permission denied. Your account cannot access catalog reviews.
        </p>
      ) : (
        <>
          <div className="review-toolbar">
            <Button
              variant={tab === "queue" ? "primary" : "secondary"}
              onClick={() => {
                setTab("queue");
                setPage(1);
              }}
            >
              Review queue
            </Button>
            <Button
              variant={tab === "catalog" ? "primary" : "secondary"}
              onClick={() => {
                setTab("catalog");
                setPage(1);
              }}
            >
              Food catalog
            </Button>
            {canWrite && (
              <Button
                onClick={() => {
                  setSelectedFood(null);
                  setDraft({
                    operation: initialOperation("CREATE_FOOD", null),
                    evidence: [{ kind: "CATALOG", reference: "" }],
                    explanation: "",
                  });
                  setDetail(null);
                  setDraftRevision(null);
                }}
              >
                Propose new food
              </Button>
            )}
            <Button onClick={() => setRefresh((x) => x + 1)} disabled={loading}>
              Refresh list
            </Button>
          </div>
          <div className="review-filters">
            {tab === "queue" ? (
              <>
                <label>
                  State
                  <select
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setPage(1);
                    }}
                  >
                    {[
                      "",
                      "DRAFT",
                      "SUBMITTED",
                      "APPROVED",
                      "REJECTED",
                      "WITHDRAWN",
                    ].map((v) => (
                      <option key={v} value={v}>
                        {v || "All states"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Operation
                  <select
                    value={operation}
                    onChange={(e) => {
                      setOperation(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All operations</option>
                    {operationTypes.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Author ID
                  <input
                    value={authorId}
                    onChange={(e) => {
                      setAuthorId(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label>
                  Food ID
                  <input
                    value={targetFoodId}
                    onChange={(e) => {
                      setTargetFoodId(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <Button
                  onClick={() => {
                    setAuthorId(user.id);
                    setPage(1);
                  }}
                >
                  My proposals
                </Button>
              </>
            ) : (
              <>
                <label>
                  Search
                  <input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label>
                  Lifecycle
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    {["", "ACTIVE", "INACTIVE", "DEPRECATED"].map((v) => (
                      <option key={v} value={v}>
                        {v || "All records"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Food type
                  <input
                    placeholder="e.g. DISH"
                    value={foodType}
                    onChange={(e) => {
                      setFoodType(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label>
                  Category
                  <input
                    placeholder="e.g. NOODLES"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
              </>
            )}
          </div>
          <div aria-live="polite" aria-busy={loading}>
            {loading ? (
              <p>Loading…</p>
            ) : tab === "queue" ? (
              reviews.data.length ? (
                <ul className="review-list">
                  {reviews.data.map((r) => (
                    <li key={r.id}>
                      <button
                        disabled={pending}
                        onClick={() => void run(() => openReview(r.id))}
                      >
                        <strong>{label(r.operation)}</strong>
                        <span>
                          {r.state} · revision {r.revision}
                        </span>
                        <small>
                          {r.id} · author {r.authorId}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No reviews match these filters.</p>
              )
            ) : foods.data.length ? (
              <ul className="review-list">
                {foods.data.map((f) => (
                  <li key={f.id}>
                    <button
                      disabled={pending}
                      onClick={() =>
                        void run(async () => {
                          setSelectedFood(
                            await reviewRequest<CatalogFood>(`/foods/${f.id}`),
                          );
                          setDetail(null);
                          setDraft(null);
                        })
                      }
                    >
                      <strong>{f.nameVi}</strong>
                      <span>{f.status}</span>
                      <small>
                        {f.canonicalName} · {f.id}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No foods match these filters.</p>
            )}
          </div>
          <div className="review-toolbar">
            <Button
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} · {(tab === "queue" ? reviews : foods).meta.total}{" "}
              results
            </span>
            <Button
              disabled={
                loading ||
                page >= (tab === "queue" ? reviews : foods).meta.totalPages
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
          {selectedFood && !draft && (
            <article>
              <h2>{selectedFood.nameVi}</h2>
              <p>
                Canonical identity: {selectedFood.canonicalName} ·{" "}
                {selectedFood.id}
              </p>
              <Data value={selectedFood} />
              {canWrite && (
                <Button onClick={() => newDraft()}>Propose a correction</Button>
              )}
            </article>
          )}
          {draft && (
            <DraftEditor
              draft={draft}
              food={selectedFood ?? detail?.content.baseline.food ?? null}
              editing={draftRevision !== null}
              pending={pending}
              onChange={setDraft}
              onSave={() => void run(() => saveDraft(draft))}
              onCancel={() => setDraft(null)}
            />
          )}
          {detail && (
            <article>
              <h2>
                {label(detail.operation)} · {detail.state}
              </h2>
              <p>
                Author {detail.authorId} · revision {detail.revision} ·
                submitted{" "}
                {detail.submittedAt
                  ? new Date(detail.submittedAt).toLocaleString()
                  : "not yet"}
              </p>
              <p>{detail.content.explanation}</p>
              {detail.predecessorId && (
                <Button
                  onClick={() =>
                    void run(() => openReview(detail.predecessorId!))
                  }
                >
                  Open predecessor
                </Button>
              )}
              {detail.successor && (
                <Button
                  onClick={() =>
                    void run(() => openReview(detail.successor!.id))
                  }
                >
                  Open successor
                </Button>
              )}
              <div className="review-comparison">
                {(["current", "baseline", "proposed"] as const).map((key) => (
                  <div key={key}>
                    <h3>{label(key)}</h3>
                    <Data value={detail.comparison[key]} />
                  </div>
                ))}
              </div>
              {detail.stale &&
                ["DRAFT", "SUBMITTED"].includes(detail.state) && (
                  <p role="alert">
                    Published data changed since this baseline. This proposal
                    cannot be published; withdraw it and create a successor.
                  </p>
                )}
              <h3>Changes</h3>
              <ul>
                {detail.comparison.changes.map((c) => (
                  <li key={c.field}>
                    {c.field}: {c.kind}
                  </li>
                ))}
              </ul>
              <h3>Evidence</h3>
              {detail.content.evidence.map((e, i) => (
                <div key={i}>
                  <strong>
                    {e.kind}: {e.reference}
                  </strong>
                  {e.url && (
                    <p>
                      <a href={e.url} target="_blank" rel="noreferrer">
                        Open source evidence
                      </a>
                    </p>
                  )}
                  <Data value={e} />
                </div>
              ))}
              {detail.warnings.length > 0 && (
                <div role="status">
                  <h3>Validation warnings</h3>
                  <ul>
                    {detail.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="review-toolbar">
                {canWrite &&
                  detail.authorId === user.id &&
                  detail.state === "DRAFT" && (
                    <>
                      <Button
                        disabled={pending || Boolean(draft)}
                        onClick={() => {
                          setDraft({
                            operation: detail.content.payload,
                            evidence: detail.content.evidence,
                            explanation: detail.content.explanation,
                            ...(detail.targetFoodId
                              ? { targetFoodId: detail.targetFoodId }
                              : {}),
                          });
                          setDraftRevision(detail.revision);
                        }}
                      >
                        Edit draft
                      </Button>
                      <Button
                        disabled={pending || Boolean(draft)}
                        onClick={() => void run(() => decide("submit"))}
                      >
                        Submit for review
                      </Button>
                    </>
                  )}
                {canWrite &&
                  detail.authorId === user.id &&
                  ["DRAFT", "SUBMITTED"].includes(detail.state) && (
                    <Button
                      disabled={pending || Boolean(draft)}
                      onClick={() => void run(() => decide("withdraw"))}
                    >
                      Withdraw
                    </Button>
                  )}
              </div>
              {canDecide && detail.state === "SUBMITTED" && (
                <div className="review-decision">
                  <p>
                    Approval publishes these exact values immediately. Nutrition
                    creates a new version; lifecycle changes affect future
                    lookups. Confirm the evidence before approving.
                  </p>
                  {detail.authorId === user.id ? (
                    <p>You cannot approve your own proposal.</p>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={pending || detail.stale}
                      onClick={() => void run(() => decide("approve"))}
                    >
                      Approve and publish
                    </Button>
                  )}
                  <label>
                    Rejection reason
                    <textarea
                      maxLength={4000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <Button
                    variant="danger"
                    disabled={pending || !reason.trim()}
                    onClick={() => void run(() => decide("reject"))}
                  >
                    Reject proposal
                  </Button>
                </div>
              )}
              {canWrite &&
                detail.authorId === user.id &&
                ["REJECTED", "WITHDRAWN", "APPROVED"].includes(detail.state) &&
                !detail.successor && (
                  <Button
                    disabled={pending || Boolean(draft)}
                    onClick={() => {
                      setSelectedFood(detail.current);
                      setDraft({
                        operation:
                          detail.operation === "CREATE_FOOD" && detail.current
                            ? initialOperation("UPDATE_FOOD", detail.current)
                            : detail.content.payload,
                        evidence: detail.content.evidence,
                        explanation: detail.content.explanation,
                        ...((detail.targetFoodId ?? detail.current?.id)
                          ? {
                              targetFoodId:
                                detail.targetFoodId ?? detail.current!.id,
                            }
                          : {}),
                        predecessorId: detail.id,
                      });
                      setDraftRevision(null);
                      setDetail(null);
                    }}
                  >
                    Create linked successor
                  </Button>
                )}
              <h3>Decision history</h3>
              <ol>
                {history.data.map((h) => (
                  <li key={h.id}>
                    <strong>{h.action}</strong> · revision {h.revision} ·{" "}
                    {new Date(h.createdAt).toLocaleString()} · actor {h.actorId}
                    {h.reason && <p>{h.reason}</p>}
                    {h.publication != null && <Data value={h.publication} />}
                    <details>
                      <summary>Exact saved revision</summary>
                      <Data value={h.content} />
                    </details>
                  </li>
                ))}
              </ol>
              <div className="review-toolbar">
                <Button
                  disabled={pending || history.meta.page <= 1}
                  onClick={() =>
                    void run(async () =>
                      setHistory(
                        await reviewRequest(
                          `/food-reviews/${detail.id}/history?page=${history.meta.page - 1}`,
                        ),
                      ),
                    )
                  }
                >
                  Earlier history page
                </Button>
                <Button
                  disabled={
                    pending || history.meta.page >= history.meta.totalPages
                  }
                  onClick={() =>
                    void run(async () =>
                      setHistory(
                        await reviewRequest(
                          `/food-reviews/${detail.id}/history?page=${history.meta.page + 1}`,
                        ),
                      ),
                    )
                  }
                >
                  Next history page
                </Button>
              </div>
            </article>
          )}
        </>
      )}
    </section>
  );
}

function Data({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}
