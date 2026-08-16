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

vi.mock("../../api/calendar", () => ({
  createEvent: vi.fn(),
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
    vi.spyOn(mailConfig, "getMailConfig").mockResolvedValue({ mail_model: "qwen3:8b", mail_preferences: "", available_models: ["qwen3:8b"], ai_config_id: null });
    vi.spyOn(mailConfig, "updateMailConfig").mockResolvedValue({ mail_model: "qwen3:8b", mail_preferences: "", available_models: ["qwen3:8b"], ai_config_id: null });
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

  // Bug #2 (dev buttons leaking in prod builds): the fix is to AND
  // `import.meta.env.DEV` (false in `vite build`) with `VITE_DEV_MODE`.
  // We do not add a unit test for this: `import.meta.env.DEV` is resolved
  // at module load by Vite, and stubbing it after import has no effect on
  // the captured `DEV_MODE` constant. Verifying requires a production
  // build (`npm run build` + serve) which lives in the integration tier.
  // The behavior is asserted by code inspection of line ~13 of MailPage.tsx.

  it("shows setup banner when no accounts are configured (bug #4)", async () => {
    // Bug #4: with no IMAP accounts, the onboarding banner must show even
    // in DEV_MODE (was previously gated behind !DEV_MODE which left dev
    // users on a blank list with no prompt).
    vi.spyOn(imap, "listImapAccounts").mockResolvedValue([]);
    vi.spyOn(mail, "getMailPage").mockRejectedValue(new ApiError(404, "No saved mailbox"));

    render(<MemoryRouter><MailPage /></MemoryRouter>);

    expect(await screen.findByText(/No IMAP accounts are configured/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Set up IMAP/i })).toBeInTheDocument();
  });

  it("re-analyze button title explains the loading-disabled state (bug #5)", async () => {
    // Bug #5: previously the title only covered the "no emails loaded"
    // case. The loading case must also have explanatory copy.
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "Loaded saved mailbox.",
      emails: SAMPLE_EMAILS,
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });
    // fetchMail never resolves so state.loading stays true after we click sync.
    vi.spyOn(mail, "fetchMail").mockReturnValue(new Promise(() => {}));

    render(<MemoryRouter><MailPage /></MemoryRouter>);
    const syncButton = await screen.findByRole("button", { name: "sync" });
    await waitFor(() => expect(syncButton).not.toBeDisabled());
    fireEvent.click(syncButton);

    const reanalyzeBtn = await screen.findByRole("button", { name: /re-analyze/i });
    await waitFor(() => {
      expect(reanalyzeBtn).toBeDisabled();
      expect(reanalyzeBtn.getAttribute("title") ?? "").toMatch(/wait for the current operation/i);
    });
  });

  it("server-search button title distinguishes it from the inline filter (bug #16)", async () => {
    render(<MemoryRouter><MailPage /></MemoryRouter>);
    const searchBtn = await screen.findByRole("button", { name: /search all mail/i });
    expect(searchBtn.getAttribute("title") ?? "").toMatch(/typing filters loaded emails/i);
    expect(searchBtn.getAttribute("title") ?? "").toMatch(/imap server/i);
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
    expect(mail.fetchMail).toHaveBeenCalledWith({ account: "Personal", count: 100, fetch_all: false, incremental: true, unread_only: false, preferences: "", folder: "Inbox" });
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

  it("shows an error banner without crashing when readMail returns 404 (bug #6)", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "Loaded saved mailbox.",
      emails: SAMPLE_EMAILS,
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });
    vi.spyOn(mail, "readMail").mockRejectedValue(new ApiError(404, "No active mail session"));

    render(<MemoryRouter><MailPage /></MemoryRouter>);

    const openButton = await screen.findByRole("button", { name: "open" });
    fireEvent.click(openButton);

    // (a) page does not crash — list still rendered
    expect(await screen.findByRole("alert")).toHaveTextContent(/Mail session not active/i);
    expect(screen.getByText(/Server report/)).toBeInTheDocument();
    // (b) no detail pane opened (no spurious selection)
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("surfaces server error message when readMail rejects with non-404 error", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "Loaded saved mailbox.",
      emails: SAMPLE_EMAILS,
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });
    vi.spyOn(mail, "readMail").mockRejectedValue(new ApiError(500, "Backend exploded"));

    render(<MemoryRouter><MailPage /></MemoryRouter>);

    const openButton = await screen.findByRole("button", { name: "open" });
    fireEvent.click(openButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("Backend exploded");
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

    const searchBtn = screen.getByRole("button", { name: /search all mail/i });
    await waitFor(() => expect(searchBtn).not.toBeDisabled());
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(mail.searchMail).toHaveBeenCalledWith({
        text: "report",
        account: "Personal",
        folder: "Inbox",
      });
    });
  });

  // ── Mail cleanup flow ─────────────────────────────────────────
  // The user's invariant: "delete" must NEVER expunge — it always routes
  // to the Trash folder via moveMail. These tests lock that in.

  function withRecommendation(rec: string, folder?: string) {
    return {
      ...SAMPLE_EMAILS[0],
      recommendation: rec,
      recommended_folder: folder,
    };
  }

  // ── Bug #7: "N/A" recommendation ──────────────────────────────
  // The backend always writes an action when analysis runs — it falls back to
  // "review" even when the LLM call throws — so a blank recommendation means the
  // email came from a fetch with analyze=false, not that analysis failed.

  it("labels an unanalyzed email 'not analyzed' rather than 'N/A'", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "ok",
      emails: [{
        id: "message-2",
        index: 1,
        subject: "Unanalyzed",
        from: "ops@example.com",
        date: "2026-04-19",
        account: "Personal",
        read: false,
      }],
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });
    render(<MemoryRouter><MailPage /></MemoryRouter>);
    expect(await screen.findByText("not analyzed")).toBeInTheDocument();
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();
  });

  it("still shows the recommendation when analysis has run", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "ok",
      emails: [withRecommendation("archive")],
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });
    render(<MemoryRouter><MailPage /></MemoryRouter>);
    expect(await screen.findByText("archive")).toBeInTheDocument();
    expect(screen.queryByText("not analyzed")).not.toBeInTheDocument();
  });

  it("apply button on a 'delete' recommendation routes to Trash, never expunges", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "ok",
      emails: [withRecommendation("delete")],
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });

    render(<MemoryRouter><MailPage /></MemoryRouter>);
    const applyBtn = await screen.findByRole("button", { name: /^✓ apply$/ });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mail.moveMail).toHaveBeenCalledWith([1], "Trash");
    });
    // No bulk-delete or expunge API exists on the mail client surface; this
    // assertion is here so a future maintainer who adds one will surface a
    // failing test if they accidentally wire it into the delete path.
    const moveCalls = vi.mocked(mail.moveMail).mock.calls;
    expect(moveCalls.every((c) => c[1] === "Trash" || c[1] === "Archive")).toBe(true);
  });

  it("apply button on an 'archive' recommendation uses the recommended folder", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "ok",
      emails: [withRecommendation("archive", "Archive/2026")],
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });

    render(<MemoryRouter><MailPage /></MemoryRouter>);
    const applyBtn = await screen.findByRole("button", { name: /^✓ apply$/ });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mail.moveMail).toHaveBeenCalledWith([1], "Archive/2026");
    });
  });

  it("apply-all button is disabled when no actionable recommendations exist", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "ok",
      emails: [withRecommendation("reply")],
      page: 1,
      total_pages: 1,
      total_emails: 1,
    });

    render(<MemoryRouter><MailPage /></MemoryRouter>);
    const applyAll = await screen.findByRole("button", { name: /^✓ apply all$/ });
    expect(applyAll).toBeDisabled();
  });

  it("+ all calendar button creates one event per add_to_calendar suggestion", async () => {
    const mod = await import("../../api/calendar");
    const createEventSpy = vi.spyOn(mod, "createEvent").mockResolvedValue({
      id: "evt-1", title: "x", date: "2026-06-09",
    });
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "ok",
      emails: [
        {
          ...SAMPLE_EMAILS[0],
          index: 1,
          suggested_actions: [
            { type: "add_to_calendar", title: "Lunch w/ Alex", date: "2026-06-10" },
            { type: "add_to_calendar", title: "Demo prep", date: "2026-06-11", time: "14:00" },
          ],
        },
        {
          ...SAMPLE_EMAILS[0],
          index: 2,
          suggested_actions: [
            { type: "add_to_calendar", title: "1:1", date: "2026-06-12" },
          ],
        },
      ],
      page: 1,
      total_pages: 1,
      total_emails: 2,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MemoryRouter><MailPage /></MemoryRouter>);
    const allCal = await screen.findByRole("button", { name: /^\+ all calendar$/ });
    await waitFor(() => expect(allCal).not.toBeDisabled());
    fireEvent.click(allCal);

    await waitFor(() => {
      expect(createEventSpy).toHaveBeenCalledTimes(3);
    });
    expect(createEventSpy).toHaveBeenCalledWith({ title: "Lunch w/ Alex", date: "2026-06-10", time: undefined });
    expect(createEventSpy).toHaveBeenCalledWith({ title: "Demo prep", date: "2026-06-11", time: "14:00" });
    expect(createEventSpy).toHaveBeenCalledWith({ title: "1:1", date: "2026-06-12", time: undefined });
  });

  it("apply-all runs delete→Trash + archive→folder for actionable rows when confirmed", async () => {
    vi.spyOn(mail, "getMailPage").mockResolvedValue({
      content: "ok",
      emails: [
        { ...withRecommendation("delete"), index: 1 },
        { ...withRecommendation("archive", "Archive"), index: 2 },
        { ...withRecommendation("reply"), index: 3 },
      ],
      page: 1,
      total_pages: 1,
      total_emails: 3,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MemoryRouter><MailPage /></MemoryRouter>);
    const applyAll = await screen.findByRole("button", { name: /^✓ apply all$/ });
    await waitFor(() => expect(applyAll).not.toBeDisabled());
    fireEvent.click(applyAll);

    await waitFor(() => {
      expect(mail.moveMail).toHaveBeenCalledWith([1], "Trash");
      expect(mail.moveMail).toHaveBeenCalledWith([2], "Archive");
    });
    // The 'reply' row is left alone — bulk mode skips human-decision actions.
    expect(mail.moveMail).not.toHaveBeenCalledWith([3], expect.anything());
  });
});
