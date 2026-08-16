import * as SecureStore from "expo-secure-store";
import { STORAGE, apiFetch } from "./client";

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
}

export async function sendChat(request: ChatRequest): Promise<ActionResponse[]> {
  let session_id = request.session_id;
  if (session_id === undefined) {
    session_id = (await SecureStore.getItemAsync(STORAGE.sessionId)) ?? undefined;
  }
  return apiFetch<ActionResponse[]>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ ...request, session_id }),
  });
}
