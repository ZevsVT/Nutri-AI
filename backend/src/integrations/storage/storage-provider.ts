import { createHmac, createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { ownerNamespace } from "../../common/uploads/file-policy.js";
import { AppError } from "../../common/errors/app-error.js";

export interface StoredObjectMetadata {
  key: string;
  ownerId: string;
  contentType: string;
  sizeBytes: number;
  fileName: string;
  temporary: boolean;
  checksum?: string;
}

export interface StorageUploadInput {
  key: string;
  ownerId: string;
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
  temporary: boolean;
}

export interface StorageObjectReference {
  key: string;
  ownerId: string;
}

export interface StoredObjectContent {
  bytes: Uint8Array;
  contentType: string;
}

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StoredObjectMetadata>;
  getUrl(
    reference: StorageObjectReference,
    expiresInSeconds: number,
  ): Promise<string>;
  download(reference: StorageObjectReference): Promise<StoredObjectContent>;
  delete(reference: StorageObjectReference): Promise<void>;
}

function validateProviderKey(key: string, ownerId: string): void {
  const expectedPrefix = `users/${ownerNamespace(ownerId)}/objects/`;
  if (
    !key.startsWith(expectedPrefix) ||
    key.includes("..") ||
    key.includes("\\") ||
    key.includes("//")
  ) {
    throw new AppError("STORAGE_ERROR", "Storage object is invalid");
  }
}

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDirectory: string) {}

  async upload(input: StorageUploadInput): Promise<StoredObjectMetadata> {
    validateProviderKey(input.key, input.ownerId);
    const path = this.pathFor(input.key);
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temporaryPath, input.bytes, { flag: "wx" });
      await rename(temporaryPath, path);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new AppError("STORAGE_ERROR", "Storage object already exists", {
          cause: error,
        });
      }
      throw new AppError("STORAGE_ERROR", "Storage upload failed", {
        cause: error,
      });
    }
    return {
      key: input.key,
      ownerId: input.ownerId,
      contentType: input.contentType,
      sizeBytes: input.bytes.byteLength,
      fileName: input.fileName,
      temporary: input.temporary,
      checksum: createHash("sha256").update(input.bytes).digest("hex"),
    };
  }

  async getUrl(): Promise<string> {
    throw new AppError(
      "STORAGE_ERROR",
      "Local storage uses authenticated application reads",
    );
  }

  async download(
    reference: StorageObjectReference,
  ): Promise<StoredObjectContent> {
    validateProviderKey(reference.key, reference.ownerId);
    try {
      const bytes = await readFile(this.pathFor(reference.key));
      return { bytes, contentType: "application/octet-stream" };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new AppError(
          "STORAGE_OBJECT_NOT_FOUND",
          "Storage object was not found",
          { cause: error },
        );
      }
      throw new AppError("STORAGE_ERROR", "Storage read failed", {
        cause: error,
      });
    }
  }

  async delete(reference: StorageObjectReference): Promise<void> {
    validateProviderKey(reference.key, reference.ownerId);
    try {
      await rm(this.pathFor(reference.key), { force: true });
    } catch (error) {
      throw new AppError("STORAGE_ERROR", "Storage deletion failed", {
        cause: error,
      });
    }
  }

  private pathFor(key: string): string {
    const root = resolve(this.rootDirectory);
    const path = resolve(root, key);
    if (path !== root && !path.startsWith(`${root}${sep}`)) {
      throw new AppError("STORAGE_ERROR", "Storage object is invalid");
    }
    return path;
  }
}

export interface S3StorageOptions {
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

/** A dependency-free S3-compatible adapter using AWS Signature Version 4. */
export class S3StorageProvider implements StorageProvider {
  constructor(private readonly options: S3StorageOptions) {}

  async upload(input: StorageUploadInput): Promise<StoredObjectMetadata> {
    validateProviderKey(input.key, input.ownerId);
    const response = await this.request("PUT", input.key, input.bytes, {
      "content-type": input.contentType,
      "x-amz-meta-owner-id": input.ownerId,
    });
    if (!response.ok)
      throw new AppError("STORAGE_ERROR", "Storage upload failed");
    return {
      key: input.key,
      ownerId: input.ownerId,
      contentType: input.contentType,
      sizeBytes: input.bytes.byteLength,
      fileName: input.fileName,
      temporary: input.temporary,
      checksum: createHash("sha256").update(input.bytes).digest("hex"),
    };
  }

