import { apiFetch } from "./client";

export interface MemoryItem {
  memory_id: string;
  content: string;
  score?: number | null;
  created_at?: number | null;
}

export function listMemories(query = "", topK = 5): Promise<MemoryItem[]> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
    params.set("top_k", String(topK));
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<MemoryItem[]>(`/api/memory${suffix}`, { method: "GET" });
}

export function addMemory(content: string): Promise<MemoryItem> {
  return apiFetch<MemoryItem>("/api/memory", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function deleteMemory(memoryId: string): Promise<unknown> {
  return apiFetch(`/api/memory/${encodeURIComponent(memoryId)}`, { method: "DELETE" });
}
