import { resolve } from "node:path";
import dotenv from "dotenv";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app/app.js";
import { installSignalHandlers } from "./app/shutdown.js";
import { loadConfig } from "./config/env.js";
import { createPrismaDatabase } from "./integrations/database/prisma-database.js";
import { PrismaAuthRepository } from "./modules/auth/auth.repository.js";
import { PrismaBusinessApiService } from "./modules/api/api.service.js";
import {
  InMemoryStorageObjectRepository,
  PrismaStorageObjectRepository,
} from "./modules/storage/storage.repository.js";
import {
  StorageService,
  createStorageProvider,
} from "./modules/storage/storage.service.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const config = loadConfig();
const database = createPrismaDatabase(config.databaseUrl);
const storageService = new StorageService(
  createStorageProvider(config),
  database
    ? new PrismaStorageObjectRepository(database.client)
    : new InMemoryStorageObjectRepository(),
  config,
);
const closeDatabase = async (): Promise<void> => {
  await database?.close();
};

let app: FastifyInstance;
try {
  app = await buildApp({
    config,
    authRepository: database
      ? new PrismaAuthRepository(database.client)
      : undefined,
    businessApiService: database
      ? new PrismaBusinessApiService(database.client, undefined, storageService)
      : undefined,
    storageService,
    readinessChecks: database
      ? [{ name: "database", check: () => database.ping() }]
      : [],
  });
} catch (error) {
  await closeDatabase();
  throw error;
}
database?.setLogger(app.log);
database?.setMetrics(app.metrics);
const removeSignalHandlers = installSignalHandlers(app, {
  timeoutMs: config.shutdownTimeoutMs,
  cleanup: closeDatabase,
  exit: (code) => process.exit(code),
});

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(
    {
      event: "server_started",
      service: "nutri-ai-api",
      environment: config.nodeEnv,
      port: config.port,
      apiVersion: "v1",
      databaseConfigured: Boolean(config.databaseUrl),
      storageProvider: config.storageProvider,
      aiProvider: config.aiProvider,
      nutritionProvider: config.nutritionProvider,
      rateLimitEnabled: config.rateLimitEnabled,
    },
    "server_started",
  );
} catch (error) {
  app.log.error(
    {
      event: "server_failed_to_start",
      errorType: error instanceof Error ? error.name : "unknown",
    },
    "server_failed_to_start",
  );
  removeSignalHandlers();
  await app.close();
  await closeDatabase();
  process.exitCode = 1;
}
