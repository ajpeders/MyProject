import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BudgetPage from "./BudgetPage";
import {
  categorizeBudgetTransactions,
  getBudgetSummary,
  listBudgetAccounts,
  listBudgetTransactions,
} from "../../api/budget";

vi.mock("../../api/budget", () => ({
  getBudgetSummary: vi.fn(),
  listBudgetAccounts: vi.fn(),
  listBudgetTransactions: vi.fn(),
  categorizeBudgetTransactions: vi.fn(),
}));

const mockSummary = vi.mocked(getBudgetSummary);
const mockAccounts = vi.mocked(listBudgetAccounts);
const mockTransactions = vi.mocked(listBudgetTransactions);
const mockCategorize = vi.mocked(categorizeBudgetTransactions);

function budgetAnswer(content: string) {
  return {
    content,
    agent: "budget",
    pendingConfirm: null,
    raw: [{ type: "answer", content, agent: "budget" }],
  };
}

describe("BudgetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSummary.mockResolvedValue(budgetAnswer("Balance: $120.00"));
    mockAccounts.mockResolvedValue(budgetAnswer("1. Checking: $120.00, 4 txns"));
    mockTransactions.mockResolvedValue(budgetAnswer("42. 2026-06-27 | -$12.00 | Food | Market"));
    mockCategorize.mockResolvedValue(budgetAnswer("Preview: categorize transaction(s) 42 as 'Food'."));
  });

  it("loads summary and accounts on mount", async () => {
    render(<BudgetPage />);

    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();
    await waitFor(() => expect(mockSummary).toHaveBeenCalledWith(""));
    expect(mockAccounts).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Balance: \$120.00/)).toBeInTheDocument();
  });

  it("searches transactions with filters", async () => {
    const user = userEvent.setup();
    render(<BudgetPage />);

    await user.click(screen.getByRole("tab", { name: "Transactions" }));
    await user.type(screen.getByPlaceholderText("Description"), "market");
    await user.type(screen.getByLabelText("Category filter"), "Food");
    await user.clear(screen.getByLabelText("Transaction limit"));
    await user.type(screen.getByLabelText("Transaction limit"), "10");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() =>
      expect(mockTransactions).toHaveBeenCalledWith({
        accountId: "",
        category: "Food",
        search: "market",
        limit: 10,
      }),
    );
    expect(await screen.findByText(/Market/)).toBeInTheDocument();
  });

  it("requires a preview before applying a category", async () => {
    const user = userEvent.setup();
    render(<BudgetPage />);

    await user.click(screen.getByRole("tab", { name: "Categorize" }));
    const apply = screen.getByRole("button", { name: "Apply" });
    expect(apply).toBeDisabled();

    await user.type(screen.getByLabelText("Categorize"), "42");
    await user.type(screen.getByLabelText("New category"), "Food");
    expect(apply).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(mockCategorize).toHaveBeenCalledWith("42", "Food", false));
    expect(await screen.findByText(/Preview: categorize/)).toBeInTheDocument();
    expect(apply).toBeEnabled();

    mockCategorize.mockResolvedValueOnce(budgetAnswer("Categorized 1 transaction(s) as 'Food'."));
    await user.click(apply);
    await waitFor(() => expect(mockCategorize).toHaveBeenLastCalledWith("42", "Food", true));
    expect(await screen.findByText(/Categorized 1 transaction/)).toBeInTheDocument();
  });
});
