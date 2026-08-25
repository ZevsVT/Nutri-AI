import { z } from "zod";

const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(12).max(128);
const nameSchema = z.string().trim().min(1).max(120);

export const registerSchema = z
  .object({ email: emailSchema, password: passwordSchema, name: nameSchema })
  .strict();

export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();

export const passwordResetRequestSchema = z
  .object({ email: emailSchema })
  .strict();

export const passwordResetConfirmSchema = z
  .object({ token: z.string().min(32).max(256), password: passwordSchema })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;
export type PasswordResetConfirmInput = z.infer<
  typeof passwordResetConfirmSchema
>;
