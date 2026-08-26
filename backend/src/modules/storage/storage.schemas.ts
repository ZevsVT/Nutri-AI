import { z } from "zod";

export const storageObjectParamsSchema = z
  .object({ id: z.string().uuid() })
  .strict();
