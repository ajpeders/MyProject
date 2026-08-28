/**
 * Wire-shape tests for the mobile Budget client. The Budget panels are
 * chat-driven: each helper formats a domain-specific English prompt and
 * posts it through /api/chat. We assert the exact prompt strings + that
 * the helpers stitch multi-action responses together correctly. The same
 * prompts are used by MyWeb so keeping the wire shape pinned here protects
 * both clients from drifting.
 */
jest.mock("expo-constants", () => ({ expoConfig: { extra: { apiBaseUrl: "https://api.test" } } }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => "fake-jwt"),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import {
  categorizeBudgetTransactions,
  getBudgetSummary,
  listBudgetAccounts,
  listBudgetTransactions,
  normalizeBudgetLimit,
} from "../src/api/budget";

const fetchMock = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

function actionsResponse(actions: { content: string; agent?: string; pending_confirm?: string }[]): Response {
  const body = actions.map((a) => ({ type: "answer", ...a }));
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

beforeEach(() => fetchMock.mockReset());

function lastSentPrompt(): string {
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  const body = JSON.parse((init as { body: string }).body);
  return body.prompt as string;
}

describe("budget client → /api/chat prompts", () => {
  it("normalizes transaction limits into the supported range", () => {
    expect(normalizeBudgetLimit(undefined)).toBe(25);
    expect(normalizeBudgetLimit(Number.NaN)).toBe(25);
    expect(normalizeBudgetLimit(-5)).toBe(1);
    expect(normalizeBudgetLimit(20.9)).toBe(20);
    expect(normalizeBudgetLimit(5000)).toBe(200);
  });

  it("getBudgetSummary asks for totals + categories with no scope when accountId is blank", async () => {
    fetchMock.mockResolvedValueOnce(actionsResponse([{ content: "Total: $0" }]));
    await getBudgetSummary("");
    expect(lastSentPrompt()).toBe(
      "Budget: show the current summary totals and category breakdown.",
    );
  });

  it("getBudgetSummary scopes by accountId when provided", async () => {
    fetchMock.mockResolvedValueOnce(actionsResponse([{ content: "Total: $0" }]));
    await getBudgetSummary("acct-7");
    expect(lastSentPrompt()).toBe(
      "Budget: show the current summary totals and category breakdown for account ID acct-7.",
    );
  });

  it("listBudgetAccounts asks for accounts with balances and counts", async () => {
    fetchMock.mockResolvedValueOnce(actionsResponse([{ content: "Checking $123" }]));
    await listBudgetAccounts();
    expect(lastSentPrompt()).toBe(
      "Budget: list all accounts with balances and transaction counts.",
    );
  });

  it("listBudgetTransactions composes the filter clauses from non-blank fields", async () => {
    fetchMock.mockResolvedValueOnce(actionsResponse([{ content: "..." }]));
    await listBudgetTransactions({ accountId: "1", category: "groceries", search: "whole foods", limit: 50 });
    expect(lastSentPrompt()).toBe(
      "Budget: list transactions filtered by account ID 1, category groceries, description search whole foods, limit 50.",
    );
  });

  it("listBudgetTransactions defaults limit to 25 when omitted", async () => {
    fetchMock.mockResolvedValueOnce(actionsResponse([{ content: "..." }]));
    await listBudgetTransactions({ category: "rent" });
    expect(lastSentPrompt()).toBe(
      "Budget: list transactions filtered by category rent, limit 25.",
    );
  });

  it("listBudgetTransactions clamps extreme limits before prompting", async () => {
    fetchMock.mockResolvedValueOnce(actionsResponse([{ content: "..." }]));
    await listBudgetTransactions({ search: "coffee", limit: 5000 });
    expect(lastSentPrompt()).toBe(
      "Budget: list transactions filtered by description search coffee, limit 200.",
    );
  });

  it("categorizeBudgetTransactions defaults to preview-mode (confirm=false)", async () => {
    fetchMock.mockResolvedValueOnce(actionsResponse([{ content: "Would categorize 3" }]));
    await categorizeBudgetTransactions("1,2,3", "Groceries", false);
    const prompt = lastSentPrompt();
    expect(prompt).toMatch(/^Budget: Preview only; do not mutate yet\./);
    expect(prompt).toContain("transaction IDs 1,2,3 as Groceries");

    // confirm flag is also threaded through so the backend can require it
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);
    expect(body.confirm).toBe(false);
  });

  it("categorizeBudgetTransactions switches verb when confirmed=true", async () => {
    fetchMock.mockResolvedValueOnce(actionsResponse([{ content: "Categorized 3" }]));
    await categorizeBudgetTransactions("4,5", "Rent", true);
    const prompt = lastSentPrompt();
    expect(prompt).toMatch(/^Budget: Call categorize_transactions with confirmed=true\./);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as { body: string }).body).confirm).toBe(true);
  });

  it("joins multi-action responses with a blank line and surfaces agent + pendingConfirm", async () => {
    fetchMock.mockResolvedValueOnce(actionsResponse([
      { content: "First chunk", agent: "BudgetAgent" },
      { content: "Second chunk", pending_confirm: "confirm-1" },
    ]));
    const r = await listBudgetAccounts();
    expect(r.content).toBe("First chunk\n\nSecond chunk");
    expect(r.agent).toBe("BudgetAgent");
    expect(r.pendingConfirm).toBe("confirm-1");
  });
});
