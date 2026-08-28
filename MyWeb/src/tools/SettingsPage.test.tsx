import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SettingsPage from "./SettingsPage";
import * as imap from "../api/imap";
import * as mailConfig from "../api/mailConfig";
import * as aiConfigs from "../api/aiConfigs";
import * as auth from "../api/auth";
import type { AIConfig } from "../api/aiConfigs";

vi.mock("../api/auth", () => ({
  isAuthenticated: () => true,
  isAdmin: vi.fn(() => true),
}));

vi.mock("../api/imap", () => ({
  listImapAccounts: vi.fn(),
  addImapAccount: vi.fn(),
  deleteImapAccount: vi.fn(),
}));

vi.mock("../api/mailConfig", () => ({
  getMailConfig: vi.fn(),
  updateMailConfig: vi.fn(),
  setMailAIConfig: vi.fn(),
}));

vi.mock("../api/aiConfigs", () => ({
  listAIConfigs: vi.fn(),
  createAIConfig: vi.fn(),
  updateAIConfig: vi.fn(),
  deleteAIConfig: vi.fn(),
}));

const SAMPLE_OLLAMA: AIConfig = {
  id: "cfg-1",
  name: "Local llama",
  provider: "ollama",
  host: "http://192.168.1.40:11434",
  model: "qwen3:8b",
  has_api_key: false,
  created_at: 0,
  updated_at: 0,
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auth, "isAdmin").mockReturnValue(true);
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    vi.spyOn(mailConfig, "getMailConfig").mockResolvedValue({
      mail_model: "qwen3:8b",
      mail_preferences: "",
      available_models: ["qwen3:8b", "llama3.1:8b"],
      ai_config_id: null,
    });
    vi.spyOn(mailConfig, "setMailAIConfig").mockResolvedValue({
      mail_model: "qwen3:8b",
      mail_preferences: "",
      available_models: ["qwen3:8b"],
      ai_config_id: null,
    });
    vi.spyOn(aiConfigs, "listAIConfigs").mockResolvedValue([]);
    window.location.hash = "";
  });

  it("renders the AI tab by default", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "AI Configs" })).toBeInTheDocument();
    const aiTab = screen.getByRole("tab", { name: "AI" });
    expect(aiTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "+ Add AI Config" })).toBeInTheDocument();
  });

  it("adds an Ollama AI config and lists it", async () => {
    vi.spyOn(aiConfigs, "createAIConfig").mockResolvedValue(SAMPLE_OLLAMA);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "+ Add AI Config" }));
    fireEvent.change(screen.getByPlaceholderText(/Local llama/i), { target: { value: "Local llama" } });
    fireEvent.change(screen.getByPlaceholderText("http://192.168.1.40:11434"), { target: { value: "http://192.168.1.40:11434" } });
    fireEvent.change(screen.getByPlaceholderText("qwen3:8b"), { target: { value: "qwen3:8b" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(aiConfigs.createAIConfig).toHaveBeenCalledWith({
        name: "Local llama",
        provider: "ollama",
        host: "http://192.168.1.40:11434",
        model: "qwen3:8b",
      });
    });
    expect(await screen.findByText("Local llama")).toBeInTheDocument();
  });

  it("renders the Mail tab selector populated with AI configs", async () => {
    vi.spyOn(aiConfigs, "listAIConfigs").mockResolvedValue([SAMPLE_OLLAMA]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "AI Configs" });
    fireEvent.click(screen.getByRole("tab", { name: "Mail" }));

    const selector = await screen.findByLabelText("AI Config");
    expect(selector).toBeInTheDocument();
    expect(selector.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "Local llama" })).toBeInTheDocument();
  });

  it("shows a hint linking to AI tab when no configs exist on the Mail tab", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "AI Configs" });
    fireEvent.click(screen.getByRole("tab", { name: "Mail" }));

    const hint = await screen.findByText(/Create an AI config first/i);
    expect(hint).toBeInTheDocument();
    expect(hint.closest("a")?.getAttribute("href")).toBe("#ai");
  });

  it("PATCHes mail config when selecting an AI config from the Mail tab", async () => {
    vi.spyOn(aiConfigs, "listAIConfigs").mockResolvedValue([SAMPLE_OLLAMA]);
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "AI Configs" });
    fireEvent.click(screen.getByRole("tab", { name: "Mail" }));
    const selector = await screen.findByLabelText("AI Config");
    fireEvent.change(selector, { target: { value: "cfg-1" } });

    await waitFor(() => {
      expect(mailConfig.setMailAIConfig).toHaveBeenCalledWith("cfg-1");
    });
  });

  it("can still add an IMAP account from the Mail tab", async () => {
    vi.spyOn(imap, "addImapAccount").mockResolvedValue({
      id: "acc-1", name: "Gmail", server: "imap.gmail.com", username: "you@gmail.com", created_at: "2026-06-06T00:00:00Z",
    });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "AI Configs" });
    fireEvent.click(screen.getByRole("tab", { name: "Mail" }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Add IMAP Account" }));
    fireEvent.change(screen.getByPlaceholderText("Gmail personal"), { target: { value: "Gmail" } });
    fireEvent.change(screen.getByPlaceholderText("imap.gmail.com"), { target: { value: "imap.gmail.com" } });
    fireEvent.change(screen.getByPlaceholderText("you@gmail.com"), { target: { value: "you@gmail.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "app-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Account" }));

    await waitFor(() => {
      expect(imap.addImapAccount).toHaveBeenCalledWith("Gmail", "imap.gmail.com", "you@gmail.com", "app-password");
    });
  });
});
