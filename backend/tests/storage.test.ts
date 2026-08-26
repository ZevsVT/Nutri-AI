import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildApp } from "../src/app/app.js";
import { loadConfig, type AppConfig } from "../src/config/env.js";
import { createObjectKey } from "../src/common/uploads/file-policy.js";
import { S3StorageProvider } from "../src/integrations/storage/storage-provider.js";

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
