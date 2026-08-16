import { apiFetch } from "./client";

export interface MailConfigResponse {
  mail_model: string;
  mail_preferences: string;
  available_models: string[];
  ai_config_id: string | null;
}

export function getMailConfig(): Promise<MailConfigResponse> {
  return apiFetch<MailConfigResponse>("/api/config/mail");
}

export function setMailAIConfig(ai_config_id: string | null): Promise<MailConfigResponse> {
  return apiFetch<MailConfigResponse>("/api/config/mail", {
    method: "PATCH",
    body: JSON.stringify({ ai_config_id }),
  });
}
