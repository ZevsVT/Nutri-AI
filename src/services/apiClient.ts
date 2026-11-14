const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string };
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string") headers.set("content-type", "application/json");
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 204) return { success: true, data: undefined as T };
  const payload: ApiEnvelope<T> | null = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new ApiError(
      response.status,
      payload?.error?.code,
      response.status === 401
        ? "Sign in to continue."
        : payload?.error?.message ?? "Could not complete the request. Try again.",
    );
  }
  return payload;
}
