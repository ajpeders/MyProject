import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SettingsPage from "./SettingsPage";
import * as imap from "../api/imap";
import * as client from "../api/client";
import * as mailConfig from "../api/mailConfig";
import * as newsApi from "../api/news";
import * as profileApi from "../api/profile";

import * as auth from "../api/auth";

vi.mock("../api/auth", () => ({
  isAuthenticated: () => true,
  isAdmin: vi.fn(() => true),
  createOrRotateDeviceToken: vi.fn(),
  getDeviceTokenMeta: vi.fn(),
  revokeDeviceToken: vi.fn(),
}));

vi.mock("../api/client", () => ({
  getApiKey: vi.fn(() => ""),
  setApiKey: vi.fn(),
}));

vi.mock("../api/imap", () => ({
  listImapAccounts: vi.fn(),
  addImapAccount: vi.fn(),
  deleteImapAccount: vi.fn(),
}));

vi.mock("../api/mailConfig", () => ({
  getMailConfig: vi.fn(),
  updateMailConfig: vi.fn(),
}));

vi.mock("../api/news", () => ({
  getSources: vi.fn(),
  createSource: vi.fn(),
  updateSource: vi.fn(),
  deleteSource: vi.fn(),
  seedDefaults: vi.fn(),
}));

vi.mock("../api/profile", () => ({
  getProfile: vi.fn(),
  updateInterests: vi.fn(),
}));

