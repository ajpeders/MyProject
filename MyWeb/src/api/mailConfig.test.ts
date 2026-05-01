import { describe, it, expect, beforeEach, vi } from "vitest";
import { getMailConfig, updateMailConfig } from "./mailConfig";

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

describe("mail config API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("loads the current mail model", async () => {
    mockFetch.mockResolvedValue(mockResponse({ mail_model: "qwen3:8b", mail_preferences: "prefer reply", available_models: ["qwen3:8b"] }));
    const result = await getMailConfig();
    expect(result.mail_model).toBe("qwen3:8b");
    expect(result.mail_preferences).toBe("prefer reply");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/config/mail"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("updates the mail model", async () => {
    mockFetch.mockResolvedValue(mockResponse({ mail_model: "llama3.1:8b", mail_preferences: "prefer calendar", available_models: ["llama3.1:8b"] }));
    const result = await updateMailConfig("llama3.1:8b", "prefer calendar");
    const [, options] = mockFetch.mock.calls[0];
    expect(JSON.parse(options.body as string)).toEqual({ mail_model: "llama3.1:8b", mail_preferences: "prefer calendar" });
    expect(result.mail_model).toBe("llama3.1:8b");
    expect(result.mail_preferences).toBe("prefer calendar");
  });
});
