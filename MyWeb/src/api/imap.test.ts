import { describe, it, expect, beforeEach, vi } from "vitest";
import { listImapAccounts, addImapAccount, deleteImapAccount } from "./imap";

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

describe("imap API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("listImapAccounts", () => {
    it("calls GET /api/imap", async () => {
      mockFetch.mockResolvedValue(mockResponse([]));
      await listImapAccounts();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/imap"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("returns account list", async () => {
      mockFetch.mockResolvedValue(mockResponse([{ id: "acc1", name: "Gmail", server: "imap.gmail.com", username: "user" }]));
      const result = await listImapAccounts();
      expect(result[0].name).toBe("Gmail");
    });
  });

  describe("addImapAccount", () => {
    it("calls POST /api/imap with all fields", async () => {
      mockFetch.mockResolvedValue(mockResponse({ id: "new-acc", name: "Work", server: "imap.work.com", username: "me" }));
      await addImapAccount("Work", "imap.work.com", "me", "pass123");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.name).toBe("Work");
      expect(body.server).toBe("imap.work.com");
      expect(body.username).toBe("me");
      expect(body.imap_password).toBe("pass123");
      expect(body.user_password).toBeUndefined();
      expect(body.port).toBe(993);
    });

    it("uses default port 993 when not specified", async () => {
      mockFetch.mockResolvedValue(mockResponse({ id: "acc" }));
      await addImapAccount("Name", "server", "user", "pass");
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.port).toBe(993);
    });
  });

  describe("deleteImapAccount", () => {
    it("calls DELETE /api/imap/{id}", async () => {
      mockFetch.mockResolvedValue(mockResponse(undefined, 204));
      await deleteImapAccount("acc-123");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/imap/acc-123"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
