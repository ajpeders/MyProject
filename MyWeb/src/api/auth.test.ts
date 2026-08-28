import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loginAccount,
  registerAccount,
  isAuthenticated,
  getSessionId,
  logout,
  storeAuthResponse,
} from "./auth";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockResponse(data: unknown, status = 200) {
  const body = status === 204 ? "" : JSON.stringify(data);
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(body),
  } as Response);
}

describe("auth API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  describe("loginAccount", () => {
    it("calls POST /api/account/login with email and password", async () => {
      mockFetch.mockResolvedValue(mockResponse({ user_id: "u1", session_id: "s1", token: "jwt-1", account: "acc1" }));
      const result = await loginAccount("test@example.com", "password123");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account/login"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "test@example.com", password: "password123" }),
        })
      );
      expect(result.user_id).toBe("u1");
      expect(result.session_id).toBe("s1");
      expect(result.token).toBe("jwt-1");
    });

    it("throws on failed login", async () => {
      mockFetch.mockResolvedValue(mockResponse({ detail: "Invalid credentials" }, 401));
      await expect(loginAccount("test@example.com", "wrong")).rejects.toThrow();
    });
  });

  describe("registerAccount", () => {
    it("calls POST /api/account/register", async () => {
      mockFetch.mockResolvedValue(mockResponse({ user_id: "u2", session_id: "s2", token: "jwt-2", account: "acc2" }));
      const result = await registerAccount("new@example.com", "newpass");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/account/register"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "new@example.com", password: "newpass" }),
        })
      );
      expect(result.user_id).toBe("u2");
    });
  });

  describe("isAuthenticated", () => {
    it("returns false when no token is in storage", () => {
      localStorage.removeItem("myagent.token");
      expect(isAuthenticated()).toBe(false);
    });

    it("returns true when token is in localStorage", () => {
      localStorage.setItem("myagent.token", "abc123");
      const result = isAuthenticated();
      localStorage.removeItem("myagent.token");
      expect(result).toBe(true);
    });
  });

  describe("getSessionId", () => {
    it("returns null when not set", () => {
      localStorage.removeItem("myagent.session_id");
      expect(getSessionId()).toBeNull();
    });

    it("returns session_id when set in localStorage", () => {
      localStorage.setItem("myagent.session_id", "xyz789");
      const result = getSessionId();
      localStorage.removeItem("myagent.session_id");
      expect(result).toBe("xyz789");
    });
  });

  describe("logout", () => {
    it("removes user_id, session_id, token, account, and email from localStorage", () => {
      localStorage.setItem("myagent.user_id", "u1");
      localStorage.setItem("myagent.session_id", "s1");
      localStorage.setItem("myagent.token", "jwt-1");
      localStorage.setItem("myagent.account", "acc1");
      localStorage.setItem("myagent.email", "test@example.com");
      logout();
      expect(localStorage.getItem("myagent.user_id")).toBeNull();
      expect(localStorage.getItem("myagent.session_id")).toBeNull();
      expect(localStorage.getItem("myagent.token")).toBeNull();
      expect(localStorage.getItem("myagent.account")).toBeNull();
      expect(localStorage.getItem("myagent.email")).toBeNull();
    });
  });

  describe("storeAuthResponse", () => {
    it("stores user_id, session_id, token, and account in localStorage", () => {
      storeAuthResponse({ user_id: "u1", session_id: "s1", token: "jwt-1", account: "acc1" });
      expect(localStorage.getItem("myagent.user_id")).toBe("u1");
      expect(localStorage.getItem("myagent.session_id")).toBe("s1");
      expect(localStorage.getItem("myagent.token")).toBe("jwt-1");
      expect(localStorage.getItem("myagent.account")).toBe("acc1");
      // cleanup
      localStorage.removeItem("myagent.user_id");
      localStorage.removeItem("myagent.session_id");
      localStorage.removeItem("myagent.token");
      localStorage.removeItem("myagent.account");
    });

    it("stores email when provided", () => {
      storeAuthResponse({ user_id: "u1", session_id: "s1", token: "jwt-1", account: "acc1" }, "test@example.com");
      expect(localStorage.getItem("myagent.email")).toBe("test@example.com");
      // cleanup
      localStorage.removeItem("myagent.email");
    });
  });
});
