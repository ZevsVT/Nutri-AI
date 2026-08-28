import type { FastifyInstance } from "fastify";

export interface ShutdownOptions {
  timeoutMs: number;
  cleanup?: () => Promise<void>;
  exit?: (code: number) => void;
}

export function createShutdownHandler(
  app: FastifyInstance,
  options: ShutdownOptions,
) {
  let shuttingDown = false;

  return async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info({ event: "shutdown_started", signal }, "shutdown_started");

    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        (async () => {
          await app.close();
          await options.cleanup?.();
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Graceful shutdown timed out")),
            options.timeoutMs,
          );
        }),
      ]);
      app.log.info(
        { event: "shutdown_completed", signal },
        "shutdown_completed",
      );
      options.exit?.(0);
    } catch (error) {
      app.log.error(
        {
          event: "shutdown_failed",
          signal,
          errorType: error instanceof Error ? error.name : "unknown",
        },
        "shutdown_failed",
      );
      options.exit?.(1);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  };
}

export function installSignalHandlers(
  app: FastifyInstance,
  options: ShutdownOptions,
): () => void {
  const shutdown = createShutdownHandler(app, options);
  const onSignal = (signal: string) => {
    void shutdown(signal);
  };

  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);

  return () => {
    process.removeListener("SIGTERM", onSignal);
    process.removeListener("SIGINT", onSignal);
  };
}
