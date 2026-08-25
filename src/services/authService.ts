export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  permissions: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init.headers },
  });
  const payload = (await response.json()) as ApiResponse<T> & {
    error?: { message?: string };
  };
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message ?? "Authentication request failed");
  }
  return payload.data;
}

export function register(input: {
  email: string;
  password: string;
  name: string;
}) {
  return request<{ user: AuthUser }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }) {
  return request<{ user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout() {
  return request<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
}

export function getCurrentUser() {
  return request<{ user: AuthUser }>("/auth/me");
}

export function requestPasswordReset(email: string) {
  return request<{ message: string }>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string) {
  return request<{ passwordReset: boolean }>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}
