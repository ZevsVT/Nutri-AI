import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

const imageExtensions = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
} as const;

export const allowedImageContentTypes = Object.keys(imageExtensions) as [
  keyof typeof imageExtensions,
  ...(keyof typeof imageExtensions)[],
];

const rawFileMetadataShape = {
  fileName: z.string().trim().min(1).max(255),
  contentType: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value): value is keyof typeof imageExtensions =>
        value in imageExtensions,
      "Unsupported image type",
    ),
};

function createFileMetadataSchema(maxSizeBytes: number) {
  return z
    .object({
      ...rawFileMetadataShape,
      sizeBytes: z.number().int().positive().max(maxSizeBytes),
    })
    .strict()
    .superRefine((metadata, context) => {
      const extension = extensionOf(metadata.fileName);
      const extensions = imageExtensions[metadata.contentType];
      if (!extensions.includes(extension as never)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fileName"],
          message: "File extension does not match content type",
        });
      }
    });
}

export const fileMetadataSchema = createFileMetadataSchema(52_428_800);

export type FileMetadata = z.infer<
  ReturnType<typeof createFileMetadataSchema>
> & {
  sanitizedFileName: string;
  extension: string;
};

export interface UploadObjectOptions {
  ownerId: string;
  temporary?: boolean;
  compress?: boolean;
}

export function sanitizeUploadFileName(fileName: string): string {
  const normalized = fileName.normalize("NFKC");
  const withoutControlCharacters = Array.from(normalized, (character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || character === "/" || code < 32 || code === 127
      ? "_"
      : character;
  }).join("");
  const sanitized = withoutControlCharacters
    .replace(/\.\.+/g, ".")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 128);

  return sanitized || "upload";
}

export function extensionOf(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? "" : fileName.slice(lastDot).toLowerCase();
}

export function validateUploadMetadata(
  input: unknown,
  maxSizeBytes: number,
): FileMetadata {
  const schema = createFileMetadataSchema(maxSizeBytes);
  const result = schema.safeParse(input);
  if (!result.success) {
    throw result.error;
  }

  const sanitizedFileName = sanitizeUploadFileName(result.data.fileName);
  const extension = extensionOf(sanitizedFileName);

  return { ...result.data, sanitizedFileName, extension };
}

export function createUniqueObjectName(
  fileName: string,
  options: UploadObjectOptions,
): string {
  const owner = ownerNamespace(options.ownerId);
  const prefix = options.temporary ? "temporary" : "objects";
  const extension = extensionOf(sanitizeUploadFileName(fileName));
  return `${prefix}/${owner}/${randomUUID()}${extension}`;
}

export function createObjectKey(
  ownerId: string,
  objectId: string,
  extension: string,
): string {
  if (!/^[0-9a-f-]{36}$/i.test(objectId)) {
    throw new Error("Storage object IDs must be UUIDs");
  }
  if (!/^\.[a-z0-9]{1,8}$/.test(extension)) {
    throw new Error("Storage object extensions are invalid");
  }
  return `users/${ownerNamespace(ownerId)}/objects/${objectId}${extension}`;
}

export function ownerNamespace(ownerId: string): string {
  return createHash("sha256").update(ownerId, "utf8").digest("hex").slice(0, 32);
}

export function validateImageContent(
  bytes: Uint8Array,
  contentType: FileMetadata["contentType"],
): void {
  if (bytes.length === 0) {
    throw new Error("Image is empty");
  }

  const detected = detectImageContentType(bytes);
  if (detected !== contentType) {
    throw new Error("Image content does not match its declared type");
  }

  if (
    (contentType === "image/jpeg" && !hasJpegEnd(bytes)) ||
    (contentType === "image/png" && !hasValidPngStructure(bytes)) ||
    (contentType === "image/webp" && !hasValidWebpStructure(bytes))
  ) {
    throw new Error("Image content is malformed");
  }
}

function detectImageContentType(
  bytes: Uint8Array,
): FileMetadata["contentType"] | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

function hasJpegEnd(bytes: Uint8Array): boolean {
  if (bytes.length < 10 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return false;
  let offset = 2;
  let sawFrame = false;
  let sawScan = false;
  while (offset < bytes.length - 2) {
    if (bytes[offset] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === undefined) return false;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) return sawFrame && sawScan;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) return false;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 8 || (((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0)) === 0 || (((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0)) === 0) return false;
      sawFrame = true;
    }
    if (marker === 0xda) sawScan = true;
    offset += length;
    if (sawScan) return sawFrame;
  }
  return false;
}

function hasValidPngStructure(bytes: Uint8Array): boolean {
  if (bytes.length < 33 || readUInt32(bytes, 8) !== 13 || ascii(bytes, 12, 4) !== "IHDR") {
    return false;
  }
  if (readUInt32(bytes, 16) === 0 || readUInt32(bytes, 20) === 0) {
    return false;
  }

  let offset = 8;
  let sawImageData = false;
  while (offset + 12 <= bytes.length) {
    const length = readUInt32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (end > bytes.length) return false;
    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") return sawImageData && length === 0 && end === bytes.length;
    offset = end;
  }
  return false;
}

function hasValidWebpStructure(bytes: Uint8Array): boolean {
  if (bytes.length < 20) return false;
  const declaredSize = readUInt32(bytes, 4) + 8;
  if (declaredSize > bytes.length) return false;
  const chunkType = ascii(bytes, 12, 4);
  const chunkSize = readUInt32(bytes, 16);
  return ["VP8 ", "VP8L", "VP8X"].includes(chunkType) && 20 + chunkSize <= bytes.length;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function readUInt32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

export function canAccessStoredObject(
  objectOwnerId: string,
  requesterId: string,
): boolean {
  return objectOwnerId === requesterId;
}
