import * as SecureStore from "expo-secure-store";
import { STORAGE, apiFetch, clearStoredAuth } from "./client";

export interface LoginResponse {
  user_id: string;
  session_id: string;
  token: string;
  account: string;
}

export async function loginAccount(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/account/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerAccount(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/account/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function storeAuthResponse(r: LoginResponse) {
  await SecureStore.setItemAsync(STORAGE.token, r.token);
  await SecureStore.setItemAsync(STORAGE.sessionId, r.session_id);
  await SecureStore.setItemAsync(STORAGE.account, r.account);
}

export async function logout() {
  await clearStoredAuth();
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await SecureStore.getItemAsync(STORAGE.token));
}

export interface DemoLoginStatus { enabled: boolean }

export function getDemoLoginStatus(): Promise<DemoLoginStatus> {
  return apiFetch<DemoLoginStatus>("/api/account/demo-login");
}

export function demoLogin(): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/account/demo-login", { method: "POST" });
}
