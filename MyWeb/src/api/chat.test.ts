import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendChat } from "./chat";

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

describe("chat API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  describe("sendChat", () => {
    it("calls POST /api/chat", async () => {
      mockFetch.mockResolvedValue(mockResponse([{ type: "text", content: "hello" }]));
      const result = await sendChat({ prompt: "hello" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/chat"),
        expect.objectContaining({ method: "POST" })
      );
      expect(result).toHaveLength(1);
    });

    it("passes prompt in request body", async () => {
      mockFetch.mockResolvedValue(mockResponse([]));
      await sendChat({ prompt: "test prompt" });
      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.prompt).toBe("test prompt");
    });

    it("uses provided session_id over getSessionId default", async () => {
      mockFetch.mockResolvedValue(mockResponse([]));
      localStorage.setItem("myagent.session_id", "default-sess");
      await sendChat({ prompt: "test", session_id: "override-sess" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.session_id).toBe("override-sess");
    });
  });
});