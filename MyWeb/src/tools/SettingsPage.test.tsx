import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SettingsPage from "./SettingsPage";
import * as imap from "../api/imap";
import * as client from "../api/client";
import * as mailConfig from "../api/mailConfig";
import * as newsApi from "../api/news";

import * as auth from "../api/auth";

vi.mock("../api/auth", () => ({
  isAuthenticated: () => true,
  isAdmin: vi.fn(() => true),
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

const mockSources: newsApi.NewsSource[] = [
  { id: "s1", user_id: "u1", label: "Ars Technica", topic: "Tech", feed_url: "https://arstechnica.com/rss", enabled: true, created_at: 1 },
  { id: "s2", user_id: "u1", label: "BBC World", topic: "World", feed_url: "https://bbc.com/rss", enabled: true, created_at: 2 },
];

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auth, "isAdmin").mockReturnValue(true);
    vi.spyOn(mailConfig, "getMailConfig").mockResolvedValue({
      mail_model: "qwen3:8b",
      available_models: ["qwen3:8b", "llama3.1:8b"],
    });
    vi.spyOn(newsApi, "getSources").mockResolvedValue({ sources: mockSources });
  });

  it("renders settings heading", () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Manage your email settings.")).toBeInTheDocument();
  });

  it("shows add account button", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Add IMAP Account" })).toBeInTheDocument();
    });
  });

  it("saves the MyAgent API key from settings", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("MyAgent API Key"), { target: { value: "runtime-key" } });
    fireEvent.click(screen.getByRole("button", { name: "save key" }));

    await waitFor(() => {
      expect(client.setApiKey).toHaveBeenCalledWith("runtime-key");
      expect(screen.getByText("API key saved.")).toBeInTheDocument();
    });
  });

  it("shows the current mail model and available options", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);

    expect(await screen.findByDisplayValue("qwen3:8b")).toBeInTheDocument();
    fireEvent.focus(screen.getByLabelText("Mail Model"));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "qwen3:8b" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "save model" })).toBeInTheDocument();
  });

  it("saves the selected mail model", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    vi.spyOn(mailConfig, "updateMailConfig").mockResolvedValue({
      mail_model: "llama3.1:8b",
      available_models: ["qwen3:8b", "llama3.1:8b"],
    });

    render(<MemoryRouter><SettingsPage /></MemoryRouter>);

    fireEvent.change(await screen.findByLabelText("Mail Model"), { target: { value: "llama" } });
    fireEvent.click(await screen.findByRole("option", { name: "llama3.1:8b" }));
    fireEvent.click(screen.getByRole("button", { name: "save model" }));

    await waitFor(() => {
      expect(mailConfig.updateMailConfig).toHaveBeenCalledWith("llama3.1:8b");
      expect(screen.getByText("Mail model saved: llama3.1:8b")).toBeInTheDocument();
    });
  });

  it("shows loading then accounts", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([
      { id: "1", name: "Gmail", server: "imap.gmail.com", username: "test@gmail.com", created_at: "2026-04-19" },
    ]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText("Gmail")).toBeInTheDocument();
      expect(screen.getByText("imap.gmail.com")).toBeInTheDocument();
    });
  });

  it("opens add account form", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: "+ Add IMAP Account" }));
    });
    expect(screen.getByRole("heading", { name: "Add IMAP Account" })).toBeInTheDocument();
  });

  it("adds an IMAP account without asking for the MyAgent password", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    vi.spyOn(imap, "addImapAccount").mockResolvedValue({
      id: "1",
      name: "Gmail",
      server: "imap.gmail.com",
      username: "test@gmail.com",
      created_at: "2026-04-20",
    });

    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "+ Add IMAP Account" }));
    fireEvent.change(screen.getByLabelText("Account Name"), { target: { value: "Gmail" } });
    fireEvent.change(screen.getByLabelText("IMAP Server"), { target: { value: "imap.gmail.com" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "test@gmail.com" } });
    fireEvent.change(screen.getByLabelText("Password (app password)"), { target: { value: "app-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Account" }));

    await waitFor(() => {
      expect(imap.addImapAccount).toHaveBeenCalledWith("Gmail", "imap.gmail.com", "test@gmail.com", "app-password");
    });
    expect(screen.queryByLabelText("MyAgent Password")).not.toBeInTheDocument();
  });

  it("shows empty state when no accounts", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText("No IMAP accounts configured.")).toBeInTheDocument();
    });
  });

  it("renders news sources from API", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "News Sources" })).toBeInTheDocument();
    expect(await screen.findByRole("checkbox", { name: "Ars Technica" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "BBC World" })).toBeChecked();
  });

  it("adds a news source via API", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    vi.spyOn(newsApi, "createSource").mockResolvedValue({
      id: "s3", user_id: "u1", label: "Bloomberg", topic: "Tech",
      feed_url: "https://example.com/bloomberg.xml", enabled: true, created_at: 3,
    });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);

    await screen.findByRole("checkbox", { name: "Ars Technica" });
    fireEvent.change(screen.getByLabelText("Source name"), { target: { value: "Bloomberg" } });
    fireEvent.change(screen.getByLabelText("Feed URL"), { target: { value: "https://example.com/bloomberg.xml" } });
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));

    expect(await screen.findByRole("checkbox", { name: "Bloomberg" })).toBeChecked();
    expect(newsApi.createSource).toHaveBeenCalledWith("Bloomberg", "Tech", "https://example.com/bloomberg.xml");
  });

  it("toggles a news source via API", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    vi.spyOn(newsApi, "updateSource").mockResolvedValue({
      ...mockSources[0], enabled: false,
    });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);

    const checkbox = await screen.findByRole("checkbox", { name: "Ars Technica" });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(newsApi.updateSource).toHaveBeenCalledWith("s1", false);
    });
  });

  it("deletes a news source via API with confirmation", async () => {
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    vi.spyOn(newsApi, "deleteSource").mockResolvedValue(undefined);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);

    await screen.findByRole("checkbox", { name: "Ars Technica" });
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText("Delete?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(newsApi.deleteSource).toHaveBeenCalledWith("s1");
      expect(screen.queryByRole("checkbox", { name: "Ars Technica" })).not.toBeInTheDocument();
    });
  });

  it("hides news sources section for non-admin users", async () => {
    vi.spyOn(auth, "isAdmin").mockReturnValue(false);
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);

    expect(screen.queryByRole("heading", { name: "News Sources" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add source" })).not.toBeInTheDocument();
  });
});
