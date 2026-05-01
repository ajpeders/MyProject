import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewsPage from "./NewsPage";
import * as newsApi from "../../api/news";

vi.mock("../../api/news", () => ({
  getSources: vi.fn(),
  getArticles: vi.fn(),
  refreshFeeds: vi.fn(),
}));

const mockSources: newsApi.NewsSource[] = [
  { id: "s1", user_id: "u1", label: "Ars Technica", topic: "Tech", feed_url: "https://arstechnica.com/rss", enabled: true, created_at: 1 },
  { id: "s2", user_id: "u1", label: "BBC World", topic: "World", feed_url: "https://bbc.com/rss", enabled: true, created_at: 2 },
];

const mockArticles: newsApi.NewsArticle[] = [
  { id: "a1", source_id: "s1", source_label: "Ars Technica", title: "Breaking headline", topic: "Tech", url: "https://arstechnica.com/1", published_at: "2026-04-28T10:00:00Z", summary: "Tech story summary" },
  { id: "a2", source_id: "s1", source_label: "Ars Technica", title: "Another tech story", topic: "Tech", url: "https://arstechnica.com/2", published_at: "2026-04-28T09:00:00Z", summary: null },
];

describe("NewsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(newsApi, "getSources").mockResolvedValue({ sources: mockSources });
    vi.spyOn(newsApi, "getArticles").mockResolvedValue({ articles: mockArticles });
  });

  it("renders articles from the API", async () => {
    render(<NewsPage />);

    expect(await screen.findByText("Breaking headline")).toBeInTheDocument();
    expect(screen.getByText("Tech story summary")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches topics and fetches new articles", async () => {
    const worldArticles = [
      { id: "a3", source_id: "s2", source_label: "The Guardian", title: "World event", topic: "World", url: "https://guardian.com/1", published_at: "2026-04-28T08:00:00Z", summary: "World summary" },
    ];

    render(<NewsPage />);
    await screen.findByText("Breaking headline");

    vi.spyOn(newsApi, "getArticles").mockResolvedValue({ articles: worldArticles });
    fireEvent.click(screen.getByRole("tab", { name: "World" }));

    expect(await screen.findByText("World event")).toBeInTheDocument();
    expect(screen.queryByText("Breaking headline")).not.toBeInTheDocument();
  });

  it("shows empty state when no articles match", async () => {
    vi.spyOn(newsApi, "getArticles").mockResolvedValue({ articles: [] });
    render(<NewsPage />);

    expect(await screen.findByText("No stories match this topic and source yet.")).toBeInTheDocument();
  });

  it("does not show source management controls", async () => {
    render(<NewsPage />);
    await screen.findByText("Breaking headline");

    expect(screen.queryByLabelText("Source name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add source" })).not.toBeInTheDocument();
  });

  it("shows a refresh button that fetches new articles", async () => {
    vi.spyOn(newsApi, "refreshFeeds").mockResolvedValue({ new_articles: 1 });
    render(<NewsPage />);
    await screen.findByText("Breaking headline");

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(newsApi.refreshFeeds).toHaveBeenCalled();
    });
  });

  it("shows error state on API failure", async () => {
    vi.spyOn(newsApi, "getSources").mockRejectedValue(new Error("Network error"));
    render(<NewsPage />);

    expect(await screen.findByText("Network error")).toBeInTheDocument();
  });

  it("renders article titles as links", async () => {
    render(<NewsPage />);

    const link = await screen.findByRole("link", { name: "Breaking headline" });
    expect(link).toHaveAttribute("href", "https://arstechnica.com/1");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
