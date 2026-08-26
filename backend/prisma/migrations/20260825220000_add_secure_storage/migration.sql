CREATE TYPE "StorageObjectStatus" AS ENUM ('UPLOADED', 'ATTACHED', 'RETAINED', 'DELETED');

CREATE TABLE "StoredObject" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" VARCHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileName" VARCHAR(128) NOT NULL,
    "status" "StorageObjectStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoredObject_objectKey_key" ON "StoredObject"("objectKey");
CREATE INDEX "StoredObject_ownerId_createdAt_idx" ON "StoredObject"("ownerId", "createdAt");
CREATE INDEX "StoredObject_status_expiresAt_idx" ON "StoredObject"("status", "expiresAt");

ALTER TABLE "StoredObject"
  ADD CONSTRAINT "StoredObject_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoredObject"
  ADD CONSTRAINT "StoredObject_sizeBytes_check" CHECK ("sizeBytes" > 0);
