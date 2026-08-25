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

const booleanString = z
  .enum(["true", "false"])
  .default("false")
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
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  STORAGE_PROVIDER: z.string().min(1).default("none"),
  STORAGE_BUCKET: emptyStringAsUndefined,
  AI_PROVIDER: z.string().min(1).default("none"),
  AI_API_KEY: emptyStringAsUndefined,
  NUTRITION_PROVIDER: z.string().min(1).default("none"),
  NUTRITION_API_KEY: emptyStringAsUndefined,
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
  AUTH_DEV_MODE: booleanString,
  REQUEST_BODY_LIMIT_BYTES: optionalNumber(1_048_576, 1, 10_485_760),
  FILE_UPLOAD_LIMIT_BYTES: optionalNumber(10_485_760, 1, 52_428_800),
  RATE_LIMIT_MAX: optionalNumber(100, 1, 1_000_000),
  RATE_LIMIT_WINDOW_MS: optionalNumber(60_000, 1, 86_400_000),
  EXTERNAL_REQUEST_TIMEOUT_MS: optionalNumber(10_000, 1, 120_000),
  EXTERNAL_RETRY_LIMIT: optionalNumber(2, 0, 5),
  SHUTDOWN_TIMEOUT_MS: optionalNumber(10_000, 1, 120_000),
  TRUST_PROXY: booleanString,
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
  corsOrigins: string[];
  storageProvider: string;
  storageBucket?: string;
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

  if (parsed.STORAGE_PROVIDER !== "none" && !parsed.STORAGE_BUCKET) {
    configurationIssues.push(
      "STORAGE_BUCKET is required when STORAGE_PROVIDER is configured",
    );
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
    corsOrigins,
    storageProvider: parsed.STORAGE_PROVIDER,
    storageBucket: parsed.STORAGE_BUCKET,
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
