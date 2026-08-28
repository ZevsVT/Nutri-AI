import { z } from "zod";

const emptyStringAsUndefined = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const httpUrl = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "URL must use HTTP or HTTPS",
  );

const optionalPostgresUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .url()
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must use postgres:// or postgresql://",
    )
    .optional(),
);

const optionalNumber = (
  defaultValue: number,
  minimum: number,
  maximum: number,
) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int().min(minimum).max(maximum).default(defaultValue),
  );

const booleanString = (defaultValue: "true" | "false" = "false") =>
  z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((value) => value === "true");

const rawEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  PORT: optionalNumber(4000, 1, 65535),
  API_BASE_URL: httpUrl.default("http://localhost:4000"),
  DATABASE_URL: optionalPostgresUrl,
  JWT_SECRET: emptyStringAsUndefined,
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+(s|m|h|d|w)$/, "JWT_EXPIRES_IN must use a duration such as 15m")
    .default("15m"),
  AUTH_SESSION_TTL_HOURS: optionalNumber(720, 1, 8_760),
  PASSWORD_RESET_TTL_MINUTES: optionalNumber(30, 5, 1_440),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  STORAGE_PROVIDER: z.enum(["none", "local", "s3"]).default("local"),
  STORAGE_BUCKET: emptyStringAsUndefined,
  STORAGE_REGION: z.string().trim().min(1).max(64).default("us-east-1"),
  STORAGE_ENDPOINT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .url()
      .refine(
        (value) => value.startsWith("http://") || value.startsWith("https://"),
        "STORAGE_ENDPOINT must use HTTP or HTTPS",
      )
      .optional(),
  ),
  STORAGE_ACCESS_KEY: emptyStringAsUndefined,
  STORAGE_SECRET_KEY: emptyStringAsUndefined,
  STORAGE_LOCAL_ROOT: z.string().trim().min(1).max(500).default(".data/storage"),
  STORAGE_READ_URL_TTL_SECONDS: optionalNumber(900, 60, 604_800),
  STORAGE_TEMPORARY_TTL_HOURS: optionalNumber(24, 1, 168),
  STORAGE_RETENTION_DAYS: optionalNumber(30, 1, 3_650),
  AI_PROVIDER: z.string().min(1).default("none"),
  AI_API_KEY: emptyStringAsUndefined,
  NUTRITION_PROVIDER: z.string().min(1).default("none"),
  NUTRITION_API_KEY: emptyStringAsUndefined,
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
  AUTH_DEV_MODE: booleanString(),
  REQUEST_BODY_LIMIT_BYTES: optionalNumber(1_048_576, 1, 10_485_760),
  FILE_UPLOAD_LIMIT_BYTES: optionalNumber(10_485_760, 1, 52_428_800),
  RATE_LIMIT_MAX: optionalNumber(100, 1, 1_000_000),
  RATE_LIMIT_WINDOW_MS: optionalNumber(60_000, 1, 86_400_000),
  RATE_LIMIT_ENABLED: booleanString("true"),
  RATE_LIMIT_AUTH_MAX: optionalNumber(10, 1, 1_000_000),
  RATE_LIMIT_EXPENSIVE_MAX: optionalNumber(20, 1, 1_000_000),
  RATE_LIMIT_UPLOAD_MAX: optionalNumber(10, 1, 1_000_000),
  EXTERNAL_REQUEST_TIMEOUT_MS: optionalNumber(10_000, 1, 120_000),
  EXTERNAL_RETRY_LIMIT: optionalNumber(2, 0, 5),
  SHUTDOWN_TIMEOUT_MS: optionalNumber(10_000, 1, 120_000),
  TRUST_PROXY: booleanString(),
});

export type EnvironmentName = "development" | "staging" | "production";
export type LogLevel =
  "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

