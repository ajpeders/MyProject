import { apiFetch, getApiKey } from "./client";

export interface SuggestedAction {
  type: string;
  title?: string;
  date?: string;
  time?: string;
}

export interface MailSummary {
  id?: string;
  index: number;
  from?: string;
  subject?: string;
  date?: string;
  recommendation?: string;
  importance?: number;
  recommendation_reason?: string;
  recommended_folder?: string;
  summary?: string;
  recommended_todo?: string;
  suggested_actions?: SuggestedAction[];
  account?: string;
  read?: boolean;
  folder?: string;
}

export interface MailPageResponse {
  emails: MailSummary[];
  page: number;
  total_pages: number;
  total_emails: number;
  content: string;
}

export interface AttachmentMeta {
  filename: string;
  content_type: string;
  size: number;
}

export interface MailReadResponse {
  index: number;
  from: string;
  subject: string;
  date: string;
  body: string;
  body_html?: string;
  account: string;
  uid?: string | number | null;
  recommendation?: string;
  summary?: string;
  recommended_todo?: string;
  attachments?: AttachmentMeta[];
}

export interface FetchMailRequest {
  account?: string;
  count?: number;
  unread_only?: boolean;
  preferences?: string;
  folder?: string;
}

export interface MoveMailResponse {
  message: string;
  folder: string;
}

export interface AnalyzeMailRequest {
  indices?: number[];
  preferences?: string;
}

export interface MailFeedbackRequest {
  index: number;
  verdict: "good" | "bad";
  text?: string;
}

export function getMailPage(page = 1): Promise<MailPageResponse> {
  const serverPage = Math.max(page - 1, 0);
  return apiFetch<MailPageResponse>(`/api/mail?page=${serverPage}`, { method: "GET" });
}

export function fetchMailOnly(request: FetchMailRequest = {}): Promise<MailPageResponse> {
  return apiFetch<MailPageResponse>("/api/mail/fetch-only", {
    method: "POST",
    body: JSON.stringify({
      account: request.account ?? "",
      count: request.count ?? 0,
      unread_only: request.unread_only ?? false,
      preferences: request.preferences ?? "",
      folder: request.folder ?? "",
    }),
  });
}

export function fetchMail(request: FetchMailRequest = {}): Promise<MailPageResponse> {
  return apiFetch<MailPageResponse>("/api/mail/fetch", {
    method: "POST",
    body: JSON.stringify({
      account: request.account ?? "",
      count: request.count ?? 0,
      unread_only: request.unread_only ?? false,
      preferences: request.preferences ?? "",
      folder: request.folder ?? "",
    }),
  });
}

export function readMail(index: number): Promise<MailReadResponse> {
  return apiFetch<MailReadResponse>(`/api/mail/${index}`, { method: "GET" });
}

export interface MailByDateResponse {
  emails: MailSummary[];
}

export function getMailByDateRange(start: string, end: string): Promise<MailByDateResponse> {
  return apiFetch<MailByDateResponse>(`/api/mail/by-date?start=${start}&end=${end}`, { method: "GET" });
}

export function devSeedMail(): Promise<MailPageResponse> {
  return apiFetch<MailPageResponse>("/api/mail/dev-seed", { method: "POST" });
}

export interface MailFoldersResponse {
  folders: string[];
}

export function getMailFolders(account?: string): Promise<MailFoldersResponse> {
  const params = account ? `?account=${encodeURIComponent(account)}` : "";
  return apiFetch<MailFoldersResponse>(`/api/mail/folders${params}`, { method: "GET" });
}

export function moveMail(indices: number[], folder: string): Promise<MoveMailResponse> {
  return apiFetch<MoveMailResponse>("/api/mail/move", {
    method: "POST",
    body: JSON.stringify({ indices, folder }),
  });
}

export function analyzeMail(request: AnalyzeMailRequest = {}): Promise<MailPageResponse> {
  return apiFetch<MailPageResponse>("/api/mail/analyze", {
    method: "POST",
    body: JSON.stringify({ indices: request.indices ?? [], preferences: request.preferences ?? "" }),
  });
}

export function submitMailFeedback(request: MailFeedbackRequest): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/api/mail/feedback", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export interface SearchMailRequest {
  text?: string;
  from_addr?: string;
  subject?: string;
  date_start?: string;
  date_end?: string;
  account?: string;
  folder?: string;
}

export interface SearchMailResponse {
  emails: MailSummary[];
}

export function createFolder(name: string, account?: string): Promise<{ folder: string; created: boolean }> {
  return apiFetch("/api/mail/folders/create", {
    method: "POST",
    body: JSON.stringify({ name, account: account ?? "" }),
  });
}

export function searchMail(request: SearchMailRequest): Promise<SearchMailResponse> {
  return apiFetch<SearchMailResponse>("/api/mail/search", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function downloadAttachment(emailIndex: number, attachmentIndex: number): Promise<void> {
  const headers: Record<string, string> = {};
  const apiKey = getApiKey();
  if (apiKey) headers["X-API-Key"] = apiKey;
  const token = localStorage.getItem("myagent.token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const sessionId = localStorage.getItem("myagent.session_id");
  if (sessionId) headers["X-Session-ID"] = sessionId;
  const userId = localStorage.getItem("myagent.user_id");
  if (userId) headers["X-User-ID"] = userId;

  const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  const url = base ? `${base}/api/mail/${emailIndex}/attachment/${attachmentIndex}` : `/api/mail/${emailIndex}/attachment/${attachmentIndex}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "attachment";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}
