import { resolve } from "node:path";
import dotenv from "dotenv";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app/app.js";
import { installSignalHandlers } from "./app/shutdown.js";
import { loadConfig } from "./config/env.js";
import { createPrismaDatabase } from "./integrations/database/prisma-database.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const config = loadConfig();
const database = createPrismaDatabase(config.databaseUrl);
const closeDatabase = async (): Promise<void> => {
  await database?.close();
};

let app: FastifyInstance;
try {
  app = await buildApp({
    config,
    readinessChecks: database
      ? [{ name: "database", check: () => database.ping() }]
      : [],
  });
} catch (error) {
  await closeDatabase();
  throw error;
}
database?.setLogger(app.log);
const removeSignalHandlers = installSignalHandlers(app, {
  timeoutMs: config.shutdownTimeoutMs,
  cleanup: closeDatabase,
  exit: (code) => process.exit(code),
});

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(
    { event: "server_started", service: "nutri-ai-api", port: config.port },
    "server_started",
  );
} catch (error) {
  app.log.error(
    { event: "server_failed_to_start", err: error },
    "server_failed_to_start",
  );
  removeSignalHandlers();
  await app.close();
  await closeDatabase();
  process.exitCode = 1;
}