export interface AppConfig {
  nodeEnv: EnvironmentName;
  port: number;
  apiBaseUrl: string;
  databaseUrl?: string;
  jwtSecret?: string;
  jwtExpiresIn: string;
  authSessionTtlHours: number;
  passwordResetTtlMinutes: number;
  corsOrigins: string[];
  storageProvider: "none" | "local" | "s3";
  storageBucket?: string;
  storageRegion: string;
  storageEndpoint?: string;
  storageAccessKey?: string;
  storageSecretKey?: string;
  storageLocalRoot: string;
  storageReadUrlTtlSeconds: number;
  storageTemporaryTtlHours: number;
  storageRetentionDays: number;
  aiProvider: string;
  aiApiKey?: string;
  nutritionProvider: string;
  nutritionApiKey?: string;
  logLevel: LogLevel;
  authDevMode: boolean;
  requestBodyLimitBytes: number;
  fileUploadLimitBytes: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  rateLimitEnabled: boolean;
  rateLimitAuthMax: number;
  rateLimitExpensiveMax: number;
  rateLimitUploadMax: number;
  externalRequestTimeoutMs: number;
  externalRetryLimit: number;
  shutdownTimeoutMs: number;
  trustProxy: boolean;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const result = rawEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const fields = result.error.issues.map(
      (issue) => issue.path.join(".") || "environment",
    );
    throw new ConfigurationError(
      `Invalid environment configuration: ${fields.join(", ")}`,
    );
  }

  const parsed = result.data;
  const corsOrigins = parseCorsOrigins(parsed.CORS_ORIGINS);
  const secureEnvironment =
    parsed.NODE_ENV === "staging" || parsed.NODE_ENV === "production";
  const configurationIssues: string[] = [];

  if (
    secureEnvironment &&
    (!parsed.JWT_SECRET || parsed.JWT_SECRET.length < 32)
  ) {
    configurationIssues.push(
      "JWT_SECRET must contain at least 32 characters in staging or production",
    );
  }

  if (
    secureEnvironment &&
    (!environment.CORS_ORIGINS || corsOrigins.length === 0)
  ) {
    configurationIssues.push(
      "CORS_ORIGINS must contain at least one allowed origin in staging or production",
    );
  }

  if (secureEnvironment && !parsed.API_BASE_URL.startsWith("https://")) {
    configurationIssues.push(
      "API_BASE_URL must use HTTPS in staging or production",
    );
  }

  if (corsOrigins.includes("*")) {
    configurationIssues.push(
      "CORS_ORIGINS cannot use * when credentialed CORS is enabled",
    );
  }

  if (
    secureEnvironment &&
    corsOrigins.some((origin) => !origin.startsWith("https://"))
  ) {
    configurationIssues.push(
      "CORS_ORIGINS must use HTTPS in staging or production",
    );
  }

  if (parsed.AUTH_DEV_MODE && parsed.NODE_ENV !== "development") {
    configurationIssues.push("AUTH_DEV_MODE is only permitted in development");
  }

  if (parsed.AI_PROVIDER !== "none" && !parsed.AI_API_KEY) {
    configurationIssues.push(
      "AI_API_KEY is required when AI_PROVIDER is configured",
    );
  }

  if (parsed.NUTRITION_PROVIDER !== "none" && !parsed.NUTRITION_API_KEY) {
    configurationIssues.push(
      "NUTRITION_API_KEY is required when NUTRITION_PROVIDER is configured",
    );
  }

  if (parsed.STORAGE_PROVIDER === "s3" && !parsed.STORAGE_BUCKET) {
    configurationIssues.push(
      "STORAGE_BUCKET is required when STORAGE_PROVIDER is configured",
    );
  }

  if (parsed.STORAGE_PROVIDER === "s3" && (!parsed.STORAGE_ACCESS_KEY || !parsed.STORAGE_SECRET_KEY)) {
    configurationIssues.push("STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY are required for S3 storage");
  }

  if (secureEnvironment && parsed.STORAGE_PROVIDER === "none") {
    configurationIssues.push("STORAGE_PROVIDER must be local or s3 in staging or production");
  }

  if (configurationIssues.length > 0) {
    throw new ConfigurationError(
      `Invalid environment configuration: ${configurationIssues.join("; ")}`,
    );
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    apiBaseUrl: parsed.API_BASE_URL,
    databaseUrl: parsed.DATABASE_URL,
    jwtSecret: parsed.JWT_SECRET,
    jwtExpiresIn: parsed.JWT_EXPIRES_IN,
    authSessionTtlHours: parsed.AUTH_SESSION_TTL_HOURS,
    passwordResetTtlMinutes: parsed.PASSWORD_RESET_TTL_MINUTES,
    corsOrigins,
    storageProvider: parsed.STORAGE_PROVIDER,
    storageBucket: parsed.STORAGE_BUCKET,
    storageRegion: parsed.STORAGE_REGION,
    storageEndpoint: parsed.STORAGE_ENDPOINT,
    storageAccessKey: parsed.STORAGE_ACCESS_KEY,
    storageSecretKey: parsed.STORAGE_SECRET_KEY,
    storageLocalRoot: parsed.STORAGE_LOCAL_ROOT,
    storageReadUrlTtlSeconds: parsed.STORAGE_READ_URL_TTL_SECONDS,
    storageTemporaryTtlHours: parsed.STORAGE_TEMPORARY_TTL_HOURS,
    storageRetentionDays: parsed.STORAGE_RETENTION_DAYS,
    aiProvider: parsed.AI_PROVIDER,
    aiApiKey: parsed.AI_API_KEY,
    nutritionProvider: parsed.NUTRITION_PROVIDER,
    nutritionApiKey: parsed.NUTRITION_API_KEY,
    logLevel: parsed.LOG_LEVEL,
    authDevMode: parsed.AUTH_DEV_MODE,
    requestBodyLimitBytes: parsed.REQUEST_BODY_LIMIT_BYTES,
    fileUploadLimitBytes: parsed.FILE_UPLOAD_LIMIT_BYTES,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitEnabled: parsed.RATE_LIMIT_ENABLED,
    rateLimitAuthMax: parsed.RATE_LIMIT_AUTH_MAX,
    rateLimitExpensiveMax: parsed.RATE_LIMIT_EXPENSIVE_MAX,
    rateLimitUploadMax: parsed.RATE_LIMIT_UPLOAD_MAX,
    externalRequestTimeoutMs: parsed.EXTERNAL_REQUEST_TIMEOUT_MS,
    externalRetryLimit: parsed.EXTERNAL_RETRY_LIMIT,
    shutdownTimeoutMs: parsed.SHUTDOWN_TIMEOUT_MS,
    trustProxy: parsed.TRUST_PROXY,
  };
}

function parseCorsOrigins(value: string): string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    if (origin === "*") {
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new ConfigurationError(
        "Invalid environment configuration: CORS_ORIGINS contains an invalid URL",
      );
    }

    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new ConfigurationError(
        "Invalid environment configuration: CORS_ORIGINS must contain origins only",
      );
    }
  }

  return origins.map((origin) =>
    origin === "*" ? origin : new URL(origin).origin,
  );
}
