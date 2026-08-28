export type MetricLabels = Readonly<Record<string, string>>;

interface MetricSample {
  labels: MetricLabels;
  value: number;
}

const metricNames = {
  requests: "http_requests_total",
  duration: "http_request_duration_ms",
  durationCount: "http_request_duration_ms_count",
  errors: "http_errors_total",
  rateLimitRejections: "rate_limit_rejections_total",
  dependencyErrors: "dependency_errors_total",
} as const;

function labelKey(labels: MetricLabels): string {
  return Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join("\u001f");
}

function escapeLabel(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n");
}

function formatLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (entries.length === 0) return "";
  return `{${entries.map(([name, value]) => `${name}="${escapeLabel(value)}"`).join(",")}}`;
}

export class MetricsRegistry {
  private readonly samples = new Map<string, Map<string, MetricSample>>();

  increment(name: string, labels: MetricLabels = {}, value = 1): void {
    this.update(name, labels, (current) => current + value);
  }

  observe(name: string, labels: MetricLabels, value: number): void {
    this.increment(name, labels, value);
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    const labels = { method, route, status: String(statusCode) };
    this.increment(metricNames.requests, labels);
    this.observe(metricNames.duration, labels, durationMs);
    this.increment(metricNames.durationCount, labels);
    if (statusCode >= 400) this.increment(metricNames.errors, labels);
  }

  recordRateLimitRejection(route: string, method: string): void {
    this.increment(metricNames.rateLimitRejections, {
      method,
      route,
      limiter: "request",
    });
  }

  recordDependencyError(dependency: string, operation = "unknown"): void {
    this.increment(metricNames.dependencyErrors, { dependency, operation });
  }

  toPrometheus(): string {
    const lines = [
      "# TYPE http_requests_total counter",
      "# TYPE http_request_duration_ms gauge",
      "# TYPE http_request_duration_ms_count counter",
      "# TYPE http_errors_total counter",
      "# TYPE rate_limit_rejections_total counter",
      "# TYPE dependency_errors_total counter",
    ];

    for (const [name, samples] of this.samples) {
      for (const sample of samples.values()) {
        lines.push(`${name}${formatLabels(sample.labels)} ${sample.value}`);
      }
    }

    return `${lines.join("\n")}\n`;
  }

  private update(
    name: string,
    labels: MetricLabels,
    update: (value: number) => number,
  ): void {
    let samples = this.samples.get(name);
    if (!samples) {
      samples = new Map();
      this.samples.set(name, samples);
    }

    const key = labelKey(labels);
    const current = samples.get(key);
    samples.set(key, { labels, value: update(current?.value ?? 0) });
  }
}

export const metricName = metricNames;

export function metricRoute(url: string | undefined): string {
  return url && url.startsWith("/") ? url : "unmatched";
}
