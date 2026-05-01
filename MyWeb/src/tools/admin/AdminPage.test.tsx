import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminPage from "./AdminPage";
import * as admin from "../../api/admin";

vi.mock("../../api/admin", () => ({
  getAdminStats: vi.fn(),
  listAdminUsers: vi.fn(),
  listAdminSessions: vi.fn(),
  deleteAdminUser: vi.fn(),
  deleteAdminSession: vi.fn(),
}));

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(admin, "getAdminStats").mockResolvedValue({
      user_count: 1,
      session_count: 1,
      db_size_bytes: 2048,
    });
    vi.spyOn(admin, "listAdminUsers").mockResolvedValue([
      {
        user_id: "user-1",
        email: "admin@example.com",
        created_at: "2026-04-20",
        updated_at: "2026-04-20",
      },
    ]);
    vi.spyOn(admin, "listAdminSessions").mockResolvedValue([
      {
        session_id: "session-1",
        user_id: "user-1",
        email: "admin@example.com",
        has_mail: true,
        created_at: "2026-04-20",
        updated_at: "2026-04-20",
      },
    ]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads admin stats, users, and sessions", async () => {
    render(<AdminPage />);

    expect(await screen.findByRole("heading", { name: "Admin" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("admin@example.com").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("session-1")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  });

  it("shows dashboard immediately without login form", () => {
    render(<AdminPage />);

    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "refresh" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Login" })).toBeNull();
  });

  it("confirms before deleting a user", async () => {
    vi.spyOn(admin, "deleteAdminUser").mockResolvedValue(undefined);
    render(<AdminPage />);

    const deleteButton = await screen.findByRole("button", { name: "delete" });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith("Delete user admin@example.com and all related data?");
      expect(admin.deleteAdminUser).toHaveBeenCalledWith("user-1");
    });
  });

  it("confirms before killing a session", async () => {
    vi.spyOn(admin, "deleteAdminSession").mockResolvedValue(undefined);
    render(<AdminPage />);

    const killButton = await screen.findByRole("button", { name: "kill" });
    fireEvent.click(killButton);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith("Kill session session-1?");
      expect(admin.deleteAdminSession).toHaveBeenCalledWith("session-1");
    });
  });
});
