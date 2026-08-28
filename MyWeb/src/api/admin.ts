import { apiFetch } from "./client";

export interface AdminStats {
  user_count?: number;
  users?: number;
  session_count?: number;
  sessions?: number;
  db_size?: number;
  db_size_bytes?: number;
  [key: string]: unknown;
}

export interface AdminUser {
  user_id?: string;
  id?: string;
  email?: string;
  created_at?: string | number;
  updated_at?: string | number;
  [key: string]: unknown;
}

export interface AdminSession {
  session_id?: string;
  id?: string;
  user_id?: string;
  email?: string;
  has_mail?: boolean;
  has_mail_engine?: boolean;
  created_at?: string | number;
  updated_at?: string | number;
  [key: string]: unknown;
}

export function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/api/admin/stats");
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const data = await apiFetch<AdminUser[] | { users?: AdminUser[] }>("/api/admin/users");
  return Array.isArray(data) ? data : data.users ?? [];
}

export async function listAdminSessions(): Promise<AdminSession[]> {
  const data = await apiFetch<AdminSession[] | { sessions?: AdminSession[] }>("/api/admin/sessions");
  return Array.isArray(data) ? data : data.sessions ?? [];
}

export function deleteAdminUser(userId: string): Promise<unknown> {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export function deleteAdminSession(sessionId: string): Promise<unknown> {
  return apiFetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}
