import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../common/errors/app-error.js";
import { successResponse } from "../../common/errors/error-handler.js";
import {
  applicationStorageUrl,
  type StorageService,
} from "./storage.service.js";
import type { AppConfig } from "../../config/env.js";

type ObjectParams = { id: string };

export class StorageController {
  constructor(
    private readonly service: StorageService,
    private readonly config: AppConfig,
  ) {}

  upload = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.isMultipart())
      throw new AppError(
        "VALIDATION_ERROR",
        "A multipart image upload is required",
      );
    let uploaded:
      Awaited<ReturnType<StorageService["uploadImage"]>> | undefined;
    let fileCount = 0;
    for await (const part of request.parts()) {
      if (part.type !== "file") continue;
      fileCount += 1;
      if (part.fieldname !== "file" || fileCount > 1)
        throw new AppError(
          "VALIDATION_ERROR",
          "Exactly one file field named file is required",
        );
      let bytes: Buffer;
      try {
        bytes = await part.toBuffer();
      } catch (error) {
        if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE")
          throw new AppError(
            "STORAGE_LIMIT_EXCEEDED",
            "Image exceeds the upload size limit",
            { cause: error },
          );
        throw error;
      }
      if (part.file.truncated)
        throw new AppError(
          "STORAGE_LIMIT_EXCEEDED",
          "Image exceeds the upload size limit",
        );
      uploaded = await this.service.uploadImage(
        {
          ownerId: request.user!.id,
          fileName: part.filename,
          contentType: part.mimetype,
          bytes,
        },
        (id) => applicationStorageUrl(this.config, id),
      );
    }
    if (!uploaded)
      throw new AppError(
        "VALIDATION_ERROR",
        "Exactly one image file is required",
      );
    const read = await this.service.readUrlForUser(
      uploaded.objectId,
      request.user!.id,
      (id) => applicationStorageUrl(this.config, id),
    );
    request.log.info(
      {
        event: "storage_upload_succeeded",
        requestId: request.id,
        userId: request.user!.id,
        objectId: uploaded.objectId,
        sizeBytes: uploaded.sizeBytes,
        contentType: uploaded.contentType,
      },
      "storage_upload_succeeded",
    );
    return reply
      .code(201)
      .send(
        successResponse({
          ...uploaded,
          readUrl: read.url,
          readUrlExpiresAt: read.expiresAt,
        }),
      );
  };

  read = async (
    request: FastifyRequest<{ Params: ObjectParams }>,
    reply: FastifyReply,
  ) => {
    const result = await this.service.readForUser(
      request.params.id,
      request.user!.id,
    );
    return reply
      .header("cache-control", "private, no-store")
      .type(result.contentType)
      .send(Buffer.from(result.bytes));
  };

  readUrl = async (
    request: FastifyRequest<{ Params: ObjectParams }>,
    reply: FastifyReply,
  ) => {
    const result = await this.service.readUrlForUser(
      request.params.id,
      request.user!.id,
      (id) => applicationStorageUrl(this.config, id),
    );
    request.log.info(
      {
        event: "storage_read_url_generated",
        requestId: request.id,
        userId: request.user!.id,
        objectId: request.params.id,
      },
      "storage_read_url_generated",
    );
    return reply.send(successResponse(result));
  };

  delete = async (
    request: FastifyRequest<{ Params: ObjectParams }>,
    reply: FastifyReply,
  ) => {
    await this.service.deleteForUser(request.params.id, request.user!.id);
    request.log.info(
      {
        event: "storage_object_deleted",
        requestId: request.id,
        userId: request.user!.id,
        objectId: request.params.id,
      },
      "storage_object_deleted",
    );
    return reply.code(204).send();
  };
}
