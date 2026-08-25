import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../src/common/errors/app-error.js";
import {
  canAccessStoredObject,
  createUniqueObjectName,
  sanitizeUploadFileName,
} from "../src/common/uploads/file-policy.js";
import { validateFileMetadata } from "../src/common/middleware/request-validation.js";

test("upload metadata sanitizes names and preserves ownership-safe object keys", () => {
  const metadata = validateFileMetadata(
    {
      fileName: "../../meal photo.JPG",
      contentType: "IMAGE/JPEG",
      sizeBytes: 2048,
    },
    10_000,
  );

  assert.equal(metadata.sanitizedFileName, "_._meal photo.JPG");
  assert.equal(metadata.extension, ".jpg");

  const firstKey = createUniqueObjectName(metadata.sanitizedFileName, {
    ownerId: "user/123",
    temporary: true,
  });
  const secondKey = createUniqueObjectName(metadata.sanitizedFileName, {
    ownerId: "user/123",
    temporary: true,
  });
  assert.match(firstKey, /^temporary\/user_123\//);
  assert.notEqual(firstKey, secondKey);
  assert.equal(firstKey.includes(".."), false);
  assert.equal(canAccessStoredObject("user/123", "user/123"), true);
  assert.equal(canAccessStoredObject("user/123", "user/456"), false);
});

test("upload validation rejects mismatched extensions, unknown fields, and oversized files", () => {
  assert.throws(
    () =>
      validateFileMetadata(
        { fileName: "meal.exe", contentType: "image/jpeg", sizeBytes: 10 },
        100,
      ),
    (error: unknown) =>
      error instanceof AppError && error.code === "VALIDATION_ERROR",
  );
  assert.throws(
    () =>
      validateFileMetadata(
        {
          fileName: "meal.jpg",
          contentType: "image/jpeg",
          sizeBytes: 10,
          unexpected: true,
        },
        100,
      ),
    AppError,
  );
  assert.throws(
    () =>
      validateFileMetadata(
        { fileName: "meal.jpg", contentType: "image/jpeg", sizeBytes: 101 },
        100,
      ),
    AppError,
  );
});

test("filename sanitizer removes path and control characters", () => {
  const sanitized = sanitizeUploadFileName("..\\private\u0000/meal?.png");
  assert.equal(sanitized.includes("\\"), false);
  assert.equal(sanitized.includes("/"), false);
  assert.equal(sanitized.includes("\u0000"), false);
});
