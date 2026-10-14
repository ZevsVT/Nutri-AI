import { z } from "zod";

export function validGtin(value: string): boolean {
  if (!/^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$/.test(value)) return false;
  let sum = 0;
  for (let i = value.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight)
    sum += Number(value[i]) * weight;
  return (10 - (sum % 10)) % 10 === Number(value.at(-1));
}

// Validate before trimming so an oversized whitespace-padded payload is rejected.
export const gtinSchema = z
  .string()
  .max(64)
  .trim()
  .refine(validGtin, "Invalid GTIN length, digits, or check digit");

export function normalizeBarcode(input: string): string {
  return gtinSchema.parse(input).padStart(14, "0");
}
