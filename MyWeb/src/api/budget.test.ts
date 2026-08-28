import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  categorizeBudgetTransactions,
  getBudgetSummary,
  listBudgetAccounts,
  listBudgetTransactions,
} from "./budget";
import { sendChat } from "./chat";

vi.mock("./chat", () => ({
  sendChat: vi.fn(),
}));

const mockSendChat = vi.mocked(sendChat);

describe("budget API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendChat.mockResolvedValue([
      { type: "answer", content: "Balance: $12.00", agent: "budget" },
    ]);
  });

  it("requests budget summary through the stateless budget agent", async () => {
    const result = await getBudgetSummary("7");

    expect(mockSendChat).toHaveBeenCalledWith({
      prompt: "Budget: show the current summary totals and category breakdown for account ID 7.",
      confirm: false,
      session_id: "_stateless",
    });
    expect(result.content).toBe("Balance: $12.00");
    expect(result.agent).toBe("budget");
  });

  it("requests accounts", async () => {
    await listBudgetAccounts();

    expect(mockSendChat).toHaveBeenCalledWith({
      prompt: "Budget: list all accounts with balances and transaction counts.",
      confirm: false,
      session_id: "_stateless",
    });
  });

  it("requests transactions with filters", async () => {
    await listBudgetTransactions({
      accountId: "2",
      category: "Groceries",
      search: "market",
      limit: 10,
    });

    expect(mockSendChat).toHaveBeenCalledWith({
      prompt: "Budget: list transactions filtered by account ID 2, category Groceries, description search market, limit 10.",
      confirm: false,
      session_id: "_stateless",
    });
  });

  it("marks confirmed category changes in the prompt and request", async () => {
    await categorizeBudgetTransactions("42, 43", "Dining", true);

    expect(mockSendChat).toHaveBeenCalledWith({
      prompt: "Budget: Call categorize_transactions with confirmed=true. Categorize transaction IDs 42, 43 as Dining.",
      confirm: true,
      session_id: "_stateless",
    });
  });
});
