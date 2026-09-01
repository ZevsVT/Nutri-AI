import type { FastifyBaseLogger } from "fastify";
import type { AppConfig } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  createObjectKey,
  validateImageContent,
  validateUploadMetadata,
} from "../../common/uploads/file-policy.js";
import {
  S3StorageProvider,
  LocalStorageProvider,
  type StorageObjectReference,
  type StorageProvider,
} from "../../integrations/storage/storage-provider.js";
import {
  newStorageObjectId,
  type CreateStorageObjectInput,
  type StorageObjectRecord,
  type StorageObjectRepository,
} from "./storage.repository.js";
import type { MetricsRegistry } from "../../common/observability/metrics.js";

export const STORAGE_REFERENCE_PREFIX = "storage://object/";

export interface UploadImageInput {
  ownerId: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  temporary?: boolean;
}

export interface StorageImageDto {
  objectId: string;
  reference: string;
  contentType: string;
  sizeBytes: number;
  fileName: string;
  expiresAt: string | null;
  readUrl: string;
}

export class StorageService {
  private cleanupTimer?: NodeJS.Timeout;
  private metrics?: MetricsRegistry;

  constructor(
    private readonly provider: StorageProvider,
    private readonly repository: StorageObjectRepository,
    private readonly config: AppConfig,
  ) {}

  setMetrics(metrics: MetricsRegistry): void {
    this.metrics = metrics;
  }

  async uploadImage(
    input: UploadImageInput,
    applicationReadUrl: (id: string) => string,
  ): Promise<StorageImageDto> {
    let metadata;
    try {
      if (input.bytes.byteLength > this.config.fileUploadLimitBytes)
        throw new AppError(
          "STORAGE_LIMIT_EXCEEDED",
          "Image exceeds the upload size limit",
        );
      metadata = validateUploadMetadata(
        {
          fileName: input.fileName,
          contentType: input.contentType,
          sizeBytes: input.bytes.byteLength,
        },
        this.config.fileUploadLimitBytes,
      );
      validateImageContent(input.bytes, metadata.contentType);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("STORAGE_INVALID_OBJECT", "Invalid image upload", {
        cause: error,
      });
    }

    const objectId = newStorageObjectId();
    const key = createObjectKey(input.ownerId, objectId, metadata.extension);
    const temporary = input.temporary ?? true;
    const expiresAt = temporary
      ? new Date(
          Date.now() + this.config.storageTemporaryTtlHours * 60 * 60 * 1000,
        )
      : null;
    try {
      await this.provider.upload({
        key,
        ownerId: input.ownerId,
        bytes: input.bytes,
        contentType: metadata.contentType,
        fileName: metadata.sanitizedFileName,
        temporary,
      });
      const recordInput: CreateStorageObjectInput = {
        id: objectId,
        key,
        ownerId: input.ownerId,
        contentType: metadata.contentType,
        sizeBytes: input.bytes.byteLength,
        fileName: metadata.sanitizedFileName,
        expiresAt,
      };
      const record = await this.repository.create(recordInput);
      return this.toDto(
        record,
        applicationReadUrl,
        this.config.storageProvider === "s3",
      );
    } catch (error) {
      this.metrics?.recordDependencyError("storage", "upload");
      await this.provider
        .delete({ key, ownerId: input.ownerId })
        .catch(() => undefined);
      if (error instanceof AppError) throw error;
      throw new AppError("STORAGE_ERROR", "Storage upload failed", {
        cause: error,
      });
    }
  }

  async getForUser(id: string, ownerId: string): Promise<StorageObjectRecord> {
    this.assertObjectId(id);
    const record = await this.repository.findByIdForUser(id, ownerId);
    if (!record)
      throw new AppError(
        "STORAGE_OBJECT_NOT_FOUND",
        "Storage object was not found",
      );
    return record;
  }

  async readForUser(
    id: string,
    ownerId: string,
  ): Promise<{
    record: StorageObjectRecord;
    bytes: Uint8Array;
    contentType: string;
  }> {
    const record = await this.getForUser(id, ownerId);
    try {
      const content = await this.provider.download(this.reference(record));
      return { record, bytes: content.bytes, contentType: record.contentType };
    } catch (error) {
      this.metrics?.recordDependencyError("storage", "download");
      if (error instanceof AppError) throw error;
      throw new AppError("STORAGE_ERROR", "Storage read failed", {
        cause: error,
      });
    }
  }

  async readUrlForUser(
    id: string,
    ownerId: string,
    applicationReadUrl: (id: string) => string,
  ): Promise<{ url: string; expiresAt: string | null }> {
    const record = await this.getForUser(id, ownerId);
    if (this.config.storageProvider !== "s3")
      return { url: applicationReadUrl(record.id), expiresAt: null };
    let url: string;
    try {
      url = await this.provider.getUrl(
        this.reference(record),
        this.config.storageReadUrlTtlSeconds,
      );
    } catch (error) {
      this.metrics?.recordDependencyError("storage", "get_url");
      if (error instanceof AppError) throw error;
      throw new AppError("STORAGE_ERROR", "Storage URL generation failed", {
        cause: error,
      });
    }
    return {
      url,
      expiresAt: new Date(
        Date.now() + this.config.storageReadUrlTtlSeconds * 1000,
      ).toISOString(),
    };
  }

