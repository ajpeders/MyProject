import { apiFetch } from "./client";

export type AIProvider = "ollama" | "openai" | "anthropic" | "openai_compatible";

export interface AIConfig {
  id: string;
  name: string;
  provider: AIProvider;
  host: string;
  model: string;
  has_api_key: boolean;
  created_at: number;
  updated_at: number;
}

export interface AIConfigCreate {
  name: string;
  provider: AIProvider;
  host?: string;
  api_key?: string;
  model: string;
}

export interface AIConfigUpdate {
  name?: string;
  host?: string;
  api_key?: string;
  model?: string;
}

export function listAIConfigs(): Promise<AIConfig[]> {
  return apiFetch<AIConfig[]>("/api/ai-configs", { method: "GET" });
}

export function createAIConfig(body: AIConfigCreate): Promise<AIConfig> {
  return apiFetch<AIConfig>("/api/ai-configs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAIConfig(id: string, body: AIConfigUpdate): Promise<AIConfig> {
  return apiFetch<AIConfig>(`/api/ai-configs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteAIConfig(id: string): Promise<void> {
  return apiFetch<void>(`/api/ai-configs/${id}`, { method: "DELETE" });
}
