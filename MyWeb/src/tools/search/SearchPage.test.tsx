import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SearchPage from "./SearchPage";
import * as search from "../../api/search";
import * as searchConfig from "../../api/searchConfig";

vi.mock("../../api/search", () => ({
  searchWeb: vi.fn(),
  browseSearchResult: vi.fn(),
}));

vi.mock("../../api/searchConfig", () => ({
  getSearchConfig: vi.fn(),
  updateSearchConfig: vi.fn(),
}));

describe("SearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(search, "searchWeb").mockResolvedValue({
      answer: "Use the structured search endpoint.",
      results: [
        {
          title: "Backend search contract",
          url: "https://example.com/search-contract",
          snippet: "POST /api/search returns answers and results.",
        },
      ],
    });
    vi.spyOn(search, "browseSearchResult").mockResolvedValue({
      summary: "The page explains the search contract.",
    });
    vi.spyOn(searchConfig, "getSearchConfig").mockResolvedValue({
      search_provider: "duckduckgo",
      available_providers: [
        { id: "duckduckgo", label: "DuckDuckGo" },
        { id: "searx", label: "Searx" },
      ],
    });
  });

  it("loads the current search engine", async () => {
    render(<SearchPage />);

    expect(await screen.findByLabelText("Search Engine")).toHaveValue("duckduckgo");
    expect(searchConfig.getSearchConfig).toHaveBeenCalled();
  });

  it("saves the selected search engine", async () => {
    vi.spyOn(searchConfig, "updateSearchConfig").mockResolvedValue({
      search_provider: "searx",
      available_providers: [
        { id: "duckduckgo", label: "DuckDuckGo" },
        { id: "searx", label: "Searx" },
      ],
    });

    render(<SearchPage />);

    fireEvent.change(await screen.findByLabelText("Search Engine"), { target: { value: "searx" } });
    fireEvent.click(screen.getByRole("button", { name: "Save engine" }));

    await waitFor(() => {
      expect(searchConfig.updateSearchConfig).toHaveBeenCalledWith("searx");
      expect(screen.getByText("Search engine saved: Searx")).toBeInTheDocument();
    });
  });

  it("shows a quick answer and search results in llm mode", async () => {
    render(<SearchPage />);

    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "search contract" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(search.searchWeb).toHaveBeenCalledWith("search contract");
    });
    expect(await screen.findByText("Use the structured search endpoint.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Backend search contract" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.com/search-contract" })).toHaveAttribute(
      "href",
      "https://example.com/search-contract",
    );
    expect(screen.getByText("POST /api/search returns answers and results.")).toBeInTheDocument();
  });

  it("shows only search results in normal mode", async () => {
    render(<SearchPage />);

    fireEvent.click(screen.getByRole("tab", { name: "Normal Search" }));
    fireEvent.change(screen.getByLabelText("Query"), { target: { value: "search contract" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(search.searchWeb).toHaveBeenCalledWith("search contract");
    });
    expect(screen.queryByText("Use the structured search endpoint.")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Backend search contract" })).toBeInTheDocument();
    expect(screen.getByText("POST /api/search returns answers and results.")).toBeInTheDocument();
  });

  it("browses a selected result URL", async () => {
    render(<SearchPage />);

    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "search contract" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Backend search contract");

    fireEvent.click(screen.getByRole("button", { name: "Backend search contract" }));

    await waitFor(() => {
      expect(search.browseSearchResult).toHaveBeenCalledWith("https://example.com/search-contract");
    });
    expect(await screen.findByText("The page explains the search contract.")).toBeInTheDocument();
  });

  it("clears llm answer and results when switching search type", async () => {
    render(<SearchPage />);

    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "search contract" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Use the structured search endpoint.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Backend search contract" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Normal Search" }));

    expect(screen.queryByText("Use the structured search endpoint.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Backend search contract" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Query")).toBeInTheDocument();
  });
});
