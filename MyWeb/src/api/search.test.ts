import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchWeb, browseSearchResult } from "./search";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(status === 204 ? "" : JSON.stringify(data)),
  } as Response);
}

describe("search API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("searchWeb", () => {
    it("calls POST /api/search with query", async () => {
      mockFetch.mockResolvedValue(mockResponse({ answer: "result", results: [] }));
      await searchWeb("test query");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/search"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ query: "test query", skip_answer: false }),
        })
      );
    });

    it("returns answer and results", async () => {
      const mockData = { answer: "The answer", results: [{ title: "Test", url: "https://example.com" }] };
      mockFetch.mockResolvedValue(mockResponse(mockData));
      const result = await searchWeb("query");
      expect(result.answer).toBe("The answer");
      expect(result.results[0].title).toBe("Test");
    });
  });

  describe("browseSearchResult", () => {
    it("calls GET /api/search/browse with encoded url", async () => {
      mockFetch.mockResolvedValue(mockResponse({ url: "https://example.com", summary: "page summary" }));
      await browseSearchResult("https://example.com/page");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/search/browse?url=https%3A%2F%2Fexample.com%2Fpage"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("returns browse response", async () => {
      mockFetch.mockResolvedValue(mockResponse({ summary: "Page summary", title: "Example" }));
      const result = await browseSearchResult("https://example.com");
      expect(result.title).toBe("Example");
      expect(result.summary).toBe("Page summary");
    });
  });
});