import type { FastifyBaseLogger } from "fastify";
import type { MetricsRegistry } from "../observability/metrics.js";

export interface ReadinessCheck {
  name: string;
  check: () => Promise<void>;
}

export interface ReadinessResult {
  ready: boolean;
  failedChecks: string[];
  dependencies: Record<string, "ok" | "unavailable">;
}

export class ReadinessService {
  private initialized = false;

  constructor(
    private readonly checks: readonly ReadinessCheck[] = [],
    private readonly logger?: FastifyBaseLogger,
    private readonly metrics?: MetricsRegistry,
  ) {}

  markInitialized(): void {
    this.initialized = true;
  }

  async check(): Promise<ReadinessResult> {
    const failures: string[] = [];
    const dependencies: Record<string, "ok" | "unavailable"> = {};

    if (!this.initialized) {
      failures.push("application");
      dependencies.application = "unavailable";
    } else {
      dependencies.application = "ok";
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
          this.metrics?.recordDependencyError(dependency.name, "readiness");
          dependencies[dependency.name] = "unavailable";
          return dependency.name;
        } finally {
          if (!(dependency.name in dependencies))
            dependencies[dependency.name] = "ok";
        }
      }),
    );

    for (const result of results) {
      if (result !== null) {
        failures.push(result);
      }
    }

    return {
      ready: failures.length === 0,
      failedChecks: failures,
      dependencies,
    };
  }
}
