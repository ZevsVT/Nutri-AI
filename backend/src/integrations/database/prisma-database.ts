import { PrismaClient } from "@prisma/client";
import type { FastifyBaseLogger } from "fastify";

interface PrismaGlobalState {
  client?: PrismaClient;
  databaseUrl?: string;
}

const prismaGlobal = globalThis as typeof globalThis & {
  __nutriAiPrisma?: PrismaGlobalState;
};

export interface DatabaseClient {
  ping(): Promise<void>;
  close(): Promise<void>;
  setLogger(logger: FastifyBaseLogger): void;
}

export interface PrismaClientOptions {
  reuseGlobal?: boolean;
}

/**
 * Reuse one client during development reloads, while allowing integration
 * tests to create isolated clients with `reuseGlobal: false`.
 */
export function createPrismaClient(
  databaseUrl: string,
  options: PrismaClientOptions = {},
): PrismaClient {
  const reuseGlobal = options.reuseGlobal ?? true;
  const existing = prismaGlobal.__nutriAiPrisma;

  if (reuseGlobal && existing?.client && existing.databaseUrl === databaseUrl) {
    return existing.client;
  }

  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  if (reuseGlobal) {
    prismaGlobal.__nutriAiPrisma = { client, databaseUrl };
  }

  return client;
}

export class PrismaDatabase implements DatabaseClient {
  private logger?: FastifyBaseLogger;

  constructor(
    public readonly client: PrismaClient,
    logger?: FastifyBaseLogger,
  ) {
    this.logger = logger;
  }

  async ping(): Promise<void> {
    try {
      await this.client.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logConnectionFailure(error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.client.$disconnect();
    if (prismaGlobal.__nutriAiPrisma?.client === this.client) {
      delete prismaGlobal.__nutriAiPrisma;
    }
  }

  setLogger(logger: FastifyBaseLogger): void {
    this.logger = logger;
  }

  private logConnectionFailure(error: unknown): void {
    this.logger?.error(
      {
        event: "database_error",
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "database_error",
    );
  }
}

export function createPrismaDatabase(
  databaseUrl: string | undefined,
  logger?: FastifyBaseLogger,
): PrismaDatabase | null {
  if (!databaseUrl) {
    return null;
  }

  return new PrismaDatabase(createPrismaClient(databaseUrl), logger);
}