  async getUrl(
    reference: StorageObjectReference,
    expiresInSeconds: number,
  ): Promise<string> {
    validateProviderKey(reference.key, reference.ownerId);
    const expires = Math.max(1, Math.min(expiresInSeconds, 604800));
    const { host, path } = this.objectUrl(reference.key);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const date = amzDate.slice(0, 8);
    const credential = `${this.options.accessKey}/${date}/${this.options.region}/s3/aws4_request`;
    const query = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": credential,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expires),
      "X-Amz-SignedHeaders": "host",
    });
    const canonicalQuery = [...query.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
      .join("&");
    const canonicalRequest = [
      "GET",
      path,
      canonicalQuery,
      `host:${host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const signingSecret = deriveSigningSecret(
      this.options.secretKey,
      date,
      this.options.region,
    );
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${date}/${this.options.region}/s3/aws4_request\n${sha256(canonicalRequest)}`;
    const signed = createHmac("sha256", signingSecret)
      .update(stringToSign)
      .digest("hex");
    return `${this.baseUrl()}${path}?${canonicalQuery}&X-Amz-Signature=${signed}`;
  }

  async download(
    reference: StorageObjectReference,
  ): Promise<StoredObjectContent> {
    validateProviderKey(reference.key, reference.ownerId);
    const response = await this.request("GET", reference.key);
    if (response.status === 404)
      throw new AppError(
        "STORAGE_OBJECT_NOT_FOUND",
        "Storage object was not found",
      );
    if (!response.ok)
      throw new AppError("STORAGE_ERROR", "Storage read failed");
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType:
        response.headers.get("content-type") ?? "application/octet-stream",
    };
  }

  async delete(reference: StorageObjectReference): Promise<void> {
    validateProviderKey(reference.key, reference.ownerId);
    const response = await this.request("DELETE", reference.key);
    if (!response.ok && response.status !== 404)
      throw new AppError("STORAGE_ERROR", "Storage deletion failed");
  }

  private async request(
    method: string,
    key: string,
    body?: Uint8Array,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const { host, path } = this.objectUrl(key);
    const payloadHash = body
      ? sha256(body)
      : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const date = amzDate.slice(0, 8);
    const canonicalHeaders: Record<string, string> = {
      ...headers,
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    const signedHeaders = Object.keys(canonicalHeaders)
      .map((value) => value.toLowerCase())
      .sort();
    const canonicalHeaderString = signedHeaders
      .map((name) => `${name}:${canonicalHeaders[name]!.trim()}\n`)
      .join("");
    const canonicalRequest = [
      method,
      path,
      "",
      canonicalHeaderString,
      signedHeaders.join(";"),
      payloadHash,
    ].join("\n");
    const scope = `${date}/${this.options.region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
    const signature = createHmac(
      "sha256",
      deriveSigningSecret(this.options.secretKey, date, this.options.region),
    )
      .update(stringToSign)
      .digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.options.accessKey}/${scope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
    return fetch(`${this.baseUrl()}${path}`, {
      method,
      headers: { ...canonicalHeaders, authorization },
      body: body ? Buffer.from(body) : undefined,
    });
  }

  private objectUrl(key: string): { host: string; path: string } {
    const endpoint = new URL(
      this.options.endpoint ??
        `https://s3.${this.options.region}.amazonaws.com`,
    );
    const path = `/${this.options.bucket}/${key}`;
    return {
      host: endpoint.host,
      path: `${endpoint.pathname.replace(/\/$/, "")}${path}`.replace(
        /\/+/g,
        "/",
      ),
    };
  }

  private baseUrl(): string {
    const endpoint = new URL(
      this.options.endpoint ??
        `https://s3.${this.options.region}.amazonaws.com`,
    );
    return `${endpoint.protocol}//${endpoint.host}${endpoint.pathname.replace(/\/$/, "")}`;
  }
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function deriveSigningSecret(
  secret: string,
  date: string,
  region: string,
): Buffer {
  const dateKey = createHmac("sha256", `AWS4${secret}`).update(date).digest();
  const regionKey = createHmac("sha256", dateKey).update(region).digest();
  const serviceKey = createHmac("sha256", regionKey).update("s3").digest();
  return createHmac("sha256", serviceKey).update("aws4_request").digest();
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