const mockSources: newsApi.NewsSource[] = [
  { id: "s1", user_id: "u1", label: "Ars Technica", topic: "Tech", feed_url: "https://arstechnica.com/rss", enabled: true, created_at: 1 },
  { id: "s2", user_id: "u1", label: "BBC World", topic: "World", feed_url: "https://bbc.com/rss", enabled: true, created_at: 2 },
];

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auth, "isAdmin").mockReturnValue(true);
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    vi.spyOn(mailConfig, "getMailConfig").mockResolvedValue({
      mail_model: "qwen3:8b",
      available_models: ["qwen3:8b", "llama3.1:8b"],
    });
    vi.spyOn(newsApi, "getSources").mockResolvedValue({ sources: mockSources });
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({ interests: ["AI", "gaming"], model_config: {} });
    vi.spyOn(profileApi, "updateInterests").mockResolvedValue(undefined);
    vi.spyOn(auth, "getDeviceTokenMeta").mockResolvedValue({ exists: false });
    vi.spyOn(auth, "createOrRotateDeviceToken").mockResolvedValue({
      token: "whsk_secret-token-value",
      last4: "alue",
      created_at: 1_776_672_000,
    });
    vi.spyOn(auth, "revokeDeviceToken").mockResolvedValue(undefined);
  });

  // ── Tabs ─────────────────────────────────────────

  it("renders tabs: General, Mail, News", () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mail" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "News" })).toBeInTheDocument();
  });

  it("defaults to General tab", () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows News tab for all users", () => {
    vi.spyOn(auth, "isAdmin").mockReturnValue(false);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(screen.getByRole("tab", { name: "News" })).toBeInTheDocument();
  });

  it("hides Sources section on News tab for non-admin", async () => {
    vi.spyOn(auth, "isAdmin").mockReturnValue(false);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "News" }));
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Source name")).not.toBeInTheDocument();
  });

  // ── General Tab (API Key) ─────────────────────────

  it("saves the API key", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "runtime-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(client.setApiKey).toHaveBeenCalledWith("runtime-key");
      expect(screen.getByText("API key saved.")).toBeInTheDocument();
    });
  });

  // ── News Tab (Interests + Model + Sources) ───────

  it("renders interests on News tab", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "News" }));
    expect(await screen.findByText("AI")).toBeInTheDocument();
    expect(screen.getByText("gaming")).toBeInTheDocument();
  });

  it("can add an interest on News tab", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "News" }));
    await screen.findByText("AI");
    fireEvent.change(screen.getByPlaceholderText("e.g. AI, hip hop, Rust, gaming"), { target: { value: "music" } });
    // Click the Add button next to the interests input (first one)
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(profileApi.updateInterests).toHaveBeenCalledWith(["AI", "gaming", "music"]);
    });
  });

  it("can remove an interest on News tab", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "News" }));
    await screen.findByText("AI");
    fireEvent.click(screen.getByRole("button", { name: "Remove AI" }));

    await waitFor(() => {
      expect(profileApi.updateInterests).toHaveBeenCalledWith(["gaming"]);
    });
  });

  // ── Mail Tab ─────────────────────────────────────

  it("shows mail model on Mail tab", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "Mail" }));
    expect(await screen.findByDisplayValue("qwen3:8b")).toBeInTheDocument();
  });

  it("shows add account button on Mail tab", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "Mail" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Add IMAP Account" })).toBeInTheDocument();
    });
  });

  // ── News Tab ─────────────────────────────────────

  it("renders news sources on News tab", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "News" }));
    expect(await screen.findByRole("checkbox", { name: "Ars Technica" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "BBC World" })).toBeChecked();
  });

  it("adds a news source via API", async () => {
    vi.spyOn(newsApi, "createSource").mockResolvedValue({
      id: "s3", user_id: "u1", label: "Bloomberg", topic: "Tech",
      feed_url: "https://example.com/bloomberg.xml", enabled: true, created_at: 3,
    });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "News" }));

    await screen.findByRole("checkbox", { name: "Ars Technica" });
    fireEvent.change(screen.getByPlaceholderText("Source name"), { target: { value: "Bloomberg" } });
    fireEvent.change(screen.getByPlaceholderText("Feed URL"), { target: { value: "https://example.com/bloomberg.xml" } });
    // Click the source Add button (second one — first is interests)
    const addButtons = screen.getAllByRole("button", { name: "Add" });
    fireEvent.click(addButtons[addButtons.length - 1]);

    expect(await screen.findByRole("checkbox", { name: "Bloomberg" })).toBeChecked();
  });

  it("deletes a news source with confirmation", async () => {
    vi.spyOn(newsApi, "deleteSource").mockResolvedValue(undefined);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "News" }));

    await screen.findByRole("checkbox", { name: "Ars Technica" });
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(newsApi.deleteSource).toHaveBeenCalledWith("s1");
    });
  });

  // ── Device token ─────────────────────────────────

  it("shows 'None' status when no device token exists", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(await screen.findByText(/Whisper device token/)).toBeInTheDocument();
    expect(screen.getByText(/○ None/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
  });

  it("generates a token and shows the plaintext modal once", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await screen.findByText(/Whisper device token/);
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(await screen.findByText("whsk_secret-token-value")).toBeInTheDocument();
    expect(screen.getByText(/Save this now/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/····alue/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Rotate" })).toBeInTheDocument();
  });

  it("dismisses the plaintext modal", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await screen.findByText(/Whisper device token/);
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await screen.findByText("whsk_secret-token-value");
    fireEvent.click(screen.getByRole("button", { name: "I've saved it" }));
    await waitFor(() => {
      expect(screen.queryByText("whsk_secret-token-value")).not.toBeInTheDocument();
    });
  });

  it("shows active status and Rotate/Revoke when token already exists", async () => {
    vi.spyOn(auth, "getDeviceTokenMeta").mockResolvedValue({
      exists: true,
      last4: "a7f2",
      created_at: 1_776_672_000,
      last_used_at: null,
    });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(await screen.findByText(/····a7f2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rotate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });

  it("revokes a token and reverts to None", async () => {
    vi.spyOn(auth, "getDeviceTokenMeta").mockResolvedValue({
      exists: true,
      last4: "a7f2",
      created_at: 1_776_672_000,
    });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await screen.findByText(/····a7f2/);
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => {
      expect(auth.revokeDeviceToken).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/○ None/)).toBeInTheDocument();
    });
  });
});
