import { apiFetch } from "./client";

export interface LoginResponse {
  user_id: string;
  session_id: string;
  token: string;
  account: string;
}

export function storeAuthResponse(response: LoginResponse, email?: string) {
  localStorage.setItem("myagent.user_id", response.user_id);
  localStorage.setItem("myagent.session_id", response.session_id);
  localStorage.setItem("myagent.token", response.token);
  localStorage.setItem("myagent.account", response.account);
  if (email) {
    localStorage.setItem("myagent.email", email);
  }
}

export async function loginAccount(
  email: string,
  password: string
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/account/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerAccount(
  email: string,
  password: string
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/account/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem("myagent.token"));
}

export function getSessionId(): string | null {
  return localStorage.getItem("myagent.session_id");
}

export function getToken(): string | null {
  return localStorage.getItem("myagent.token");
}

export function isAdmin(): boolean {
  return localStorage.getItem("myagent.account") === "admin";
}

export function logout() {
  localStorage.removeItem("myagent.user_id");
  localStorage.removeItem("myagent.session_id");
  localStorage.removeItem("myagent.token");
  localStorage.removeItem("myagent.account");
  localStorage.removeItem("myagent.email");
}
