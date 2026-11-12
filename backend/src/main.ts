import { resolve } from "node:path";
import dotenv from "dotenv";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app/app.js";
import { installSignalHandlers } from "./app/shutdown.js";
import { loadConfig } from "./config/env.js";
import { createPrismaDatabase } from "./integrations/database/prisma-database.js";
import { OpenAiMealVision } from "./integrations/ai/openai-vision.js";
import { ImageAnalysisWorker } from "./modules/meals/image-analysis.worker.js";
import { PrismaAuthRepository } from "./modules/auth/auth.repository.js";
import { PrismaBarcodeProvider } from "./modules/foods/barcode.service.js";
import { PrismaBusinessApiService } from "./modules/api/api.service.js";
import { ReviewRepository } from "./modules/food-reviews/review.repository.js";
import { ReviewService } from "./modules/food-reviews/review.service.js";
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
const vision =
  config.aiProvider === "openai" && config.aiApiKey
    ? new OpenAiMealVision(
        config.aiVisionModel,
        config.aiApiKey,
        config.externalRequestTimeoutMs,
      )
    : undefined;
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
    reviewService: database
      ? new ReviewService(new ReviewRepository(database.client))
      : undefined,
    businessApiService: database
      ? new PrismaBusinessApiService(
          database.client,
          new PrismaBarcodeProvider(database.client),
          storageService,
          vision,
        )
      : undefined,
    storageService,
    readinessChecks: database
      ? [{ name: "database", check: () => database.ping() }]
      : [],
  });
  if (vision && database) {
    const worker = new ImageAnalysisWorker(
      database.client,
      storageService,
      vision,
      app.log,
    );
    app.addHook("onReady", async () => worker.start());
    app.addHook("onClose", () => worker.stop());
  }
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
