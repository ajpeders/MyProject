import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSearchConfig, updateSearchConfig } from "./searchConfig";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
}

describe("search config API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("loads the current search provider", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        search_provider: "duckduckgo",
        available_providers: [{ id: "duckduckgo", label: "DuckDuckGo" }],
      }),
    );
    const result = await getSearchConfig();
    expect(result.search_provider).toBe("duckduckgo");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/config/search"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("updates the search provider", async () => {
    mockFetch.mockResolvedValue(
      mockResponse({
        search_provider: "searx",
        available_providers: [{ id: "searx", label: "Searx" }],
      }),
    );
    const result = await updateSearchConfig("searx");
    const [, options] = mockFetch.mock.calls[0];
    expect(JSON.parse(options.body as string)).toEqual({ search_provider: "searx" });
    expect(result.search_provider).toBe("searx");
  });
});
