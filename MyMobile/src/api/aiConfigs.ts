/**
 * Mirror of MyWeb/src/api/aiConfigs.ts so the two clients share one wire
 * shape. The backend lives at /api/ai-configs; api_key is encrypted at
 * rest by MyAgent using the user's enc_key (carried in the JWT) and is
 * never echoed back — list responses include `has_api_key: boolean` only.
 */
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

export interface CreateAIConfigBody {
  name: string;
  provider: AIProvider;
  host?: string;
  api_key?: string;
  model: string;
}

export interface UpdateAIConfigBody {
  name?: string;
  host?: string;
  api_key?: string;
  model?: string;
}

export interface OllamaModelsResponse {
  models: string[];
}

export function listAIConfigs(): Promise<AIConfig[]> {
  return apiFetch<AIConfig[]>("/api/ai-configs");
}

export function listOllamaModels(host = ""): Promise<OllamaModelsResponse> {
  const query = host.trim() ? `?host=${encodeURIComponent(host.trim())}` : "";
  return apiFetch<OllamaModelsResponse>(`/api/ai-configs/models/ollama${query}`);
}

export function createAIConfig(body: CreateAIConfigBody): Promise<AIConfig> {
  return apiFetch<AIConfig>("/api/ai-configs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAIConfig(id: string, body: UpdateAIConfigBody): Promise<AIConfig> {
  return apiFetch<AIConfig>(`/api/ai-configs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteAIConfig(id: string): Promise<void> {
  return apiFetch(`/api/ai-configs/${id}`, { method: "DELETE" });
}
