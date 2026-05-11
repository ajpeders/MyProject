import { ApiError, apiFetch } from "./client";

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResponse {
  transcript_id: string;
  text: string;
  language: string | null;
  duration_seconds: number | null;
  segments: TranscriptionSegment[];
  model: string;
  source: "web" | "shortcut";
  captured_at: number;
}

export interface HistoryEntry {
  transcript_id: string;
  source: "web" | "shortcut";
  text: string;
  language: string | null;
  duration_seconds: number | null;
  segments: TranscriptionSegment[];
  model: string;
  captured_at: number;
}

export type VoiceTool =
  | "save_note"
  | "recall_notes"
  | "create_event"
  | "list_events"
  | "read_mail"
  | "search_web"
  | "answer";

export interface VoiceAgentResponse {
  transcript_id: string;
  transcript: string;
  tool: VoiceTool;
  args: Record<string, unknown>;
  result: unknown;
  reply: string;
  error: string | null;
  captured_at: number;
}

const API_KEY_STORAGE = "myagent.api_key";
const TOKEN_STORAGE = "myagent.token";
const SESSION_STORAGE = "myagent.session_id";

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function transcribe(
  blob: Blob,
  opts: { filename?: string; language?: string } = {},
): Promise<TranscriptionResponse> {
  const params = new URLSearchParams();
  if (opts.filename) params.set("filename", opts.filename);
  if (opts.language) params.set("language", opts.language);
  const query = params.toString();
  const path = `/api/whisper/transcribe${query ? `?${query}` : ""}`;

  const headers = new Headers();
  headers.set("Content-Type", blob.type || "application/octet-stream");
  const apiKey = localStorage.getItem(API_KEY_STORAGE) ?? import.meta.env.VITE_API_KEY ?? "";
  if (apiKey) headers.set("X-API-Key", apiKey);
  const sessionId = localStorage.getItem(SESSION_STORAGE);
  if (sessionId) headers.set("X-Session-ID", sessionId);
  const token = localStorage.getItem(TOKEN_STORAGE);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(apiUrl(path), { method: "POST", body: blob, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network request failed";
    throw new ApiError(0, `Could not reach API server: ${message}`);
  }

  if (!res.ok) {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body) as { detail?: unknown };
      if (typeof parsed.detail === "string") {
        throw new ApiError(res.status, parsed.detail);
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }
    throw new ApiError(res.status, body || res.statusText);
  }

  return res.json();
}

export async function voiceAgent(
  blob: Blob,
  opts: { filename?: string } = {},
): Promise<VoiceAgentResponse> {
  const params = new URLSearchParams();
  if (opts.filename) params.set("filename", opts.filename);
  const query = params.toString();
  const path = `/api/whisper/agent${query ? `?${query}` : ""}`;

  const headers = new Headers();
  headers.set("Content-Type", blob.type || "application/octet-stream");
  const apiKey = localStorage.getItem(API_KEY_STORAGE) ?? import.meta.env.VITE_API_KEY ?? "";
  if (apiKey) headers.set("X-API-Key", apiKey);
  const sessionId = localStorage.getItem(SESSION_STORAGE);
  if (sessionId) headers.set("X-Session-ID", sessionId);
  const token = localStorage.getItem(TOKEN_STORAGE);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(apiUrl(path), { method: "POST", body: blob, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network request failed";
    throw new ApiError(0, `Could not reach API server: ${message}`);
  }

  if (!res.ok) {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body) as { detail?: unknown };
      if (typeof parsed.detail === "string") {
        throw new ApiError(res.status, parsed.detail);
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }
    throw new ApiError(res.status, body || res.statusText);
  }

  return res.json();
}


export async function listTranscripts(limit = 50): Promise<HistoryEntry[]> {
  const data = await apiFetch<{ transcripts: HistoryEntry[] }>(
    `/api/whisper/transcripts?limit=${limit}`,
  );
  return data.transcripts;
}

export async function deleteTranscript(transcriptId: string): Promise<void> {
  await apiFetch(`/api/whisper/transcripts/${encodeURIComponent(transcriptId)}`, {
    method: "DELETE",
  });
}
