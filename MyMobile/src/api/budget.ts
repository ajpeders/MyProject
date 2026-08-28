/**
 * Mirror of MyWeb/src/api/budget.ts. Budget panels are chat-driven — every
 * call goes through /api/chat with a Budget-domain prompt and the
 * BudgetAgent on the backend interprets, executes, and returns a
 * markdown-formatted response which we render as-is.
 */
import { sendChat, type ActionResponse } from "./chat";

export interface BudgetAnswer {
  content: string;
  agent: string | null;
  pendingConfirm: string | null;
  raw: ActionResponse[];
}

export interface BudgetTransactionQuery {
  accountId?: string;
  category?: string;
  search?: string;
  limit?: number;
}

export function normalizeBudgetLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return 25;
  return Math.min(Math.max(Math.trunc(limit ?? 25), 1), 200);
}

function joinBudgetContent(responses: ActionResponse[]): string {
  return responses
    .map((r) => r.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

async function askBudget(prompt: string, confirm = false): Promise<BudgetAnswer> {
  const raw = await sendChat({ prompt, confirm, session_id: "_stateless" });
  return {
    content: joinBudgetContent(raw),
    agent: raw.find((r) => r.agent)?.agent ?? null,
    pendingConfirm: raw.find((r) => r.pending_confirm)?.pending_confirm ?? null,
    raw,
  };
}

export function getBudgetSummary(accountId = ""): Promise<BudgetAnswer> {
  const scope = accountId.trim() ? ` for account ID ${accountId.trim()}` : "";
  return askBudget(`Budget: show the current summary totals and category breakdown${scope}.`);
}

export function listBudgetAccounts(): Promise<BudgetAnswer> {
  return askBudget("Budget: list all accounts with balances and transaction counts.");
}

export function listBudgetTransactions(query: BudgetTransactionQuery): Promise<BudgetAnswer> {
  const limit = normalizeBudgetLimit(query.limit);
  const parts = [
    query.accountId?.trim() ? `account ID ${query.accountId.trim()}` : "",
    query.category?.trim() ? `category ${query.category.trim()}` : "",
    query.search?.trim() ? `description search ${query.search.trim()}` : "",
    `limit ${limit}`,
  ].filter(Boolean);
  return askBudget(`Budget: list transactions filtered by ${parts.join(", ")}.`);
}

export function categorizeBudgetTransactions(
  ids: string,
  category: string,
  confirmed: boolean,
): Promise<BudgetAnswer> {
  const mode = confirmed
    ? "Call categorize_transactions with confirmed=true"
    : "Preview only; do not mutate yet";
  return askBudget(
    `Budget: ${mode}. Categorize transaction IDs ${ids.trim()} as ${category.trim()}.`,
    confirmed,
  );
}
