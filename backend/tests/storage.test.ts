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
import { PrismaBusinessApiService } from "../src/modules/api/api.service.js";
import { PrismaStorageObjectRepository } from "../src/modules/storage/storage.repository.js";
import { StorageService } from "../src/modules/storage/storage.service.js";

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
