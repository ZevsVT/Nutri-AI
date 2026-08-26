import assert from "node:assert/strict";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app/app.js";
import { loadConfig, type AppConfig } from "../src/config/env.js";

function config(): AppConfig {
  return loadConfig({ NODE_ENV: "development", AUTH_DEV_MODE: "true", CORS_ORIGINS: "http://localhost:5173" });
}

function user(id: string) { return { "x-development-user-id": id }; }

function imageUpload(): { payload: Buffer; contentType: string } {
  const boundary = "nutri-ai-test-boundary";
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="meal.png"\r\nContent-Type: image/png\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  return { payload: Buffer.concat([Buffer.from(header), image, Buffer.from(footer)]), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function createMeal(app: FastifyInstance, userId: string) {
  const response = await app.inject({ method: "POST", url: "/api/v1/meals", headers: user(userId), payload: { mealType: "LUNCH", capturedAt: "2026-08-25T05:00:00.000Z", items: [{ foodId: "food-demo", quantity: 1, unit: "bowl", displayName: "Demo meal" }] } });
  assert.equal(response.statusCode, 201);
  return response.json().data.id as string;
}

test("business endpoints enforce authentication and standard validation", async () => {
  const app = await buildApp({ config: config() });
  try {
    const unauthorized = await app.inject({ method: "GET", url: "/api/v1/meals" });
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(unauthorized.json().error.code, "AUTHENTICATION_ERROR");

    const invalid = await app.inject({ method: "POST", url: "/api/v1/meals", headers: user("user-a"), payload: { mealType: "INVALID", capturedAt: "not-a-date", items: [] } });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
    assert.equal(invalid.json().success, false);
    assert.equal(invalid.json().requestId, invalid.headers["x-request-id"]);
  } finally {
    await app.close();
  }
});

test("meal CRUD is user-scoped and list responses are paginated", async () => {
  const app = await buildApp({ config: config() });
  try {
    const mealId = await createMeal(app, "user-a");
    const own = await app.inject({ method: "GET", url: "/api/v1/meals?page=1&pageSize=20", headers: user("user-a") });
    assert.equal(own.statusCode, 200);
    assert.equal(own.json().data.length, 1);
    assert.deepEqual(own.json().meta, { page: 1, pageSize: 20, total: 1, totalPages: 1 });

    const otherList = await app.inject({ method: "GET", url: "/api/v1/meals", headers: user("user-b") });
    assert.equal(otherList.statusCode, 200);
    assert.equal(otherList.json().data.length, 0);
    const otherRead = await app.inject({ method: "GET", url: `/api/v1/meals/${mealId}`, headers: user("user-b") });
    assert.equal(otherRead.statusCode, 404);
    assert.equal(otherRead.json().error.code, "MEAL_NOT_FOUND");

    const update = await app.inject({ method: "PATCH", url: `/api/v1/meals/${mealId}`, headers: user("user-a"), payload: { name: "Lunch" } });
    assert.equal(update.statusCode, 200);
    assert.equal(update.json().data.name, "Lunch");
    const deleted = await app.inject({ method: "DELETE", url: `/api/v1/meals/${mealId}`, headers: user("user-a") });
    assert.equal(deleted.statusCode, 204);
    const afterDelete = await app.inject({ method: "GET", url: `/api/v1/meals/${mealId}`, headers: user("user-a") });
    assert.equal(afterDelete.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("analysis lifecycle, nutrition, water, assistant, and barcode contracts are available", async () => {
  const app = await buildApp({ config: config() });
  try {
    const upload = imageUpload();
    const uploaded = await app.inject({ method: "POST", url: "/api/v1/storage/uploads", headers: { ...user("user-a"), "content-type": upload.contentType }, payload: upload.payload });
    assert.equal(uploaded.statusCode, 201);
    const analysis = await app.inject({ method: "POST", url: "/api/v1/meal-analysis", headers: user("user-a"), payload: { inputType: "IMAGE", inputReference: uploaded.json().data.reference } });
    assert.equal(analysis.statusCode, 202);
    assert.equal(analysis.json().data.status, "PENDING");
    const analysisId = analysis.json().data.analysisId;
    const pending = await app.inject({ method: "GET", url: `/api/v1/meal-analysis/${analysisId}`, headers: user("user-a") });
    assert.equal(pending.statusCode, 200);
    assert.equal(pending.json().data.status, "PENDING");

    const daily = await app.inject({ method: "GET", url: "/api/v1/nutrition/daily?date=2026-08-25", headers: user("user-a") });
    assert.equal(daily.statusCode, 200);
    assert.equal(daily.json().data.mealCount, 1);
    const water = await app.inject({ method: "POST", url: "/api/v1/water", headers: user("user-a"), payload: { amountMl: 500, loggedAt: "2026-08-25T05:00:00.000Z" } });
    assert.equal(water.statusCode, 201);
    const chat = await app.inject({ method: "POST", url: "/api/v1/ai/chat", headers: user("user-a"), payload: { message: "How am I doing?" } });
    assert.equal(chat.statusCode, 200);
    assert.deepEqual(chat.json().data.context, ["confirmed_meals", "daily_nutrition"]);
    const barcode = await app.inject({ method: "POST", url: "/api/v1/barcode/scan", headers: user("user-a"), payload: { barcode: "012345678901" } });
    assert.equal(barcode.statusCode, 200);
    assert.equal(barcode.json().data.status, "UNRESOLVED");
  } finally {
    await app.close();
  }
});