  async attachForUser(
    reference: string,
    ownerId: string,
  ): Promise<StorageObjectRecord> {
    const record = await this.getByReferenceForUser(reference, ownerId);
    await this.repository.markAttached(record.id, ownerId);
    return { ...record, status: "ATTACHED", expiresAt: null };
  }

  async getByReferenceForUser(
    reference: string,
    ownerId: string,
  ): Promise<StorageObjectRecord> {
    return this.getForUser(this.parseReference(reference), ownerId);
  }

  async retainAfterMealDelete(
    reference: string | null,
    ownerId: string,
  ): Promise<void> {
    if (!reference) return;
    let id: string;
    try {
      id = this.parseReference(reference);
    } catch (error) {
      if (error instanceof AppError && error.code === "STORAGE_INVALID_OBJECT")
        return;
      throw error;
    }
    const record = await this.repository.findByIdForUser(id, ownerId);
    if (!record) return;
    const expiresAt = new Date(
      Date.now() + this.config.storageRetentionDays * 24 * 60 * 60 * 1000,
    );
    await this.repository.markRetained(record.id, ownerId, expiresAt);
  }

  async deleteForUser(id: string, ownerId: string): Promise<void> {
    const record = await this.getForUser(id, ownerId);
    if (record.status === "ATTACHED" || record.status === "RETAINED")
      throw new AppError(
        "INVALID_STATE",
        "Attached meal images follow meal retention policy",
      );
    try {
      await this.provider.delete(this.reference(record));
    } catch (error) {
      this.metrics?.recordDependencyError("storage", "delete");
      if (error instanceof AppError) throw error;
      throw new AppError("STORAGE_ERROR", "Storage delete failed", {
        cause: error,
      });
    }
    await this.repository.markDeleted(record.id, ownerId);
  }

  async cleanupExpired(logger?: FastifyBaseLogger): Promise<number> {
    const expired = await this.repository.listExpired(new Date());
    let cleaned = 0;
    for (const record of expired) {
      try {
        await this.provider.delete(this.reference(record));
        await this.repository.markDeleted(record.id, record.ownerId);
        cleaned += 1;
      } catch (error) {
        this.metrics?.recordDependencyError("storage", "cleanup");
        logger?.error(
          {
            event: "storage_cleanup_failed",
            objectId: record.id,
            errorType: error instanceof Error ? error.name : "unknown",
          },
          "storage_cleanup_failed",
        );
      }
    }
    return cleaned;
  }

  startCleanup(logger: FastifyBaseLogger): void {
    this.cleanupTimer = setInterval(
      () => void this.cleanupExpired(logger),
      60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  stopCleanup(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  parseReference(reference: string): string {
    const objectId = reference.startsWith(STORAGE_REFERENCE_PREFIX)
      ? reference.slice(STORAGE_REFERENCE_PREFIX.length)
      : "";
    if (!/^[0-9a-f-]{36}$/i.test(objectId))
      throw new AppError(
        "STORAGE_INVALID_OBJECT",
        "Storage reference is invalid",
      );
    return objectId;
  }

  private reference(record: StorageObjectRecord): StorageObjectReference {
    return { key: record.key, ownerId: record.ownerId };
  }

  private toDto(
    record: StorageObjectRecord,
    applicationReadUrl: (id: string) => string,
    useProviderUrl: boolean,
  ): StorageImageDto {
    return {
      objectId: record.id,
      reference: `${STORAGE_REFERENCE_PREFIX}${record.id}`,
      contentType: record.contentType,
      sizeBytes: record.sizeBytes,
      fileName: record.fileName,
      expiresAt: record.expiresAt?.toISOString() ?? null,
      readUrl: useProviderUrl ? "" : applicationReadUrl(record.id),
    };
  }

  private assertObjectId(id: string): void {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new AppError("STORAGE_INVALID_OBJECT", "Storage object is invalid");
  }
}

export function createStorageProvider(config: AppConfig): StorageProvider {
  if (config.storageProvider === "local" || config.storageProvider === "none")
    return new LocalStorageProvider(config.storageLocalRoot);
  if (
    !config.storageBucket ||
    !config.storageAccessKey ||
    !config.storageSecretKey
  )
    throw new AppError("STORAGE_ERROR", "Storage is not configured");
  return new S3StorageProvider({
    bucket: config.storageBucket,
    region: config.storageRegion,
    accessKey: config.storageAccessKey,
    secretKey: config.storageSecretKey,
    endpoint: config.storageEndpoint,
  });
}

export function applicationStorageUrl(
  config: AppConfig,
  objectId: string,
): string {
  return `${config.apiBaseUrl}/api/v1/storage/objects/${objectId}`;
}
