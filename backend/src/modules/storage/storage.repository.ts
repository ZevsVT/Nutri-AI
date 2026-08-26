import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

export type StorageObjectStatus =
  "UPLOADED" | "ATTACHED" | "RETAINED" | "DELETED";

export interface StorageObjectRecord {
  id: string;
  key: string;
  ownerId: string;
  contentType: string;
  sizeBytes: number;
  fileName: string;
  status: StorageObjectStatus;
  createdAt: Date;
  expiresAt: Date | null;
  deletedAt: Date | null;
}

export interface CreateStorageObjectInput {
  id: string;
  key: string;
  ownerId: string;
  contentType: string;
  sizeBytes: number;
  fileName: string;
  expiresAt: Date | null;
}

export interface StorageObjectRepository {
  create(input: CreateStorageObjectInput): Promise<StorageObjectRecord>;
  findByIdForUser(
    id: string,
    ownerId: string,
  ): Promise<StorageObjectRecord | null>;
  markAttached(id: string, ownerId: string): Promise<void>;
  markRetained(id: string, ownerId: string, expiresAt: Date): Promise<void>;
  markDeleted(id: string, ownerId: string): Promise<void>;
  listExpired(now: Date): Promise<StorageObjectRecord[]>;
}

export class InMemoryStorageObjectRepository implements StorageObjectRepository {
  private readonly records = new Map<string, StorageObjectRecord>();

  async create(input: CreateStorageObjectInput): Promise<StorageObjectRecord> {
    const record: StorageObjectRecord = {
      ...input,
      status: "UPLOADED",
      createdAt: new Date(),
      deletedAt: null,
    };
    this.records.set(record.id, record);
    return { ...record };
  }

  async findByIdForUser(
    id: string,
    ownerId: string,
  ): Promise<StorageObjectRecord | null> {
    const record = this.records.get(id);
    return record && record.ownerId === ownerId && record.status !== "DELETED"
      ? { ...record }
      : null;
  }

  async markAttached(id: string, ownerId: string): Promise<void> {
    const record = await this.findRequired(id, ownerId);
    record.status = "ATTACHED";
    record.expiresAt = null;
  }

  async markRetained(
    id: string,
    ownerId: string,
    expiresAt: Date,
  ): Promise<void> {
    const record = await this.findRequired(id, ownerId);
    record.status = "RETAINED";
    record.expiresAt = expiresAt;
  }

  async markDeleted(id: string, ownerId: string): Promise<void> {
    const record = await this.findRequired(id, ownerId);
    record.status = "DELETED";
    record.deletedAt = new Date();
    record.expiresAt = null;
  }

  async listExpired(now: Date): Promise<StorageObjectRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.status !== "DELETED" &&
          record.expiresAt !== null &&
          record.expiresAt <= now,
      )
      .map((record) => ({ ...record }));
  }

  private async findRequired(
    id: string,
    ownerId: string,
  ): Promise<StorageObjectRecord> {
    const record = this.records.get(id);
    if (!record || record.ownerId !== ownerId || record.status === "DELETED")
      throw new Error("Storage object not found");
    return record;
  }
}

export class PrismaStorageObjectRepository implements StorageObjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateStorageObjectInput): Promise<StorageObjectRecord> {
    const record = await this.prisma.storedObject.create({
      data: {
        id: input.id,
        objectKey: input.key,
        ownerId: input.ownerId,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        fileName: input.fileName,
        expiresAt: input.expiresAt,
      },
    });
    return toRecord(record);
  }

  async findByIdForUser(
    id: string,
    ownerId: string,
  ): Promise<StorageObjectRecord | null> {
    const record = await this.prisma.storedObject.findFirst({
      where: { id, ownerId, deletedAt: null },
    });
    return record ? toRecord(record) : null;
  }

  async markAttached(id: string, ownerId: string): Promise<void> {
    await this.prisma.storedObject.updateMany({
      where: { id, ownerId, deletedAt: null },
      data: { status: "ATTACHED", expiresAt: null },
    });
  }

  async markRetained(
    id: string,
    ownerId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.storedObject.updateMany({
      where: { id, ownerId, deletedAt: null },
      data: { status: "RETAINED", expiresAt },
    });
  }

  async markDeleted(id: string, ownerId: string): Promise<void> {
    await this.prisma.storedObject.updateMany({
      where: { id, ownerId, deletedAt: null },
      data: { status: "DELETED", deletedAt: new Date(), expiresAt: null },
    });
  }

  async listExpired(now: Date): Promise<StorageObjectRecord[]> {
    const records = await this.prisma.storedObject.findMany({
      where: { deletedAt: null, expiresAt: { lte: now } },
    });
    return records.map(toRecord);
  }
}

function toRecord(record: {
  id: string;
  objectKey: string;
  ownerId: string;
  contentType: string;
  sizeBytes: number;
  fileName: string;
  status: StorageObjectStatus;
  createdAt: Date;
  expiresAt: Date | null;
  deletedAt: Date | null;
}): StorageObjectRecord {
  const { objectKey, ...rest } = record;
  return { ...rest, key: objectKey };
}

export function newStorageObjectId(): string {
  return randomUUID();
}
