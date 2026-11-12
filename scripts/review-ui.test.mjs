import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("voice audio and edited Vietnamese text go to separate endpoints", async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  const originalFetch = globalThis.fetch;
  try {
    const { mealAudioWav } = await vite.ssrLoadModule("/src/services/voiceCapture.ts");
    const client = await vite.ssrLoadModule("/src/services/mealAnalysisService.ts");
    const audio = mealAudioWav(Int16Array.from([100, -100]), 16000);
    const bytes = Buffer.from(await audio.arrayBuffer());
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.readUInt32LE(24), 16000);
    assert.equal(bytes.readUInt32LE(40), 4);
    const before = "Một tô phở bò và hai quả trứng luộc";
    const after = "Một tô phở bò và ba quả trứng luộc";
    const signal = new AbortController().signal;
    globalThis.fetch = async (url, init) => {
      assert.equal(init.credentials, "include");
      if (url.endsWith("/meal-analysis/transcribe")) {
        assert.ok(init.body instanceof FormData);
        assert.equal(init.headers.has("content-type"), false);
        assert.equal(init.body.get("file").name, "meal.wav");
        return Response.json({ success: true, data: { transcript: before } });
      }
      assert.ok(url.endsWith("/meal-analysis"));
      assert.deepEqual(JSON.parse(init.body), { inputType: "TEXT", inputReference: after, reviewTranscript: true });
      return Response.json({ success: true, data: { status: "READY", analysisId: "voice-draft" } });
    };
    assert.equal(await client.transcribeMealAudio(audio, signal), before);
    assert.equal((await client.startTextAnalysis(after, signal)).analysisId, "voice-draft");
  } finally {
    globalThis.fetch = originalFetch;
    await vite.close();
  }
});

test("barcode lookup preserves digits and writes only a reviewed, sourced product", async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  const originalFetch = globalThis.fetch;
  const calls = [];
  const code = "036000291452";
  const product = {
    foodId: "product-id",
    productName: "Test product",
    nutritionAvailability: "PARTIAL",
    nutrition: { preparation: "AS_SOLD", servingUnit: "g", servingAmount: 100, protein: null },
  };
  try {
    const { scanBarcode, canLogProduct, saveScannedProduct } = await vite.ssrLoadModule("/src/services/barcodeService.ts");
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body, credentials: init.credentials });
      if (body.barcode === "invalid")
        return Response.json({ success: false, error: { code: "VALIDATION_ERROR" } }, { status: 400 });
      if (body.barcode === "00000000")
        return Response.json({ success: true, data: { barcode: body.barcode, status: "UNRESOLVED", product: null } });
      if (body.barcode)
        return Response.json({ success: true, data: { barcode: body.barcode, status: "RESOLVED", product } });
      return Response.json({ success: true, data: { id: "saved-meal" } });
    };
    const signal = new AbortController().signal;
    await assert.rejects(scanBarcode("invalid", signal), /valid check digit/);
    assert.equal((await scanBarcode("00000000", signal)).status, "UNRESOLVED");
    const found = await scanBarcode(code, signal);
    assert.equal(found.barcode, code);
    assert.equal(found.product.nutrition.protein, null);
    assert.equal(canLogProduct(found.product), true);
    const unavailable = { ...product, nutritionAvailability: "UNAVAILABLE", nutrition: null };
    assert.equal(canLogProduct(unavailable), false);
    assert.throws(() => saveScannedProduct(unavailable, 75, "g"), /no usable nutrition reference/);
    assert.equal(calls.length, 3);
    assert.ok(calls.every(({ url }) => url.endsWith("/barcode/scan")));
    assert.equal(calls[2].body.barcode, code);
    assert.equal((await saveScannedProduct(found.product, 75, "g")).id, "saved-meal");
    assert.ok(calls[3].url.endsWith("/meals"));
    assert.deepEqual(calls[3].body.items, [{ foodId: "product-id", quantity: 75, unit: "g" }]);
    assert.ok(calls.every(({ credentials }) => credentials === "include"));
  } finally {
    globalThis.fetch = originalFetch;
    await vite.close();
  }
});

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
