import { describe, it, expect, beforeEach, vi } from "vitest";
import { getMailPage, fetchMail, readMail, moveMail, analyzeMail, submitMailFeedback } from "./mail";

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

describe("mail API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("getMailPage", () => {
    it("calls GET /api/mail with zero-based page", async () => {
      mockFetch.mockResolvedValue(mockResponse({ emails: [], page: 1, total_pages: 1, total_emails: 0, content: "" }));
      await getMailPage(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/mail?page=1"),
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("fetchMail", () => {
    it("calls POST /api/mail/fetch", async () => {
      mockFetch.mockResolvedValue(mockResponse({ emails: [], page: 1, total_pages: 1, total_emails: 0, content: "" }));
      await fetchMail({ account: "my-account" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.account).toBe("my-account");
    });

    it("applies defaults for count and unread_only", async () => {
      mockFetch.mockResolvedValue(mockResponse({ emails: [], page: 1, total_pages: 1, total_emails: 0, content: "" }));
      await fetchMail({});
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.count).toBe(0);
      expect(body.unread_only).toBe(false);
    });

    it("sends preferences when provided", async () => {
      mockFetch.mockResolvedValue(mockResponse({ emails: [], page: 1, total_pages: 1, total_emails: 0, content: "" }));
      await fetchMail({ preferences: "prefer reply" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.preferences).toBe("prefer reply");
    });
  });

  describe("readMail", () => {
    it("calls GET /api/mail/{index}", async () => {
      mockFetch.mockResolvedValue(mockResponse({ index: 5, from: "test@example.com", subject: "Test", date: "2026-04-21", body: "Hello", account: "acc1" }));
      const result = await readMail(5);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/mail/5"),
        expect.objectContaining({ method: "GET" })
      );
      expect(result.from).toBe("test@example.com");
    });
  });

  describe("moveMail", () => {
    it("calls POST /api/mail/move with indices and folder", async () => {
      mockFetch.mockResolvedValue(mockResponse({ message: "Moved", folder: "Archive" }));
      const result = await moveMail([1, 3], "Archive");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/mail/move"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ indices: [1, 3], folder: "Archive" }),
        })
      );
      expect(result.folder).toBe("Archive");
    });
  });

  describe("analyzeMail", () => {
    it("calls POST /api/mail/analyze with preferences", async () => {
      mockFetch.mockResolvedValue(mockResponse({ emails: [], page: 1, total_pages: 1, total_emails: 0, content: "" }));
      await analyzeMail({ indices: [2], preferences: "prefer calendar" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/mail/analyze"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ indices: [2], preferences: "prefer calendar" }),
        })
      );
    });
  });

  describe("submitMailFeedback", () => {
    it("calls POST /api/mail/feedback", async () => {
      mockFetch.mockResolvedValue(mockResponse({ status: "ok" }));
      await submitMailFeedback({ index: 2, verdict: "good", text: "helpful" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/mail/feedback"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ index: 2, verdict: "good", text: "helpful" }),
        })
      );
    });
  });
});
