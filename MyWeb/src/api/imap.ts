import { apiFetch } from "./client";

export interface ImapAccount {
  id: string;
  name: string;
  server: string;
  username: string;
  // password is always encrypted, never returned plaintext
  created_at: string;
}

export async function listImapAccounts(): Promise<ImapAccount[]> {
  return apiFetch<ImapAccount[]>("/api/imap", { method: "GET" });
}

export async function addImapAccount(
  name: string,
  server: string,
  username: string,
  imapPassword: string,
  port = 993
): Promise<ImapAccount> {
  return apiFetch<ImapAccount>("/api/imap", {
    method: "POST",
    body: JSON.stringify({
      name,
      server,
      port,
      username,
      imap_password: imapPassword,
    }),
  });
}

export async function deleteImapAccount(id: string): Promise<void> {
  await apiFetch(`/api/imap/${id}`, { method: "DELETE" });
}
