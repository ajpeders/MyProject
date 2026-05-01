import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MailPage from "./MailPage";
import { ApiError } from "../../api/client";
import * as imap from "../../api/imap";
import * as mail from "../../api/mail";
import * as mailConfig from "../../api/mailConfig";

vi.mock("../../api/auth", () => ({
  logout: vi.fn(),
}));

vi.mock("../../api/imap", () => ({
  listImapAccounts: vi.fn(),
  addImapAccount: vi.fn(),
}));

vi.mock("../../api/mail", () => ({
  analyzeMail: vi.fn(),
  devSeedMail: vi.fn(),
  fetchMail: vi.fn(),
  fetchMailOnly: vi.fn(),
  getMailFolders: vi.fn(),
  getMailPage: vi.fn(),
  moveMail: vi.fn(),
  readMail: vi.fn(),
  searchMail: vi.fn(),
  submitMailFeedback: vi.fn(),
}));

vi.mock("../../api/mailConfig", () => ({
  getMailConfig: vi.fn(),
  updateMailConfig: vi.fn(),
}));

// VITE_DEV_MODE=true in .env, so DEV_MODE is true in all tests.
// This means: no fetch fallback on 404, dev-seed on 400 with no accounts.

const SAMPLE_EMAILS = [
  {
    id: "message-1",
    index: 1,
    subject: "Server report",
    from: "ops@example.com",
    date: "2026-04-19",
    account: "Personal",
    read: false,
    summary: "Deployment summary.",
    recommended_todo: "Review the deployment report.",
  },
];

