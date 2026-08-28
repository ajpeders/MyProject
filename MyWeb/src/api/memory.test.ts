import { describe, it, expect, beforeEach, vi } from "vitest";
import { listMemories, addMemory, deleteMemory } from "./memory";

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

describe("memory API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("listMemories", () => {
    it("calls GET /api/memory", async () => {
      mockFetch.mockResolvedValue(mockResponse([]));
      await listMemories();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/memory"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("appends query params when query is provided", async () => {
      mockFetch.mockResolvedValue(mockResponse([]));
      await listMemories("my search", 3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/memory?q=my+search&top_k=3"),
        expect.anything()
      );
    });

    it("returns array of memory items", async () => {
      mockFetch.mockResolvedValue(mockResponse([{ memory_id: "m1", content: "Test memory" }]));
      const result = await listMemories();
      expect(result[0].memory_id).toBe("m1");
      expect(result[0].content).toBe("Test memory");
    });
  });

  describe("addMemory", () => {
    it("calls POST /api/memory with content", async () => {
      mockFetch.mockResolvedValue(mockResponse({ memory_id: "m-new", content: "New memory" }));
      const result = await addMemory("New memory");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/memory"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ content: "New memory" }),
        })
      );
      expect(result.memory_id).toBe("m-new");
    });
  });

  describe("deleteMemory", () => {
    it("calls DELETE /api/memory/{id}", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));
      await deleteMemory("mem-123");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/memory/mem-123"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});