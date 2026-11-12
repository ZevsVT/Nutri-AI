import type { FastifyRequest, preHandlerHookHandler } from "fastify";
import { z, type ZodType } from "zod";
import { AppError } from "../errors/app-error.js";
import { validateUploadMetadata } from "../uploads/file-policy.js";

export { fileMetadataSchema } from "../uploads/file-policy.js";

export type ValidationTarget = "body" | "query" | "params";

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

function validationDetails(
  error: z.ZodError,
): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "request",
    message: issue.message,
  }));
}

export function parseOrThrow<T>(
  schema: ZodType<T>,
  input: unknown,
  target: ValidationTarget,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", `Invalid request ${target}`, {
      details: validationDetails(result.error),
    });
  }
  return result.data;
}

export function validateRequest<T>(
  target: ValidationTarget,
  schema: ZodType<T>,
): preHandlerHookHandler {
  return async (request: FastifyRequest): Promise<void> => {
    const parsed = parseOrThrow(schema, request[target], target);
    const mutableRequest = request as unknown as Record<
      ValidationTarget,
      unknown
    >;
    mutableRequest[target] = parsed;
  };
}

export function validateFileMetadata(
  input: unknown,
  maxSizeBytes: number,
): ReturnType<typeof validateUploadMetadata> {
  try {
    return validateUploadMetadata(input, maxSizeBytes);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError("VALIDATION_ERROR", "Invalid request body", {
        details: validationDetails(error),
      });
    }
    throw new AppError("VALIDATION_ERROR", "Invalid request body");
  }
}
