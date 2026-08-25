import type { FastifyBaseLogger } from "fastify";

export interface ReadinessCheck {
  name: string;
  check: () => Promise<void>;
}

export interface ReadinessResult {
  ready: boolean;
  failedChecks: string[];
}

export class ReadinessService {
  private initialized = false;

  constructor(
    private readonly checks: readonly ReadinessCheck[] = [],
    private readonly logger?: FastifyBaseLogger,
  ) {}

  markInitialized(): void {
    this.initialized = true;
  }

  async check(): Promise<ReadinessResult> {
    const failures: string[] = [];

    if (!this.initialized) {
      failures.push("application");
    }

    const results = await Promise.all(
      this.checks.map(async (dependency) => {
        try {
          await dependency.check();
          return null;
        } catch (error) {
          this.logger?.warn(
            {
              event: "readiness_check_failed",
              dependency: dependency.name,
              errorType: error instanceof Error ? error.name : "unknown",
            },
            "readiness_check_failed",
          );
          return dependency.name;
        }
      }),
    );

    for (const result of results) {
      if (result !== null) {
        failures.push(result);
      }
    }

    return { ready: failures.length === 0, failedChecks: failures };
  }
}
