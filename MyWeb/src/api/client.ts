const API_KEY = import.meta.env.VITE_API_KEY ?? "";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const API_KEY_STORAGE = "myagent.api_key";
const TOKEN_STORAGE = "myagent.token";

function apiUrl(path: string): string {
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || API_KEY;
}

export function setApiKey(apiKey: string): void {
  const trimmed = apiKey.trim();
  if (trimmed) {
    localStorage.setItem(API_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(API_KEY_STORAGE);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const apiKey = getApiKey();
  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }
  const session_id = localStorage.getItem("myagent.session_id");
  if (session_id) {
    headers.set("X-Session-ID", session_id);
  }
  const token = localStorage.getItem(TOKEN_STORAGE);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...options, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network request failed";
    throw new ApiError(0, `Could not reach API server: ${message}`);
  }

  if (!res.ok) {
    if (res.status === 401 && !path.includes("/account/login") && !path.includes("/account/register")) {
      localStorage.removeItem("myagent.user_id");
      localStorage.removeItem("myagent.session_id");
      localStorage.removeItem("myagent.token");
      localStorage.removeItem("myagent.account");
      localStorage.removeItem("myagent.email");
      window.location.href = "/login";
      throw new ApiError(401, "Session expired");
    }
    const body = await res.text();
    try {
      const parsed = JSON.parse(body) as { detail?: unknown; error?: unknown };
      const detail = parsed.detail ?? parsed.error;
      if (typeof detail === "string") {
        throw new ApiError(res.status, detail);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
    }
    throw new ApiError(res.status, body || res.statusText);
  }

  return res.json();
}
