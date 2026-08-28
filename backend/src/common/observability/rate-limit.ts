import type { AppConfig } from "../../config/env.js";

export type RateLimitCategory = "authentication" | "expensive" | "upload";

export function rateLimitMax(config: AppConfig, url: string): number {
  const configuredMax =
    {
      authentication: config.rateLimitAuthMax,
      expensive: config.rateLimitExpensiveMax,
      upload: config.rateLimitUploadMax,
    }[rateLimitCategory(url) as RateLimitCategory] ?? config.rateLimitMax;
  return Math.min(config.rateLimitMax, configuredMax);
}

export function routePath(url: string): string {
  return url.split("?", 1)[0] ?? url;
}

export function rateLimitCategory(url: string): RateLimitCategory | "general" {
  const path = routePath(url);
  if (path.startsWith("/api/v1/auth/")) return "authentication";
  if (
    path === "/api/v1/meal-analysis" ||
    path === "/api/v1/ai/chat" ||
    path === "/api/v1/barcode/scan"
  )
    return "expensive";
  if (path === "/api/v1/storage/uploads") return "upload";
  return "general";
}
