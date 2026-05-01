import { describe, it, expect, beforeEach, vi } from "vitest";
import { getApiKey, setApiKey, apiFetch, ApiError } from "./client";

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

describe("client API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  describe("getApiKey", () => {
    it("returns localStorage key when set", () => {
      localStorage.setItem("myagent.api_key", "stored-key");
      expect(getApiKey()).toBe("stored-key");
    });

    it("returns empty string when not set", () => {
      expect(getApiKey()).toBe("");
    });
  });

  describe("setApiKey", () => {
    it("stores trimmed key in localStorage", () => {
      setApiKey("  my-key  ");
      expect(localStorage.getItem("myagent.api_key")).toBe("my-key");
    });

    it("removes key from localStorage when given empty string", () => {
      localStorage.setItem("myagent.api_key", "old-key");
      setApiKey("");
      expect(localStorage.getItem("myagent.api_key")).toBeNull();
    });
  });

  describe("apiFetch", () => {
    it("sets Content-Type header", async () => {
      mockFetch.mockResolvedValue(mockResponse({}));
      await apiFetch("/api/test");
      const [, opts] = mockFetch.mock.calls[0];
      const headers = opts.headers as Headers;
      expect(headers.get("Content-Type")).toBe("application/json");
    });

    it("adds auth headers when auth state exists", async () => {
      mockFetch.mockResolvedValue(mockResponse({}));
      localStorage.setItem("myagent.session_id", "sess-1");
      localStorage.setItem("myagent.token", "jwt-1");
      localStorage.setItem("myagent.user_id", "user-1");
      await apiFetch("/api/test");
      const [, opts] = mockFetch.mock.calls[0];
      const headers = opts.headers as Headers;
      expect(headers.get("X-Session-ID")).toBe("sess-1");
      expect(headers.get("Authorization")).toBe("Bearer jwt-1");
      expect(headers.get("X-User-ID")).toBe("user-1");
    });

    it("parses JSON error response and throws ApiError", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('{"detail": "Invalid token"}'),
        json: () => Promise.resolve({ detail: "Invalid token" }),
      });
      await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
    });

    it("throws ApiError with status on network failure", async () => {
      mockFetch.mockRejectedValue(new TypeError("failed to fetch"));
      await expect(apiFetch("/api/test")).rejects.toThrow("Could not reach API server");
    });
  });
});