describe("MailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([
      { id: "account-1", name: "Personal", server: "imap.example.com", username: "me@example.com", created_at: "2026-04-20" },
    ]);
    vi.spyOn(mail, "fetchMail").mockResolvedValue({
      emails: [],
      page: 1,
      total_pages: 1,
      total_emails: 0,
      content: "[mail] Inbox is empty.",
    });
    vi.spyOn(mail, "fetchMailOnly").mockResolvedValue({
      emails: [],
      page: 1,
      total_pages: 1,
      total_emails: 0,
      content: "[mail] Inbox is empty.",
    });
    vi.spyOn(mail, "devSeedMail").mockResolvedValue({
      emails: [],
      page: 1,
      total_pages: 1,
      total_emails: 0,
      content: "[mail] Inbox is empty.",
    });
    vi.spyOn(mail, "getMailFolders").mockResolvedValue({ folders: ["Inbox", "Archive", "Trash"] });
    vi.spyOn(mail, "analyzeMail").mockResolvedValue({
      emails: [],
      page: 1,
      total_pages: 1,
      total_emails: 0,
      content: "[mail] Inbox is empty.",
    });
    vi.spyOn(mail, "searchMail").mockResolvedValue({ emails: [] });
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      emails: [],
      page: 1,
      total_pages: 1,
      total_emails: 0,
      content: "[mail] Inbox is empty.",
    });
    vi.spyOn(mail, "readMail").mockResolvedValue({
      index: 1,
      from: "ops@example.com",
      subject: "Server report",
      date: "2026-04-19",
      body: "Deploy completed successfully.",
      account: "Personal",
      recommendation: "archive",
    });
    vi.spyOn(mail, "moveMail").mockResolvedValue({ message: "Moved 1 email.", folder: "Archive" });
    vi.spyOn(mail, "submitMailFeedback").mockResolvedValue({ status: "ok" });
    vi.spyOn(mailConfig, "getMailConfig").mockResolvedValue({ mail_model: "qwen3:8b", mail_preferences: "", available_models: ["qwen3:8b"] });
    vi.spyOn(mailConfig, "updateMailConfig").mockResolvedValue({ mail_model: "qwen3:8b", mail_preferences: "", available_models: ["qwen3:8b"] });
    vi.spyOn(localStorage, "getItem").mockImplementation((key) => (
      key === "myagent.session_id" ? "test-session" : null
    ));
    sessionStorage.clear();
  });

  it("renders mail heading and toolbar", async () => {
    render(<MemoryRouter><MailPage /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Mail" })).toBeInTheDocument();
  });

  it("renders the sync button", async () => {
    render(<MemoryRouter><MailPage /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "sync" })).toBeInTheDocument();
  });

  it("shows empty state when no accounts in dev mode", async () => {
    // DEV_MODE=true: no accounts → page shows empty state (no error).
    // The setup screen is skipped in dev mode so dev-seed can be used instead.
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    vi.spyOn(mail, "getMailPage").mockRejectedValue(new ApiError(404, "No saved mailbox"));

    render(<MemoryRouter><MailPage /></MemoryRouter>);

    // In DEV_MODE with no accounts, 404 is treated as empty state (not an error)
    expect(await screen.findByText(/No messages loaded/)).toBeInTheDocument();
  });

  it("loads saved mailbox on mount via getMailPage", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "Loaded saved mailbox.",
      emails: SAMPLE_EMAILS,
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });

    render(<MemoryRouter><MailPage /></MemoryRouter>);

    expect(await screen.findByText(/Server report/)).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("fetches mail via sync button", async () => {
    vi.spyOn(mail, "fetchMail").mockResolvedValue({
      content: "Found 1 email.",
      emails: SAMPLE_EMAILS,
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });

    render(<MemoryRouter><MailPage /></MemoryRouter>);
    const syncButton = await screen.findByRole("button", { name: "sync" });
    await waitFor(() => {
      expect(syncButton).not.toBeDisabled();
    });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText(/Server report/)).toBeInTheDocument();
    });
    expect(mail.fetchMail).toHaveBeenCalledWith({ account: "Personal", count: 10, preferences: "", folder: "Inbox" });
  });

  it("shows a visible error when mailbox fetch fails with non-404", async () => {
    vi.spyOn(mail, "getMailPage").mockRejectedValue(new ApiError(500, "Internal server error"));

    render(<MemoryRouter><MailPage /></MemoryRouter>);

    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
  });

  it("opens an email via the open button", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "Loaded saved mailbox.",
      emails: SAMPLE_EMAILS,
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });
    render(<MemoryRouter><MailPage /></MemoryRouter>);

    const openButton = await screen.findByRole("button", { name: "open" });
    fireEvent.click(openButton);

    expect(await screen.findByText("Deploy completed successfully.")).toBeInTheDocument();
    expect(mail.readMail).toHaveBeenLastCalledWith(1);
  });

  it("moves an email to archive from the detail panel", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "Loaded saved mailbox.",
      emails: SAMPLE_EMAILS,
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });

    render(<MemoryRouter><MailPage /></MemoryRouter>);

    const openButton = await screen.findByRole("button", { name: "open" });
    fireEvent.click(openButton);
    await screen.findByText("Deploy completed successfully.");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(mail.moveMail).toHaveBeenCalledWith([1], "Archive");
    });
  });

  it("shows AI preferences panel", async () => {
    render(<MemoryRouter><MailPage /></MemoryRouter>);
    const prefsButton = await screen.findByRole("button", { name: "AI preferences" });
    fireEvent.click(prefsButton);

    expect(screen.getByPlaceholderText(/prioritize reply/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "close" })).toBeInTheDocument();
  });

  it("filters emails client-side as you type in search", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "Loaded.",
      emails: [
        ...SAMPLE_EMAILS,
        {
          id: "message-2",
          index: 2,
          subject: "Lunch plans",
          from: "carol@example.com",
          date: "2026-04-18",
          account: "Personal",
          read: true,
        },
      ],
      page: 1,
      total_pages: 1,
      total_emails: 2,
    });

    render(<MemoryRouter><MailPage /></MemoryRouter>);
    await screen.findByText(/Server report/);
    expect(screen.getByText(/Lunch plans/)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Search emails...");
    fireEvent.change(searchInput, { target: { value: "Server" } });

    expect(screen.getByText(/Server report/)).toBeInTheDocument();
    expect(screen.queryByText(/Lunch plans/)).not.toBeInTheDocument();
  });

  it("calls searchMail on server search", async () => {
    vi.spyOn(mail, "searchMail").mockResolvedValue({
      emails: [{
        id: "search-1",
        index: 1,
        subject: "Found by server",
        from: "search@example.com",
        date: "2026-04-20",
        read: false,
      }],
    });

    render(<MemoryRouter><MailPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Mail" });

    const searchInput = screen.getByPlaceholderText("Search emails...");
    fireEvent.change(searchInput, { target: { value: "report" } });

    const searchBtn = screen.getByRole("button", { name: "search server" });
    expect(searchBtn).not.toBeDisabled();
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(mail.searchMail).toHaveBeenCalledWith({
        text: "report",
        account: "Personal",
        folder: "Inbox",
      });
    });
  });
});
