import { apiFetch } from "./client";
import { getSessionId } from "./auth";
import type { MailSummary } from "./mail";

export interface ChatRequest {
  prompt: string;
  model?: string;
  session_id?: string | null;
  confirm?: boolean;
}

export interface ActionResponse {
  type: string;
  content: string;
  agent?: string | null;
  pending_confirm?: string | null;
  emails?: MailSummary[] | null;
  page?: number | null;
  total_pages?: number | null;
  total_emails?: number | null;
}

export function sendChat(request: ChatRequest): Promise<ActionResponse[]> {
  const session_id = request.session_id ?? getSessionId() ?? undefined;
  return apiFetch<ActionResponse[]>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ ...request, session_id }),
  });
}
