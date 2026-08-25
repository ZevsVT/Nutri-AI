import type { FastifyRequest } from "fastify";
import type { AppConfig } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";
import type { RequestUser, UserRole } from "../types/request-context.js";
import type { AuthService } from "../../modules/auth/auth.service.js";
import { readSessionCookie } from "../../modules/auth/auth.cookies.js";
import {
  logAuthenticationFailure,
  logAuthorizationFailure,
} from "../logging/events.js";

const roles = new Set<UserRole>([
  "USER",
  "ADMIN",
  "MODERATOR",
  "NUTRITION_EDITOR",
  "SUPPORT",
]);

function developmentUser(request: FastifyRequest): RequestUser | undefined {
  const id = request.headers["x-development-user-id"];
  if (typeof id !== "string" || id.trim().length === 0 || id.length > 128) {
    return undefined;
  }

  const roleHeader = request.headers["x-development-user-role"];
  const role =
    typeof roleHeader === "string" && roles.has(roleHeader as UserRole)
      ? (roleHeader as UserRole)
      : "USER";
  const permissionsHeader = request.headers["x-development-user-permissions"];
  const permissions =
    typeof permissionsHeader === "string"
      ? permissionsHeader
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  return { id, role, permissions };
}

export function createAuthenticate(
  config: AppConfig,
  authService?: AuthService,
) {
  return async function authenticate(request: FastifyRequest): Promise<void> {
    if (config.authDevMode) {
      const user = developmentUser(request);
      if (user) {
        request.user = user;
        return;
      }
    }

    const token = readSessionCookie(request.headers.cookie);
    if (token && authService) {
      const resolved = await authService.resolveSession(token);
      if (resolved) {
        request.authUser = resolved.user;
        request.user = {
          id: resolved.user.id,
          role: resolved.user.role,
          permissions: resolved.user.permissions,
        };
        return;
      }
    }

    logAuthenticationFailure(request.log, {
      requestId: request.id,
      method: request.method,
      route: request.url.split("?")[0] ?? request.url,
    });
    throw new AppError("AUTHENTICATION_ERROR", "Authentication is required");
  };
}

export function createAuthorize(
  config: AppConfig,
  authServiceOrPermission?: AuthService | string,
  ...permissions: string[]
) {
  const authService =
    typeof authServiceOrPermission === "string"
      ? undefined
      : authServiceOrPermission;
  const requiredPermissions =
    typeof authServiceOrPermission === "string"
      ? [authServiceOrPermission, ...permissions]
      : permissions;
  const authenticate = createAuthenticate(config, authService);

  return async function authorize(request: FastifyRequest): Promise<void> {
    if (!request.user) {
      await authenticate(request);
    }

    const user = request.user;
    if (!user) {
      throw new AppError("AUTHENTICATION_ERROR", "Authentication is required");
    }

    if (
      user.role === "ADMIN" ||
      requiredPermissions.every((permission) =>
        user.permissions.includes(permission),
      )
    ) {
      return;
    }

    logAuthorizationFailure(request.log, {
      requestId: request.id,
      method: request.method,
      route: request.url.split("?")[0] ?? request.url,
    });
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "You do not have permission to access this resource",
    );
  };
}
