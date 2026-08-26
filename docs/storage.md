# Private image storage

Meal images are private user data. The storage boundary is:

~~~
authenticated request
  → StorageController
  → StorageService
  → StorageProvider
  → private local filesystem or private S3-compatible bucket
~~~

Controllers and meal-analysis services depend on StorageService; they do not
know the provider SDK, bucket, credentials, or object-key layout.

## Upload and access

POST /api/v1/storage/uploads accepts one multipart field named file and
requires authentication. The server validates the file before writing it:

- JPEG, PNG, and WebP are supported; HEIC is rejected because the current
  processing pipeline does not decode it.
- The declared content type must match the file signature and basic container
  structure.
- The file must be non-empty and no larger than FILE_UPLOAD_LIMIT_BYTES
  (10 MiB by default, 50 MiB maximum).
- Original filenames are sanitized for metadata only and never become object
  paths.

The server creates a UUID and stores a reference such as
storage://object/{uuid}. The object key is generated server-side as
users/{owner-namespace}/objects/{uuid}.{extension}; the owner namespace is a
non-reversible hash of the authenticated user ID. Client-supplied user IDs,
keys, paths, and URLs are not accepted.

GET /api/v1/storage/objects/:id performs an authenticated application read.
GET /api/v1/storage/objects/:id/url performs the ownership check first, then
returns a local authenticated API URL or an S3 SigV4 URL. S3 URLs use
STORAGE_READ_URL_TTL_SECONDS (15 minutes by default, capped at seven days).
Signed URLs are never persisted as object identity.

The analysis endpoint accepts image input only when its reference resolves to an
object owned by the authenticated user. An arbitrary external URL, another
user's reference, and traversal-like references are rejected before analysis
creation.

## Providers and configuration

Development uses STORAGE_PROVIDER=local and writes below
STORAGE_LOCAL_ROOT (default .data/storage). The local provider validates
the namespace again and resolves paths beneath that root, so it does not
provide a security bypass.

Production uses STORAGE_PROVIDER=s3 with a private bucket. Configure
STORAGE_BUCKET, STORAGE_REGION, STORAGE_ACCESS_KEY, and
STORAGE_SECRET_KEY; STORAGE_ENDPOINT is optional for S3-compatible services.
Credentials are server-only environment variables and are never returned to
clients or logged. Staging and production reject an unconfigured storage
provider.

## Lifecycle and cleanup

New uploads are UPLOADED and expire after
STORAGE_TEMPORARY_TTL_HOURS (24 hours by default). Creating an image analysis
marks the object ATTACHED and removes the temporary expiry. Meal soft-delete
changes the object to RETAINED for STORAGE_RETENTION_DAYS (30 days by
default). An hourly in-process cleanup pass deletes expired provider objects
and marks their metadata DELETED. Failed cleanup remains retryable and emits
storage_cleanup_failed without exposing provider details.

If upload succeeds but analysis creation fails, the object remains temporary
and is reclaimed by expiry. If AI processing fails after attachment, the image
remains available for the user's retry and follows the meal retention policy.

## Troubleshooting

- STORAGE_INVALID_OBJECT: content, type, extension, reference, or image
  structure failed validation.
- STORAGE_LIMIT_EXCEEDED: the multipart file exceeded the configured limit.
- STORAGE_OBJECT_NOT_FOUND: the object is missing or is not owned by the
  requester; the response intentionally does not distinguish those cases.
- STORAGE_ERROR: the provider or metadata operation failed; inspect the
  request ID and server-side structured logs, never client credentials.

Apply npm run db:validate, npm run db:generate, and npm run db:migrate after
reviewing the additive 20260825220000_add_secure_storage migration.
