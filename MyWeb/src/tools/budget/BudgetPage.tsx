import { type FormEvent, useEffect, useState } from "react";
import Markdown from "react-markdown";
import {
  categorizeBudgetTransactions,
  getBudgetSummary,
  listBudgetAccounts,
  listBudgetTransactions,
} from "../../api/budget";

type BudgetSection = "summary" | "accounts" | "transactions" | "categorize";

interface PanelState {
  content: string;
  loading: boolean;
  error: string;
}

const emptyPanel: PanelState = {
  content: "",
  loading: false,
  error: "",
};

const loadingPanel: PanelState = {
  content: "",
  loading: true,
  error: "",
};

function Panel({
  title,
  state,
  empty,
}: {
  title: string;
  state: PanelState;
  empty: string;
}) {
  return (
    <section className="budget-panel" aria-label={title}>
      <h2>{title}</h2>
      {state.loading ? <p className="budget-muted">Loading...</p> : null}
      {state.error ? <p className="budget-error" role="alert">{state.error}</p> : null}
      {!state.loading && !state.error && state.content ? (
        <div className="budget-answer">
          <Markdown>{state.content}</Markdown>
        </div>
      ) : null}
      {!state.loading && !state.error && !state.content ? (
        <p className="budget-muted">{empty}</p>
      ) : null}
    </section>
  );
}

