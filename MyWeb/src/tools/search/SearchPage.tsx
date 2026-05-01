import { type FormEvent, useEffect, useState } from "react";
import Markdown from "react-markdown";
import {
  browseSearchResult,
  searchWeb,
  type SearchResult,
} from "../../api/search";
import { getSearchConfig, updateSearchConfig, type SearchProviderOption } from "../../api/searchConfig";

type SearchMode = "llm" | "normal";

const SEARCH_MODES: Record<
  SearchMode,
  {
    label: string;
    heading: string;
    description: string;
    fieldLabel: string;
    placeholder: string;
    showsAnswer: boolean;
  }
> = {
  llm: {
    label: "LLM Search",
    heading: "LLM Search",
    description: "Get a synthesized answer first, then inspect the underlying sources.",
    fieldLabel: "Question",
    placeholder: "Ask the web a question...",
    showsAnswer: true,
  },
  normal: {
    label: "Normal Search",
    heading: "Normal Search",
    description: "Skip the synthesized answer and work directly from the result list.",
    fieldLabel: "Query",
    placeholder: "Search the web...",
    showsAnswer: false,
  },
};

export default function SearchPage() {
  const [mode, setMode] = useState<SearchMode>("llm");
  const [searchProvider, setSearchProvider] = useState("");
  const [availableProviders, setAvailableProviders] = useState<SearchProviderOption[]>([]);
  const [providerNotice, setProviderNotice] = useState("");
  const [providerSaving, setProviderSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState("");
  const modeConfig = SEARCH_MODES[mode];

  useEffect(() => {
    let cancelled = false;
    getSearchConfig()
      .then((data) => {
        if (cancelled) return;
        setSearchProvider(data.search_provider);
        setAvailableProviders(data.available_providers);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load search settings");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setSelected(null);
    setSummary("");
    setError("");

    try {
      const data = await searchWeb(trimmed, !modeConfig.showsAnswer);
      setAnswer(modeConfig.showsAnswer ? data.answer || "" : "");
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleBrowse(result: SearchResult) {
    if (summaryLoading) return;
    setSelected(result);
    setSummaryLoading(true);
    setSummary("");

    try {
      const data = await browseSearchResult(result.url);
      setSummary(data.summary || data.answer || data.content || "No summary available.");
    } catch (err) {
      setSummary(err instanceof Error ? err.message : "Failed to load summary.");
    } finally {
      setSummaryLoading(false);
    }
  }

  function handleModeChange(nextMode: SearchMode) {
    setMode(nextMode);
    setResults([]);
    setAnswer("");
    setSelected(null);
    setSummary("");
    setSummaryLoading(false);
    setError("");
  }

  async function handleProviderSave(event: FormEvent) {
    event.preventDefault();
    if (!searchProvider) return;

    setProviderSaving(true);
    setProviderNotice("");
    setError("");

    try {
      const data = await updateSearchConfig(searchProvider);
      setSearchProvider(data.search_provider);
      setAvailableProviders(data.available_providers);
      const selected = data.available_providers.find((provider) => provider.id === data.search_provider);
      setProviderNotice(`Search engine saved: ${selected?.label ?? data.search_provider}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save search settings");
    } finally {
      setProviderSaving(false);
    }
  }

  return (
    <section className="search-page">
      <header className="search-header">
        <h1>Web Search</h1>
        <p>Switch between an answer-first LLM search and a plain web results view.</p>
      </header>

      <div className="search-mode-switch" role="tablist" aria-label="Search mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "llm"}
          className={mode === "llm" ? "search-mode-tab is-active" : "search-mode-tab"}
          onClick={() => handleModeChange("llm")}
        >
          {SEARCH_MODES.llm.label}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "normal"}
          className={mode === "normal" ? "search-mode-tab is-active" : "search-mode-tab"}
          onClick={() => handleModeChange("normal")}
        >
          {SEARCH_MODES.normal.label}
        </button>
      </div>

      <section className="search-mode-panel">
        <h2>{modeConfig.heading}</h2>
        <p>{modeConfig.description}</p>

        <form className="search-provider-form" onSubmit={handleProviderSave}>
          <label htmlFor="search-provider">Search Engine</label>
          <div className="search-row">
            <select
              id="search-provider"
              value={searchProvider}
              onChange={(event) => {
                setSearchProvider(event.target.value);
                setProviderNotice("");
              }}
              disabled={providerSaving}
            >
              <option value="" disabled>
                Select a search engine
              </option>
              {availableProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
            <button type="submit" disabled={providerSaving || !searchProvider}>
              {providerSaving ? "Saving..." : "Save engine"}
            </button>
          </div>
          {providerNotice ? <p className="search-notice">{providerNotice}</p> : null}
        </form>

        <form className="search-form" onSubmit={handleSearch}>
          <label htmlFor="search-question">{modeConfig.fieldLabel}</label>
          <div className="search-row">
            <input
              id="search-question"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={modeConfig.placeholder}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !query.trim()}>
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>
      </section>

      {error ? <p className="search-error">{error}</p> : null}

      {modeConfig.showsAnswer && answer ? (
        <section className="search-answer">
          <h2>Answer</h2>
          <Markdown>{answer}</Markdown>
        </section>
      ) : null}

      {results.length > 0 ? (
        <section className="search-results">
          <h2>Results</h2>
          <ol>
            {results.map((result, index) => (
              <li key={`${result.url}-${index}`}>
                <div className="search-result-main">
                  <button
                    type="button"
                    className="search-result-title"
                    onClick={() => void handleBrowse(result)}
                    disabled={summaryLoading && selected?.url === result.url}
                  >
                    {result.title || result.url}
                  </button>
                </div>
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  {result.url}
                </a>
                {result.snippet ? <span>{result.snippet}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {selected ? (
        <section className="search-browse">
          <h2>Summary: {selected.title || selected.url}</h2>
          {summaryLoading ? <p>Loading summary...</p> : <Markdown>{summary}</Markdown>}
          <a href={selected.url} target="_blank" rel="noopener noreferrer">
            Open original
          </a>
        </section>
      ) : null}
    </section>
  );
}
