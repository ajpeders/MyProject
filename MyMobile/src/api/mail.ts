import { apiFetch } from "./client";

export interface MailSummary {
  index: number;
  from?: string;
  subject?: string;
  date?: string;
  summary?: string;
  recommendation?: string;
  recommended_folder?: string;
  recommended_todo?: string;
  account?: string;
  read?: boolean;
}

export interface MailPageResponse {
  emails: MailSummary[];
  page: number;
  total_pages: number;
  total_emails: number;
  content: string;
}

export interface FetchMailRequest {
  account?: string;
  count?: number;
  fetch_all?: boolean;
  incremental?: boolean;
  folder?: string;
  unread_only?: boolean;
  preferences?: string;
}

export function getMailPage(page = 1): Promise<MailPageResponse> {
  return apiFetch<MailPageResponse>(`/api/mail?page=${Math.max(page - 1, 0)}`);
}

export function fetchMail(req: FetchMailRequest = {}): Promise<MailPageResponse> {
  return apiFetch<MailPageResponse>("/api/mail/fetch", {
    method: "POST",
    body: JSON.stringify({
      account: req.account ?? "",
      count: req.count ?? 100,
      unread_only: req.unread_only ?? false,
      preferences: req.preferences ?? "",
      folder: req.folder ?? "",
      fetch_all: req.fetch_all ?? false,
      incremental: req.incremental ?? true,
    }),
  });
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
}

export function readMail(index: number): Promise<MailReadResponse> {
  return apiFetch<MailReadResponse>(`/api/mail/${index}`);
}

export function moveMail(indices: number[], folder: string): Promise<{ message: string; folder: string }> {
  return apiFetch("/api/mail/move", {
    method: "POST",
    body: JSON.stringify({ indices, folder }),
  });
}