export default function BudgetPage() {
  const [activeSection, setActiveSection] = useState<BudgetSection>("summary");
  // These two load on mount, so they start in the loading state rather than
  // being flipped into it by the effect below (which would cost a second render
  // and trips react-hooks/set-state-in-effect).
  const [summary, setSummary] = useState<PanelState>(loadingPanel);
  const [accounts, setAccounts] = useState<PanelState>(loadingPanel);
  const [transactions, setTransactions] = useState<PanelState>(emptyPanel);
  const [categoryResult, setCategoryResult] = useState<PanelState>(emptyPanel);
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(25);
  const [categoryIds, setCategoryIds] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [previewReady, setPreviewReady] = useState(false);

  // fetch* resolve to the next panel state without touching React state, so the
  // mount effect can await them; load* are the form-triggered variants that also
  // flip the panel into loading first.
  async function fetchSummary(nextAccountId: string): Promise<PanelState> {
    try {
      const result = await getBudgetSummary(nextAccountId);
      return { content: result.content, loading: false, error: "" };
    } catch (err) {
      return {
        content: "",
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load budget summary",
      };
    }
  }

  async function fetchAccounts(): Promise<PanelState> {
    try {
      const result = await listBudgetAccounts();
      return { content: result.content, loading: false, error: "" };
    } catch (err) {
      return {
        content: "",
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load budget accounts",
      };
    }
  }

  async function loadSummary(nextAccountId = accountId) {
    setSummary(loadingPanel);
    setSummary(await fetchSummary(nextAccountId));
  }

  async function loadAccounts() {
    setAccounts(loadingPanel);
    setAccounts(await fetchAccounts());
  }

  useEffect(() => {
    let cancelled = false;
    // Both panels already start in the loading state, so nothing is set here
    // before the awaits. Initial load only; forms own subsequent refreshes.
    void (async () => {
      const [nextSummary, nextAccounts] = await Promise.all([
        fetchSummary(""),
        fetchAccounts(),
      ]);
      if (cancelled) return;
      setSummary(nextSummary);
      setAccounts(nextAccounts);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSummarySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveSection("summary");
    await loadSummary(accountId);
  }

  async function handleTransactionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveSection("transactions");
    setTransactions({ content: "", loading: true, error: "" });
    try {
      const result = await listBudgetTransactions({
        accountId,
        category,
        search,
        limit,
      });
      setTransactions({ content: result.content, loading: false, error: "" });
    } catch (err) {
      setTransactions({
        content: "",
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load transactions",
      });
    }
  }

  async function handleCategorize(confirmed: boolean) {
    if (!categoryIds.trim() || !newCategory.trim()) return;
    setActiveSection("categorize");
    setCategoryResult({ content: "", loading: true, error: "" });
    try {
      const result = await categorizeBudgetTransactions(categoryIds, newCategory, confirmed);
      setCategoryResult({ content: result.content, loading: false, error: "" });
      setPreviewReady(!confirmed);
      if (confirmed) {
        void loadSummary(accountId);
      }
    } catch (err) {
      setCategoryResult({
        content: "",
        loading: false,
        error: err instanceof Error ? err.message : "Failed to categorize transactions",
      });
    }
  }

  const categorizationDisabled =
    categoryResult.loading || !categoryIds.trim() || !newCategory.trim();

  return (
    <section className="budget-page">
      <header className="budget-header">
        <h1>Budget</h1>
        <p>Local accounts, spending, transactions, and category cleanup.</p>
      </header>

      <div className="budget-tabs" role="tablist" aria-label="Budget sections">
        {[
          ["summary", "Summary"],
          ["accounts", "Accounts"],
          ["transactions", "Transactions"],
          ["categorize", "Categorize"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeSection === key}
            className={activeSection === key ? "budget-tab is-active" : "budget-tab"}
            onClick={() => setActiveSection(key as BudgetSection)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="budget-controls" aria-label="Budget controls">
        <form className="budget-form budget-form--summary" onSubmit={handleSummarySubmit}>
          <label htmlFor="budget-account-id">Account ID</label>
          <div className="budget-row">
            <input
              id="budget-account-id"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              placeholder="All accounts"
              inputMode="numeric"
            />
            <button type="submit" disabled={summary.loading}>
              {summary.loading ? "Refreshing..." : "Refresh summary"}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSection("accounts");
                void loadAccounts();
              }}
              disabled={accounts.loading}
            >
              {accounts.loading ? "Loading..." : "Refresh accounts"}
            </button>
          </div>
        </form>

        <form className="budget-form" onSubmit={handleTransactionSubmit}>
          <label htmlFor="budget-search">Transactions</label>
          <div className="budget-grid">
            <input
              id="budget-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Description"
            />
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Category"
              aria-label="Category filter"
            />
            <input
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              type="number"
              min="1"
              max="200"
              aria-label="Transaction limit"
            />
            <button type="submit" disabled={transactions.loading}>
              {transactions.loading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        <form
          className="budget-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCategorize(false);
          }}
        >
          <label htmlFor="budget-category-ids">Categorize</label>
          <div className="budget-grid budget-grid--categorize">
            <input
              id="budget-category-ids"
              value={categoryIds}
              onChange={(event) => {
                setCategoryIds(event.target.value);
                setPreviewReady(false);
              }}
              placeholder="Transaction IDs"
            />
            <input
              value={newCategory}
              onChange={(event) => {
                setNewCategory(event.target.value);
                setPreviewReady(false);
              }}
              placeholder="New category"
              aria-label="New category"
            />
            <button type="submit" disabled={categorizationDisabled}>
              Preview
            </button>
            <button
              type="button"
              className="budget-apply"
              onClick={() => void handleCategorize(true)}
              disabled={categorizationDisabled || !previewReady}
            >
              Apply
            </button>
          </div>
        </form>
      </section>

      <div className="budget-panels">
        {activeSection === "summary" ? (
          <Panel title="Summary" state={summary} empty="No summary loaded." />
        ) : null}
        {activeSection === "accounts" ? (
          <Panel title="Accounts" state={accounts} empty="No accounts loaded." />
        ) : null}
        {activeSection === "transactions" ? (
          <Panel title="Transactions" state={transactions} empty="No transactions loaded." />
        ) : null}
        {activeSection === "categorize" ? (
          <Panel title="Categorization" state={categoryResult} empty="No category preview yet." />
        ) : null}
      </div>
    </section>
  );
}
