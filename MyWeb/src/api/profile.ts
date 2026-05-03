import { apiFetch } from "./client";

export interface UserProfile {
  interests: string[];
  model_config: Record<string, string>;
}

export function getProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/profile", { method: "GET" });
}

export function updateInterests(interests: string[]): Promise<void> {
  return apiFetch<void>("/api/profile/interests", {
    method: "PUT",
    body: JSON.stringify({ interests }),
  });
}

export function updateModelConfig(config: Record<string, string>): Promise<void> {
  return apiFetch<void>("/api/profile/models", {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}

export function logSignal(signal_type: string, topic: string, source: string = ""): Promise<void> {
  return apiFetch<void>("/api/profile/signal", {
    method: "POST",
    body: JSON.stringify({ signal_type, topic, source }),
  });
}
