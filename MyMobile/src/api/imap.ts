import { apiFetch } from "./client";

export interface ImapAccount {
  id: string;
  name: string;
  server: string;
  username: string;
  created_at: string;
}

export function listImapAccounts(): Promise<ImapAccount[]> {
  return apiFetch<ImapAccount[]>("/api/imap");
}

export function addImapAccount(name: string, server: string, username: string, password: string): Promise<ImapAccount> {
  return apiFetch<ImapAccount>("/api/imap", {
    method: "POST",
    body: JSON.stringify({ name, server, username, password }),
  });
}

export function deleteImapAccount(id: string): Promise<void> {
  return apiFetch(`/api/imap/${id}`, { method: "DELETE" });
}
