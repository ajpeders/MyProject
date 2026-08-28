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

function joinBudgetContent(responses: ActionResponse[]): string {
  return responses
    .map((response) => response.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

async function askBudget(prompt: string, confirm = false): Promise<BudgetAnswer> {
  const raw = await sendChat({ prompt, confirm, session_id: "_stateless" });
  return {
    content: joinBudgetContent(raw),
    agent: raw.find((response) => response.agent)?.agent ?? null,
    pendingConfirm: raw.find((response) => response.pending_confirm)?.pending_confirm ?? null,
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
  const parts = [
    query.accountId?.trim() ? `account ID ${query.accountId.trim()}` : "",
    query.category?.trim() ? `category ${query.category.trim()}` : "",
    query.search?.trim() ? `description search ${query.search.trim()}` : "",
    `limit ${query.limit ?? 25}`,
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
