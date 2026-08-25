import type { FastifyBaseLogger } from "fastify";
import { Pool } from "pg";

export interface DatabaseClient {
  ping(): Promise<void>;
  close(): Promise<void>;
  setLogger(logger: FastifyBaseLogger): void;
}

export class PostgresDatabase implements DatabaseClient {
  private logger?: FastifyBaseLogger;

  constructor(
    private readonly pool: Pool,
    logger?: FastifyBaseLogger,
  ) {
    this.logger = logger;
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  setLogger(logger: FastifyBaseLogger): void {
    this.logger = logger;
  }

  logConnectionFailure(error: unknown): void {
    this.logger?.error(
      {
        event: "database_error",
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "database_error",
    );
  }
}

export function createPostgresDatabase(
  databaseUrl: string | undefined,
  logger?: FastifyBaseLogger,
): PostgresDatabase | null {
  if (!databaseUrl) {
    return null;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "nutri-ai-api",
  });

  const database = new PostgresDatabase(pool, logger);
  pool.on("error", (error) => database.logConnectionFailure(error));
  return database;
}
