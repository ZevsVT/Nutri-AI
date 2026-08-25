import { SERVICE_NAME, SERVICE_VERSION } from "../../config/constants.js";
import type { AppConfig } from "../../config/env.js";
import type { ReadinessService } from "../../common/lifecycle/readiness.js";

export class SystemService {
  constructor(
    private readonly config: AppConfig,
    private readonly readiness: ReadinessService,
  ) {}

  getHealth() {
    return {
      status: "ok" as const,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
    };
  }

  async getReadiness() {
    const result = await this.readiness.check();
    return {
      status: result.ready ? ("ready" as const) : ("not_ready" as const),
      result,
    };
  }

  getApiMetadata(format: "full" | "compact") {
    const data = {
      name: "Nutri-AI API",
      version: "v1",
      status: "running" as const,
    };
    return format === "compact"
      ? { name: data.name, version: data.version }
      : data;
  }

  echo(message: string) {
    return { message, environment: this.config.nodeEnv };
  }
}
