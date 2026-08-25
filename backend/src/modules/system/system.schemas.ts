import { z } from "zod";

export const apiMetadataQuerySchema = z.object({
  format: z.enum(["full", "compact"]).default("full"),
});

export const echoBodySchema = z.object({
  message: z.string().trim().min(1).max(1_000),
});

export type ApiMetadataQuery = z.infer<typeof apiMetadataQuerySchema>;
export type EchoBody = z.infer<typeof echoBodySchema>;
