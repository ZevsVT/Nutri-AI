import type { UserRole } from "./request-context.js";

export const reviewPermissions = {
  ADMIN: ["food-reviews:read", "food-reviews:write", "food-reviews:decide"],
  NUTRITION_EDITOR: ["food-reviews:read", "food-reviews:write"],
  MODERATOR: ["food-reviews:read"],
  USER: [],
  SUPPORT: [],
} satisfies Record<UserRole, readonly string[]>;

export function permissionsForRole(role: UserRole): string[] {
  return [...reviewPermissions[role]];
}
