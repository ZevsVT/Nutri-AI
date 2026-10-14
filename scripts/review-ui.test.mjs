import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("review frontend forms and session API client", async (context) => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });
  const originalFetch = globalThis.fetch;
  try {
    const client = await vite.ssrLoadModule("/src/services/reviewService.ts");
    const auth = await vite.ssrLoadModule("/src/services/authService.ts");
    const { DraftEditor } = await vite.ssrLoadModule(
      "/src/components/admin/DraftEditor.tsx",
    );
    const food = {
      id: "test-food",
      nameVi: "Published food",
      canonicalName: "stable-id",
      status: "ACTIVE",
      aliases: [
        { id: "alias-id", alias: "Old alias", language: "vi", isActive: true },
      ],
      packagedProduct: { productName: "Product", sourceId: "source-id" },
      barcodes: [{ barcode: "4006381333931", status: "ACTIVE" }],
    };
    await context.test(
      "all operation editors render accessible fields; submitted values stay unchanged",
      () => {
        for (const type of client.operationTypes) {
          const operation = client.initialOperation(
            type,
            type === "CREATE_FOOD" ? null : food,
          );
          const draft = {
            operation,
            explanation: "Verified source",
            evidence: [{ kind: "CATALOG", reference: "Table page 18" }],
          };
          const before = JSON.stringify(draft);
          const html = renderToStaticMarkup(
            React.createElement(DraftEditor, {
              draft,
              food: type === "CREATE_FOOD" ? null : food,
              editing: false,
              pending: false,
              onChange() {},
              onSave() {},
              onCancel() {},
            }),
          );
          assert.ok(html.includes("Save draft"), type);
          assert.ok(html.includes("Supporting evidence"), type);
          assert.ok(html.includes("<label>Operation"), type);
          if (type === "PUBLISH_NUTRITION") {
            assert.ok(html.includes("preparation State"));
            assert.ok(html.includes('value="100"'));
            assert.ok(html.includes("Unknown") || html.includes("unknown"));
          }
          const disabled = renderToStaticMarkup(
            React.createElement(DraftEditor, {
              draft,
              food,
              editing: true,
              pending: true,
              onChange() {},
              onSave() {},
              onCancel() {},
            }),
          );
          assert.match(disabled, /<fieldset disabled=""/);
          assert.match(disabled, /<select[^>]*disabled=""/);
          assert.equal(JSON.stringify(draft), before);
        }
      },
    );
    await context.test(
      "draft, submit, decision and history calls carry session credentials and exact revisions",
      async () => {
        const calls = [];
        globalThis.fetch = async (url, init) => {
          calls.push({ url, init });
          return Response.json({
            success: true,
            data: { id: "review-id", state: "DRAFT" },
          });
        };
        const draft = {
          operation: {
            type: "UPDATE_FOOD",
            fields: { description: "Proposed correction" },
          },
          evidence: [{ kind: "CATALOG", reference: "Evidence" }],
          explanation: "Source",
          targetFoodId: food.id,
        };
        await client.reviewRequest("/food-reviews", "POST", draft);
        await client.reviewRequest("/food-reviews/review-id/submit", "POST", {
          revision: 2,
        });
        await client.reviewRequest("/food-reviews/review-id/approve", "POST", {
          revision: 2,
        });
        await client.reviewRequest("/food-reviews/review-id/history");
        assert.equal(calls.length, 4);
        for (const { init } of calls) {
          assert.equal(init.credentials, "include");
          assert.equal(init.headers["x-food-review-request"], "1");
        }
        assert.deepEqual(JSON.parse(calls[0].init.body), draft);
        assert.deepEqual(JSON.parse(calls[2].init.body), { revision: 2 });
      },
    );
    await context.test(
      "staff sign-out sends a valid bodyless cookie-authenticated request",
      async () => {
        let sent;
        globalThis.fetch = async (_url, init) => {
          sent = init;
          return Response.json({ success: true, data: { loggedOut: true } });
        };
        assert.deepEqual(await auth.logout(), { loggedOut: true });
        assert.equal(sent.method, "POST");
        assert.equal(sent.credentials, "include");
        assert.equal(sent.headers["content-type"], undefined);
        assert.equal(sent.body, undefined);
      },
    );
    await context.test(
      "conflict, permission and validation errors retain actionable messages and draft data",
      async () => {
        const draft = {
          revision: 2,
          operation: {
            type: "UPDATE_FOOD",
            fields: { description: "Unsaved work" },
          },
        };
        const before = JSON.stringify(draft);
        for (const status of [400, 401, 403, 409]) {
          globalThis.fetch = async () =>
            Response.json(
              {
                success: false,
                error: {
                  message:
                    status === 409
                      ? "Published data changed"
                      : "Request denied",
                  details: [
                    {
                      path: "operation.fields",
                      message: "Verify the proposed values",
                    },
                  ],
                },
              },
              { status },
            );
          await assert.rejects(
            client.reviewRequest("/food-reviews/id", "PATCH", draft),
            (e) =>
              e instanceof client.ReviewRequestError &&
              e.status === status &&
              e.message.includes("Verify the proposed values"),
          );
          assert.equal(JSON.stringify(draft), before);
        }
        globalThis.fetch = async () =>
          Response.json({
            success: true,
            data: [],
            meta: { page: 1, total: 0, totalPages: 0 },
          });
        assert.deepEqual(await client.reviewRequest("/food-reviews"), {
          data: [],
          meta: { page: 1, total: 0, totalPages: 0 },
        });
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    await vite.close();
  }
});
