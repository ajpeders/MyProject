import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getAdminStats,
  listAdminUsers,
  listAdminSessions,
  deleteAdminUser,
  deleteAdminSession,
} from "./admin";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(status === 204 ? "" : JSON.stringify(data)),
  } as Response);
}

describe("admin API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  describe("getAdminStats", () => {
    it("calls GET /api/admin/stats via apiFetch", async () => {
      mockFetch.mockResolvedValue(mockResponse({ users: 5, sessions: 10 }));
      const result = await getAdminStats();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/stats"),
        expect.objectContaining({ headers: expect.any(Headers) })
      );
      expect(result.users).toBe(5);
    });
  });

  describe("listAdminUsers", () => {
    it("returns array directly when response is array", async () => {
      mockFetch.mockResolvedValue(mockResponse([{ user_id: "u1", email: "a@b.com" }]));
      const result = await listAdminUsers();
      expect(result).toHaveLength(1);
    });

    it("extracts users array when wrapped in object", async () => {
      mockFetch.mockResolvedValue(mockResponse({ users: [{ user_id: "u2" }] }));
      const result = await listAdminUsers();
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe("u2");
    });
  });

  describe("listAdminSessions", () => {
    it("returns array directly when response is array", async () => {
      mockFetch.mockResolvedValue(mockResponse([{ session_id: "s1" }]));
      const result = await listAdminSessions();
      expect(result).toHaveLength(1);
    });

    it("extracts sessions array when wrapped in object", async () => {
      mockFetch.mockResolvedValue(mockResponse({ sessions: [{ session_id: "s2" }] }));
      const result = await listAdminSessions();
      expect(result).toHaveLength(1);
    });
  });

  describe("deleteAdminUser", () => {
    it("calls DELETE /api/admin/users/{id}", async () => {
      mockFetch.mockResolvedValue(mockResponse({ status: "deleted" }));
      await deleteAdminUser("user-123");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/users/user-123"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("deleteAdminSession", () => {
    it("calls DELETE /api/admin/sessions/{id}", async () => {
      mockFetch.mockResolvedValue(mockResponse({ status: "deleted" }));
      await deleteAdminSession("sess-456");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/admin/sessions/sess-456"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
