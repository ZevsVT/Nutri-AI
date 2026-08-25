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
  compress?: boolean;
}

export interface StorageObjectReference {
  key: string;
  ownerId: string;
}

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StoredObjectMetadata>;
  getUrl(reference: StorageObjectReference): Promise<string>;
  delete(reference: StorageObjectReference): Promise<void>;
}
