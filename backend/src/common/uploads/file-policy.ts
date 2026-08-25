import { randomUUID } from "node:crypto";
import { z } from "zod";

const imageExtensions = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic", ".heif"],
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
  const owner = options.ownerId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 128);
  const prefix = options.temporary ? "temporary" : "objects";
  return `${prefix}/${owner || "unknown"}/${randomUUID()}-${sanitizeUploadFileName(fileName)}`;
}

export function canAccessStoredObject(
  objectOwnerId: string,
  requesterId: string,
): boolean {
  return objectOwnerId === requesterId;
}
