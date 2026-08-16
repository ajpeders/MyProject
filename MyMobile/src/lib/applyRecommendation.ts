/**
 * Apply the AI's recommended action for a single email.
 *
 * Mirrors the rules used by the MyWeb apply flow so behavior is identical
 * across both apps:
 *   - delete  → move to Trash (never expunge, never permanent)
 *   - archive → move to recommended_folder, falls back to "Archive"
 *   - other   → no-op (caller should open the email in a detail view)
 *
 * Returns the folder name we moved to, or null if no move was performed.
 */
import { MailSummary, moveMail } from "@/api/mail";

export async function applyRecommendation(email: MailSummary): Promise<string | null> {
  const rec = (email.recommendation || "").trim().toLowerCase();
  if (rec === "delete") {
    await moveMail([email.index], "Trash");
    return "Trash";
  }
  if (rec === "archive") {
    const folder = email.recommended_folder || "Archive";
    await moveMail([email.index], folder);
    return folder;
  }
  return null;
}

export function isActionable(email: MailSummary): boolean {
  const rec = (email.recommendation || "").trim().toLowerCase();
  return rec === "delete" || rec === "archive";
}
