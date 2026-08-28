/**
 * Tiny HTTP client mirroring MyWeb's shape so the API surface is identical:
 * - Reads JWT + session_id from SecureStore on every request.
 * - Throws ApiError(status, message) so callers can branch on auth errors.
 *
 * The base URL is read from app.json `expo.extra.apiBaseUrl`. Override at
 * dev time by editing app.json or by setting EXPO_PUBLIC_API_BASE_URL.
 */
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const EXTRA = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };
const BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  EXTRA.apiBaseUrl ??
  ""
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const STORAGE = {
  token: "myagent.token",
  sessionId: "myagent.session_id",
  account: "myagent.account",
} as const;

export async function clearStoredAuth(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE.token),
    SecureStore.deleteItemAsync(STORAGE.sessionId),
    SecureStore.deleteItemAsync(STORAGE.account),
  ]);
}

export function isAuthError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 401;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await SecureStore.getItemAsync(STORAGE.token);
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const sessionId = await SecureStore.getItemAsync(STORAGE.sessionId);
  if (sessionId) headers["X-Session-ID"] = sessionId;
  return headers;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const merged = { ...headers, ...(init.headers as Record<string, string> | undefined) };
  const url = BASE_URL ? `${BASE_URL}${path}` : path;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: merged });
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? err.message : "Network error");
  }
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) {
      await clearStoredAuth();
    }
    try {
      const parsed = JSON.parse(body) as { detail?: string; error?: string };
      throw new ApiError(res.status, parsed.detail || parsed.error || res.statusText);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(res.status, body || res.statusText);
    }
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
