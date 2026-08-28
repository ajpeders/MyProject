import { apiFetch } from "./client";

export interface MailConfigResponse {
  mail_model: string;
  mail_preferences: string;
  available_models: string[];
  ai_config_id: string | null;
}

export function getMailConfig(): Promise<MailConfigResponse> {
  return apiFetch<MailConfigResponse>("/api/config/mail", { method: "GET" });
}

export function updateMailConfig(mailModel: string, mailPreferences = ""): Promise<MailConfigResponse> {
  return apiFetch<MailConfigResponse>("/api/config/mail", {
    method: "PUT",
    body: JSON.stringify({ mail_model: mailModel, mail_preferences: mailPreferences }),
  });
}

export function setMailAIConfig(aiConfigId: string | null): Promise<MailConfigResponse> {
  return apiFetch<MailConfigResponse>("/api/config/mail", {
    method: "PATCH",
    body: JSON.stringify({ ai_config_id: aiConfigId }),
  });
}
