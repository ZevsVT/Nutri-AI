import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app/app.js";
import { loadConfig, type AppConfig } from "../src/config/env.js";
import { createObjectKey } from "../src/common/uploads/file-policy.js";
import {
  LocalStorageProvider,
  S3StorageProvider,
} from "../src/integrations/storage/storage-provider.js";
import { OpenAiMealVision } from "../src/integrations/ai/openai-vision.js";
import { PrismaBusinessApiService } from "../src/modules/api/api.service.js";
import { ImageAnalysisWorker } from "../src/modules/meals/image-analysis.worker.js";
import { PrismaStorageObjectRepository } from "../src/modules/storage/storage.repository.js";
import {
  createStorageProvider,
  StorageService,
} from "../src/modules/storage/storage.service.js";
import { normalizeFoodText } from "../src/modules/foods/food-taxonomy.js";

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function multipart(
  bytes: Uint8Array,
  fileName = "meal.png",
  contentType = "image/png",
) {
  const boundary = "nutri-ai-storage-test";
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  return {
    payload: Buffer.concat([
      Buffer.from(header),
      Buffer.from(bytes),
      Buffer.from(footer),
    ]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function config(root: string, extra: NodeJS.ProcessEnv = {}): AppConfig {
  return loadConfig({
    NODE_ENV: "development",
    AUTH_DEV_MODE: "true",
    CORS_ORIGINS: "http://localhost:5173",
    STORAGE_LOCAL_ROOT: root,
    ...extra,
  });
}

function user(id: string) {
  return { "x-development-user-id": id };
}

test("storage upload, read URLs, and analysis references are user-scoped", async () => {
  const root = await mkdtemp(join(tmpdir(), "nutri-ai-storage-"));
  const app = await buildApp({ config: config(root) });
  try {
    const unauthenticated = await app.inject({
      method: "POST",
      url: "/api/v1/storage/uploads",
      headers: { "content-type": multipart(image).contentType },
      payload: multipart(image).payload,
    });
    assert.equal(unauthenticated.statusCode, 401);

    const upload = multipart(image, "../../secret.png");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/storage/uploads",
      headers: { ...user("user-a"), "content-type": upload.contentType },
      payload: upload.payload,
    });
    assert.equal(response.statusCode, 201);
    const stored = response.json().data;
    assert.match(stored.reference, /^storage:\/\/object\/[0-9a-f-]{36}$/i);
    assert.equal(stored.fileName.includes("/"), false);
    assert.equal(stored.fileName.includes(".."), false);

    const ownRead = await app.inject({
      method: "GET",
      url: `/api/v1/storage/objects/${stored.objectId}`,
      headers: user("user-a"),
    });
    assert.equal(ownRead.statusCode, 200);
    assert.deepEqual(Buffer.from(ownRead.rawPayload), image);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/storage/objects/${stored.objectId}/url`,
          headers: user("user-a"),
        })
      ).statusCode,
      200,
    );

    const crossUserRead = await app.inject({
      method: "GET",
      url: `/api/v1/storage/objects/${stored.objectId}`,
      headers: user("user-b"),
    });
    assert.equal(crossUserRead.statusCode, 404);
    assert.equal(crossUserRead.json().error.code, "STORAGE_OBJECT_NOT_FOUND");
    const injectedReference = await app.inject({
      method: "POST",
      url: "/api/v1/meal-analysis",
      headers: user("user-b"),
      payload: { inputType: "IMAGE", inputReference: stored.reference },
    });
    assert.equal(injectedReference.statusCode, 404);
    assert.equal(
      injectedReference.json().error.code,
      "STORAGE_OBJECT_NOT_FOUND",
    );
    const traversal = await app.inject({
      method: "POST",
      url: "/api/v1/meal-analysis",
      headers: user("user-a"),
      payload: {
        inputType: "IMAGE",
        inputReference: "storage://object/../../secret",
      },
    });
    assert.equal(traversal.statusCode, 400);
    assert.equal(traversal.json().error.code, "STORAGE_INVALID_OBJECT");

    const analysis = await app.inject({
      method: "POST",
      url: "/api/v1/meal-analysis",
      headers: user("user-a"),
      payload: { inputType: "IMAGE", inputReference: stored.reference },
    });
    assert.equal(analysis.statusCode, 202);
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/v1/storage/objects/${stored.objectId}`,
          headers: user("user-a"),
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test(
  "deleting a confirmed meal removes its totals and retains its private image until expiry",
  {
    skip: !process.env.DATABASE_URL && "DATABASE_URL is not configured",
  },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "nutri-ai-retention-"));
    const prisma = new PrismaClient();
    const owner = randomUUID();
    const other = randomUUID();
    const sourceId = randomUUID();
    const appConfig = config(root, {
      LOG_LEVEL: "silent",
      STORAGE_RETENTION_DAYS: "2",
    });
    const provider = new LocalStorageProvider(root);
    const storage = new StorageService(
      provider,
      new PrismaStorageObjectRepository(prisma),
      appConfig,
    );
    const meals = new PrismaBusinessApiService(prisma, undefined, storage);
    const app = await buildApp({
      config: appConfig,
      businessApiService: meals,
      storageService: storage,
    });
    try {
      await prisma.user.createMany({
        data: [owner, other].map((id) => ({ id, email: `${id}@test.local` })),
      });
      const stored = await storage.uploadImage(
        {
          bytes: image,
          contentType: "image/png",
          fileName: "meal.png",
          ownerId: owner,
        },
        (id) => id,
      );
      const attached = await storage.attachForUser(stored.reference, owner);
      const version = await prisma.nutritionVersion.create({
        data: {
          version: "fixture",
          effectiveFrom: new Date("2026-01-01"),
          source: {
            create: {
              id: sourceId,
              name: sourceId,
              provider: "test",
              sourceType: "CURATED",
            },
          },
        },
      });
      const date = "2026-08-22";
      const meal = await prisma.meal.create({
        data: {
          userId: owner,
          imageUrl: stored.reference,
          mealType: "LUNCH",
          capturedAt: new Date(`${date}T12:00:00Z`),
          status: "CONFIRMED",
          confirmedAt: new Date(),
          items: {
            create: {
              displayName: "Fixture food",
              quantity: 100,
              unit: "g",
              nutritionSnapshot: {
                create: {
                  nutritionVersionId: version.id,
                  sourceId,
                  servingAmount: 100,
                  servingUnit: "g",
                  calories: 125,
                },
              },
            },
          },
        },
      });
      const mealUrl = `/api/v1/meals/${meal.id}`;
      const imageUrl = `/api/v1/storage/objects/${stored.objectId}`;
      const totals = (id: string) =>
        app.inject({
          url: `/api/v1/nutrition/daily?date=${date}`,
          headers: user(id),
        });
      assert.equal((await totals(owner)).json().data.totals.calories, 125);
      assert.equal((await totals(other)).json().data.mealCount, 0);
      const listMeals = (id: string) =>
        app.inject({ url: "/api/v1/meals", headers: user(id) });
      assert.deepEqual((await listMeals(other)).json().data, []);
      for (const method of ["GET", "PATCH", "DELETE"] as const) {
        const response = await app.inject({
          method,
          url: mealUrl,
          headers: user(other),
          payload: method === "PATCH" ? { notes: "Other account" } : undefined,
        });
        assert.equal(response.statusCode, 404, response.body);
      }
      assert.equal(
        (
          await app.inject({
            method: "DELETE",
            url: mealUrl,
            headers: user(owner),
          })
        ).statusCode,
        204,
      );
      assert.equal(
        (await app.inject({ url: mealUrl, headers: user(owner) })).statusCode,
        404,
      );
      assert.deepEqual((await listMeals(owner)).json().data, []);
      const afterDelete = (await totals(owner)).json().data;
      assert.equal(afterDelete.mealCount, 0);
      assert.equal(afterDelete.totals.calories, 0);

      const retained = await prisma.storedObject.findUniqueOrThrow({
        where: { id: stored.objectId },
      });
      assert.equal(retained.status, "RETAINED");
      const deleted = await prisma.meal.findUniqueOrThrow({
        where: { id: meal.id },
      });
      assert.ok(deleted.deletedAt && retained.expiresAt);
      const retentionMs =
        retained.expiresAt.getTime() - deleted.deletedAt.getTime();
      const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
      assert.ok(retentionMs >= twoDaysMs && retentionMs < twoDaysMs + 60_000);
      assert.equal(await storage.cleanupExpired(), 0);
      assert.deepEqual(
        (await app.inject({ url: imageUrl, headers: user(owner) })).rawPayload,
        image,
      );
      assert.equal(
        (await app.inject({ url: imageUrl, headers: user(other) })).statusCode,
        404,
      );

      await prisma.storedObject.update({
        where: { id: stored.objectId },
        data: { expiresAt: new Date(0) },
      });
      assert.equal(await storage.cleanupExpired(), 1);
      assert.equal(
        (await app.inject({ url: imageUrl, headers: user(owner) })).statusCode,
        404,
      );
      await assert.rejects(
        provider.download({ key: attached.key, ownerId: owner }),
      );
      const purged = await prisma.storedObject.findUniqueOrThrow({
        where: { id: stored.objectId },
      });
      assert.equal(purged.status, "DELETED");
      assert.ok(purged.deletedAt);
    } finally {
      await app.close();
      await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
      await prisma.nutritionVersion.deleteMany({ where: { sourceId } });
      await prisma.foodSource.deleteMany({ where: { id: sourceId } });
      await prisma.$disconnect();
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("storage rejects spoofed MIME, malformed, unsupported, empty, and oversized images", async () => {
  const root = await mkdtemp(join(tmpdir(), "nutri-ai-storage-"));
  const app = await buildApp({
    config: config(root, { FILE_UPLOAD_LIMIT_BYTES: "100" }),
  });
  try {
    const cases = [
      {
        bytes: Buffer.from("MZ executable"),
        name: "evil.jpg",
        type: "image/jpeg",
        code: "STORAGE_INVALID_OBJECT",
      },
      {
        bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        name: "broken.png",
        type: "image/png",
        code: "STORAGE_INVALID_OBJECT",
      },
      {
        bytes: Buffer.alloc(0),
        name: "empty.png",
        type: "image/png",
        code: "STORAGE_INVALID_OBJECT",
      },
      {
        bytes: image,
        name: "photo.heic",
        type: "image/heic",
        code: "STORAGE_INVALID_OBJECT",
      },
      {
        bytes: Buffer.concat([image, Buffer.alloc(40)]),
        name: "large.png",
        type: "image/png",
        code: "STORAGE_LIMIT_EXCEEDED",
      },
    ];
    for (const item of cases) {
      const request = multipart(item.bytes, item.name, item.type);
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/storage/uploads",
        headers: { ...user("user-a"), "content-type": request.contentType },
        payload: request.payload,
      });
      assert.equal(
        response.statusCode,
        item.code === "STORAGE_LIMIT_EXCEEDED" ? 413 : 400,
        item.name,
      );
      assert.equal(response.json().error.code, item.code, item.name);
    }
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("S3 read URLs use the configured short-lived TTL and do not expose secrets", async () => {
  const provider = new S3StorageProvider({
    bucket: "private-meals",
    region: "us-east-1",
    accessKey: "public-test-key",
    secretKey: "server-secret-value",
  });
  const ownerId = "user-a";
  const objectId = "123e4567-e89b-12d3-a456-426614174000";
  const url = await provider.getUrl(
    { key: createObjectKey(ownerId, objectId, ".png"), ownerId },
    900,
  );
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("X-Amz-Expires"), "900");
  assert.equal(url.includes("server-secret-value"), false);
  assert.equal(parsed.searchParams.get("X-Amz-SignedHeaders"), "host");
});

test("vision requests use private bytes and validate completed structured responses", async () => {
  const valid = [
    { label: "Phở bò", confidence: 0.8 },
    { label: "Rau thơm", confidence: null },
  ];
  for (const items of [valid, [], [{ label: "Invalid", confidence: 4 }]]) {
    const adapter = new OpenAiMealVision(
      "test-model",
      "test-key",
      1000,
      async (url, init) => {
        assert.equal(url, "https://api.openai.com/v1/responses");
        const body = JSON.parse(String(init?.body));
        assert.equal(body.store, false);
        assert.equal(body.text.format.strict, true);
        assert.equal(
          body.input[0].content[0].image_url,
          `data:image/png;base64,${image.toString("base64")}`,
        );
        return Response.json({
          model: "test-model-version",
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                { type: "output_text", text: JSON.stringify({ items }) },
              ],
            },
          ],
        });
      },
    );
    const result = adapter.analyze({ bytes: image, contentType: "image/png" });
    if (items.length === 1) await assert.rejects(result);
    else
      assert.deepEqual(await result, {
        modelVersion: "test-model-version",
        items,
      });
  }
  const failing = new OpenAiMealVision(
    "test-model",
    "test-key",
    1000,
    async () => new Response("private diagnostics", { status: 503 }),
  );
  await assert.rejects(
    failing.analyze({ bytes: image, contentType: "image/png" }),
    (error: Error) => !error.message.includes("private diagnostics"),
  );
});

test(
  "owned image jobs are claimed once and persist stable candidates without confirming meals",
  { skip: !process.env.DATABASE_URL && "DATABASE_URL is not configured" },
  async () => {
    const prisma = new PrismaClient();
    const owner = randomUUID();
    const other = randomUUID();
    const label = `Phở bò ${owner.slice(0, 8)}`;
    const root = await mkdtemp(join(tmpdir(), "nutri-ai-vision-"));
    const appConfig = config(root, {
      RATE_LIMIT_ENABLED: "false",
      LOG_LEVEL: "silent",
    });
    const storage = new StorageService(
      createStorageProvider(appConfig),
      new PrismaStorageObjectRepository(prisma),
      appConfig,
    );
    let resultMode: "success" | "empty" | "fail" = "success";
    let calls = 0;
    const vision = {
      provider: owner,
      model: "test-model",
      async analyze(input: { bytes: Uint8Array }) {
        calls += 1;
        assert.deepEqual(Buffer.from(input.bytes), image);
        if (resultMode === "fail") throw new Error("private provider detail");
        return {
          modelVersion: "test-version",
          items:
            resultMode === "empty"
              ? []
              : [
                  {
                    label,
                    confidence: 0.9,
                    portion: {
                      amount: 0.2,
                      unit: "kg",
                      basis: "VISIBLE_MEASUREMENT",
                      confidence: 0.8,
                    } as const,
                  },
                  { label: `Rau thơm ${owner}`, confidence: null },
                ],
        };
      },
    };
    const app = await buildApp({
      config: appConfig,
      storageService: storage,
      businessApiService: new PrismaBusinessApiService(
        prisma,
        undefined,
        storage,
        vision,
      ),
    });
    const worker = new ImageAnalysisWorker(prisma, storage, vision, app.log);
    try {
      await prisma.user.createMany({
        data: [owner, other].map((id) => ({ id, email: `${id}@test.local` })),
      });
      const food = await prisma.food.create({
        data: {
          canonicalName: label,
          nameVi: label,
          normalizedName: normalizeFoodText(label),
        },
      });
      const source = await prisma.foodSource.create({
        data: {
          id: owner,
          provider: owner,
          name: "Portion fixture",
          sourceType: "CURATED",
        },
      });
      const version = await prisma.nutritionVersion.create({
        data: {
          sourceId: source.id,
          version: "test-v1",
          effectiveFrom: new Date(0),
        },
      });
      await prisma.foodNutrition.create({
        data: {
          foodId: food.id,
          nutritionVersionId: version.id,
          servingAmount: 100,
          servingUnit: "g",
          referenceBasis: "PER_100_G",
          calories: 150,
        },
      });
      const upload = () =>
        storage.uploadImage(
          {
            ownerId: owner,
            fileName: "meal.png",
            bytes: image,
            contentType: "image/png",
          },
          () => "",
        );
      const create = (id: string, inputReference: string) =>
        app.inject({
          method: "POST",
          url: "/api/v1/meal-analysis",
          headers: user(id),
          payload: { inputType: "IMAGE", inputReference },
        });
      const get = (id: string, analysisId: string) =>
        app.inject({
          method: "GET",
          url: `/api/v1/meal-analysis/${analysisId}`,
          headers: user(id),
        });
      const { reference } = await upload();
      assert.equal((await create(other, reference)).statusCode, 404);
      const queued = await create(owner, reference);
      assert.equal(queued.statusCode, 202);
      const job = queued.json().data;
      assert.equal(job.status, "PENDING");
      assert.equal((await get(other, job.analysisId)).statusCode, 404);
      assert.equal((await create(owner, reference)).statusCode, 400);
      const submit = (userId: string, items: unknown[]) =>
        app.inject({
          method: "POST",
          url: `/api/v1/meal-analysis/${job.analysisId}/confirm`,
          headers: user(userId),
          payload: { items },
        });
      assert.equal(
        (await submit(owner, [{ foodId: food.id, quantity: 150, unit: "g" }]))
          .statusCode,
        409,
      );
      await Promise.all([worker.processNext(), worker.processNext()]);
      assert.equal(calls, 1);
      const ready = (await get(owner, job.analysisId)).json().data;
      assert.equal(ready.status, "READY");
      assert.equal(ready.modelVersion, "test-version");
      const recognized = ready.predictions.find(
        (item: { predictedName: string }) => item.predictedName === label,
      );
      assert.equal(recognized.foodId, food.id);
      assert.equal(recognized.quantity, 200);
      assert.equal(recognized.unit, "g");
      assert.equal(recognized.portionEstimate.confidence, 0.8);
      assert.equal(recognized.portionEstimate.version, "test-v1");
      assert.equal(
        ready.predictions.find(
          (item: { predictedName: string }) => item.predictedName !== label,
        ).foodId,
        null,
      );
      assert.deepEqual((await get(owner, job.analysisId)).json().data, ready);
      assert.equal(
        await prisma.mealItem.count({ where: { mealId: job.mealId } }),
        0,
      );
      assert.equal(
        (await prisma.meal.findUniqueOrThrow({ where: { id: job.mealId } }))
          .status,
        "REVIEW",
      );
      const finalItems = [
        {
          foodId: food.id,
          quantity: 150,
          unit: "g",
          predictionId: recognized.id,
        },
      ];
      assert.equal((await submit(other, finalItems)).statusCode, 404);
      assert.equal(
        (
          await submit(owner, [
            { ...finalItems[0], predictionId: randomUUID() },
          ])
        ).statusCode,
        400,
      );
      const incompatible = await submit(owner, [
        ...finalItems,
        { foodId: food.id, quantity: 100, unit: "ml" },
      ]);
      assert.equal(incompatible.statusCode, 400);
      assert.match(incompatible.json().error.message, /Item 2/);
      assert.equal(
        await prisma.mealItem.count({ where: { mealId: job.mealId } }),
        0,
      );
      const [confirmed, duplicate] = await Promise.all([
        submit(owner, finalItems),
        submit(owner, finalItems),
      ]);
      assert.equal(confirmed.statusCode, 200);
      assert.equal(duplicate.statusCode, 200);
      const saved = confirmed.json().data;
      assert.equal(saved.id, job.mealId);
      assert.deepEqual(duplicate.json().data, saved);
      const diary = await app.inject({
        url: "/api/v1/meals?status=CONFIRMED",
        headers: user(owner),
      });
      assert.equal(diary.statusCode, 200);
      assert.deepEqual(diary.json().data, [saved]);
      const detail = await app.inject({
        url: `/api/v1/meals/${saved.id}`,
        headers: user(owner),
      });
      assert.equal(detail.statusCode, 200);
      assert.deepEqual(detail.json().data, saved);
      assert.equal(
        confirmed.json().data.items[0].provenance.version,
        "test-v1",
      );
      assert.equal(confirmed.json().data.totals.calories, 225);
      assert.equal(confirmed.json().data.totals.protein, null);
      const snapshot = await prisma.mealItemNutrition.findFirstOrThrow({
        where: { mealItem: { mealId: job.mealId } },
      });
      assert.equal(snapshot.nutritionVersionId, version.id);
      assert.equal(snapshot.sourceId, source.id);
      assert.equal(
        await prisma.mealItem.count({ where: { mealId: job.mealId } }),
        1,
      );
      assert.equal(
        (
          await app.inject({
            method: "DELETE",
            url: `/api/v1/meals/${job.mealId}?draftOnly=true`,
            headers: user(owner),
          })
        ).statusCode,
        409,
      );

      resultMode = "empty";
      const empty = (await create(owner, (await upload()).reference)).json()
        .data;
      await worker.processNext();
      const emptyResult = (await get(owner, empty.analysisId)).json().data;
      assert.equal(emptyResult.status, "READY");
      assert.deepEqual(emptyResult.predictions, []);

      resultMode = "fail";
      const failed = (await create(owner, (await upload()).reference)).json()
        .data;
      await worker.processNext();
      const failure = await get(owner, failed.analysisId);
      assert.equal(failure.json().data.status, "FAILED");
      assert.equal(failure.json().data.error.code, "AI_ANALYSIS_ERROR");
      assert.doesNotMatch(failure.body, /private provider detail/);
    } finally {
      await app.close();
      await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
      await prisma.foodNutrition.deleteMany({
        where: { nutritionVersion: { sourceId: owner } },
      });
      await prisma.nutritionVersion.deleteMany({ where: { sourceId: owner } });
      await prisma.foodSource.deleteMany({ where: { id: owner } });
      await prisma.food.deleteMany({ where: { canonicalName: label } });
      await prisma.$disconnect();
      await rm(root, { recursive: true, force: true });
    }
  },
);
