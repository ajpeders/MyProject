import { useReducer, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { listImapAccounts } from "../../api/imap";
import type { ImapAccount } from "../../api/imap";
import { analyzeMail, devSeedMail, downloadAttachment, fetchMail, fetchMailOnly, getMailFolders, getMailPage, moveMail, readMail, searchMail, submitMailFeedback, type AttachmentMeta, type MailSummary, type SuggestedAction } from "../../api/mail";
import { createEvent } from "../../api/calendar";
import { getMailConfig, updateMailConfig } from "../../api/mailConfig";
import { useSyncProgress } from "./useSyncProgress";

const COMMON_FOLDERS = ["Inbox", "Archive", "Trash", "Spam", "Sent", "Drafts"];
const REC_PRIORITY: Record<string, number> = { reply: 0, todo: 1, calendar: 2, review: 3, archive: 4, delete: 5 };
// DEV_MODE gates dev-only UI (seed buttons, re-analyze, fetch-only). We
// require BOTH the explicit VITE_DEV_MODE opt-in AND Vite's built-in DEV
// flag so production builds never leak these affordances even if a stale
// .env leaves VITE_DEV_MODE=true.
const DEV_MODE = import.meta.env.DEV && import.meta.env.VITE_DEV_MODE === "true";

function sortEmailsNewestFirst(emails: MailSummary[]): MailSummary[] {
  return [...emails].sort((a, b) => {
    const aTime = a.date ? Date.parse(a.date) : Number.NaN;
    const bTime = b.date ? Date.parse(b.date) : Number.NaN;
    const aIndex = a.index ?? 0;
    const bIndex = b.index ?? 0;

    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }
    if (Number.isFinite(aTime) && !Number.isFinite(bTime)) return -1;
    if (!Number.isFinite(aTime) && Number.isFinite(bTime)) return 1;
    return bIndex - aIndex;
  });
}

function loadCachedEmails(): MailSummary[] {
  try {
    const raw = sessionStorage.getItem("myagent.emails");
    return raw ? sortEmailsNewestFirst(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function saveCachedEmails(emails: MailSummary[]) {
  sessionStorage.setItem("myagent.emails", JSON.stringify(sortEmailsNewestFirst(emails)));
}

function recommendationLabel(email: MailSummary) {
  return email.recommendation?.trim() || "N/A";
}

function recommendationClass(email: MailSummary) {
  return email.recommendation?.trim().toLowerCase() || "none";
}

function needsAnalysis(email: MailSummary) {
  return !email.recommendation?.trim() && !email.summary?.trim() && !email.recommended_todo?.trim();
}

function hasAnalysis(email: MailSummary) {
  return !needsAnalysis(email);
}

function shouldHighlightOpen(email: MailSummary) {
  return ["reply", "review", "archive", "todo", "calendar"].includes(recommendationClass(email));
}

function renderLinkedText(content: string) {
  const parts = content.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="mail-body-link"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// ─── State ───────────────────────────────────────────────────────────────────

interface MailState {
  emails: MailSummary[];
  page: number | null;
  totalPages: number | null;
  totalEmails: number | null;
  loading: boolean;
  error: string;
  selectedIndex: number | null;
  emailContent: string;
  emailContentHtml: string;
  highlightedPos: number;
  accounts: ImapAccount[];
  activeAccount: string;
  activeFolder: string;
  accountsLoaded: boolean;
  folders: string[];
  mailChecked: boolean;
  setupRequired: boolean;
  authError: boolean;
  confirmDelete: boolean;
  moveFolder: string;
  actionLoading: boolean;
  actionError: string;
  loadingLabel: string;
  preferences: string;
  draftPreferences: string;
  preferencesOpen: boolean;
  preferencesSaving: boolean;
  preferencesNotice: string;
  feedbackSaving: boolean;
  feedbackNotice: string;
  feedbackText: string;
  searchQuery: string;
  unreadOnly: boolean;
  sortMode: "time" | "importance" | "recommendation";
  selectedIndices: Set<number>;
  attachments: AttachmentMeta[];
}

const initialMailState = (cachedEmails: MailSummary[]): MailState => ({
  emails: cachedEmails,
  page: null,
  totalPages: null,
  totalEmails: null,
  loading: false,
  error: "",
  selectedIndex: null,
  emailContent: sessionStorage.getItem("myagent.content") ?? "",
  emailContentHtml: "",
  highlightedPos: 0,
  accounts: [],
  activeAccount: "",
  activeFolder: "Inbox",
  accountsLoaded: false,
  folders: [],
  mailChecked: cachedEmails.length > 0,
  setupRequired: false,
  authError: false,
  confirmDelete: false,
  moveFolder: "",
  actionLoading: false,
  actionError: "",
  loadingLabel: "",
  preferences: "",
  draftPreferences: "",
  preferencesOpen: false,
  preferencesSaving: false,
  preferencesNotice: "",
  feedbackSaving: false,
  feedbackNotice: "",
  feedbackText: "",
  searchQuery: "",
  unreadOnly: false,
  sortMode: "time",
  selectedIndices: new Set(),
  attachments: [],
});

// ─── Actions ─────────────────────────────────────────────────────────────────

type MailAction =
  | { type: "SET_EMAILS"; emails: MailSummary[]; page: number | null; totalPages: number | null; totalEmails: number | null; content?: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string }
  | { type: "OPEN_EMAIL"; index: number; content: string; contentHtml: string; attachments: AttachmentMeta[] }
  | { type: "CLOSE_EMAIL" }
  | { type: "SET_HIGHLIGHTED_POS"; pos: number }
  | { type: "SET_FOLDERS"; folders: string[] }
  | { type: "SET_ACCOUNTS"; accounts: ImapAccount[] }
  | { type: "SET_ACTIVE_ACCOUNT"; name: string }
  | { type: "SET_ACTIVE_FOLDER"; folder: string }
  | { type: "SET_ACCOUNTS_LOADED" }
  | { type: "SET_MAIL_CHECKED" }
  | { type: "SET_AUTH_ERROR" }
  | { type: "SET_SETUP_REQUIRED" }
  | { type: "SET_CONFIRM_DELETE"; value: boolean }
  | { type: "SET_MOVE_FOLDER"; folder: string }
  | { type: "SET_ACTION_LOADING"; value: boolean }
  | { type: "SET_ACTION_ERROR"; error: string }
  | { type: "SET_LOADING_LABEL"; value: string }
  | { type: "SET_PREFERENCES"; value: string }
  | { type: "SET_DRAFT_PREFERENCES"; value: string }
  | { type: "SET_PREFERENCES_OPEN"; value: boolean }
  | { type: "SET_PREFERENCES_SAVING"; value: boolean }
  | { type: "SET_PREFERENCES_NOTICE"; value: string }
  | { type: "SET_FEEDBACK_SAVING"; value: boolean }
  | { type: "SET_FEEDBACK_NOTICE"; value: string }
  | { type: "SET_FEEDBACK_TEXT"; value: string }
  | { type: "SET_SEARCH_QUERY"; value: string }
  | { type: "SET_UNREAD_ONLY"; value: boolean }
  | { type: "SET_SORT_MODE"; value: "time" | "importance" | "recommendation" }
  | { type: "TOGGLE_SELECT"; index: number }
  | { type: "SELECT_ALL"; indices: number[] }
  | { type: "CLEAR_SELECTION" }
  | { type: "REMOVE_EMAIL"; index: number }
  | { type: "CLEAR_VIEW" }
  | { type: "RESET_MAIL_CHECKED" }
  | { type: "SET_SETUP_CLEARED" };

function mailReducer(state: MailState, action: MailAction): MailState {
  switch (action.type) {
    case "SET_EMAILS":
      return {
        ...state,
        emails: sortEmailsNewestFirst(action.emails),
        page: action.page,
        totalPages: action.totalPages,
        totalEmails: action.totalEmails,
        emailContent: action.content ?? state.emailContent,
        highlightedPos: 0,
        selectedIndices: new Set(),
      };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "OPEN_EMAIL":
      return {
        ...state,
        emails: state.emails.map((email) =>
          email.index === action.index ? { ...email, read: true } : email
        ),
        selectedIndex: action.index,
        emailContent: action.content,
        emailContentHtml: action.contentHtml,
        attachments: action.attachments,
        confirmDelete: false,
        moveFolder: "",
        actionError: "",
        feedbackText: "",
        feedbackNotice: "",
      };
    case "CLOSE_EMAIL":
      return {
        ...state,
        selectedIndex: null,
        emailContent: "",
        emailContentHtml: "",
        confirmDelete: false,
        moveFolder: "",
        actionError: "",
        feedbackText: "",
        feedbackNotice: "",
      };
    case "SET_HIGHLIGHTED_POS":
      return { ...state, highlightedPos: action.pos };
    case "SET_FOLDERS":
      return { ...state, folders: action.folders };
    case "SET_ACCOUNTS":
      return {
        ...state,
        accounts: action.accounts,
        accountsLoaded: true,
      };
    case "SET_ACTIVE_ACCOUNT":
      return { ...state, activeAccount: action.name };
    case "SET_ACTIVE_FOLDER":
      return { ...state, activeFolder: action.folder };
    case "SET_ACCOUNTS_LOADED":
      return { ...state, accountsLoaded: true };
    case "SET_MAIL_CHECKED":
      return { ...state, mailChecked: true };
    case "SET_AUTH_ERROR":
      return { ...state, authError: true, mailChecked: true };
    case "SET_SETUP_REQUIRED":
      return { ...state, setupRequired: true, mailChecked: true };
    case "SET_CONFIRM_DELETE":
      return { ...state, confirmDelete: action.value };
    case "SET_MOVE_FOLDER":
      return { ...state, moveFolder: action.folder };
    case "SET_ACTION_LOADING":
      return { ...state, actionLoading: action.value };
    case "SET_ACTION_ERROR":
      return { ...state, actionError: action.error };
    case "SET_LOADING_LABEL":
      return { ...state, loadingLabel: action.value };
    case "SET_PREFERENCES":
      return { ...state, preferences: action.value, draftPreferences: action.value };
    case "SET_DRAFT_PREFERENCES":
      return { ...state, draftPreferences: action.value };
    case "SET_PREFERENCES_OPEN":
      return { ...state, preferencesOpen: action.value };
    case "SET_PREFERENCES_SAVING":
      return { ...state, preferencesSaving: action.value };
    case "SET_PREFERENCES_NOTICE":
      return { ...state, preferencesNotice: action.value };
    case "SET_FEEDBACK_SAVING":
      return { ...state, feedbackSaving: action.value };
    case "SET_FEEDBACK_NOTICE":
      return { ...state, feedbackNotice: action.value };
    case "SET_FEEDBACK_TEXT":
      return { ...state, feedbackText: action.value };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.value, highlightedPos: 0 };
    case "SET_UNREAD_ONLY":
      return { ...state, unreadOnly: action.value, highlightedPos: 0 };
    case "SET_SORT_MODE":
      return { ...state, sortMode: action.value, highlightedPos: 0 };
    case "TOGGLE_SELECT": {
      const next = new Set(state.selectedIndices);
      if (next.has(action.index)) next.delete(action.index);
      else next.add(action.index);
      return { ...state, selectedIndices: next };
    }
    case "SELECT_ALL":
      return { ...state, selectedIndices: new Set(action.indices) };
    case "CLEAR_SELECTION":
      return { ...state, selectedIndices: new Set() };
    case "REMOVE_EMAIL": {
      const next = state.emails.filter((e) => e.index !== action.index);
      return {
        ...state,
        emails: next,
        totalEmails: state.totalEmails !== null ? state.totalEmails - 1 : null,
        selectedIndex: state.selectedIndex === action.index ? null : state.selectedIndex,
        emailContent: state.selectedIndex === action.index ? "" : state.emailContent,
      };
    }
    case "CLEAR_VIEW":
      sessionStorage.removeItem("myagent.emails");
      return {
        ...state,
        emails: [],
        page: null,
        totalPages: null,
        totalEmails: null,
        error: "",
        selectedIndex: null,
        emailContent: "",
        highlightedPos: 0,
        loadingLabel: "",
        feedbackText: "",
        feedbackNotice: "",
      };
    case "RESET_MAIL_CHECKED":
      return { ...state, mailChecked: false, setupRequired: false };
    case "SET_SETUP_CLEARED":
      return { ...state, setupRequired: false };
    default:
      return state;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MailPage() {
  const cachedEmails = useMemo(loadCachedEmails, []);

  const [state, dispatch] = useReducer(mailReducer, cachedEmails, initialMailState);
  const initialLoadAttemptedRef = useRef(false);

  const syncProgress = useSyncProgress();

  // Refs to avoid stale closures
  const stateRef = useRef(state);
  stateRef.current = state;
  const openEmailRef = useRef<(index: number) => void>(() => {});
  const closeEmailRef = useRef<() => void>(() => {});

  // Derived values
  const filteredEmails = useMemo(() => {
    let result = state.emails;
    if (state.activeAccount) {
      result = result.filter((e) => e.account === state.activeAccount);
    }
    if (state.unreadOnly) {
      result = result.filter((e) => e.read === false);
    }
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((e) =>
        (e.from ?? "").toLowerCase().includes(q) ||
        (e.subject ?? "").toLowerCase().includes(q) ||
        (e.summary ?? "").toLowerCase().includes(q) ||
        (e.date ?? "").toLowerCase().includes(q)
      );
    }
    if (state.sortMode === "importance") {
      result = [...result].sort((a, b) => {
        const diff = (b.importance ?? 3) - (a.importance ?? 3);
        if (diff !== 0) return diff;
        return (b.date ?? "").localeCompare(a.date ?? "");
      });
    } else if (state.sortMode === "recommendation") {
      result = [...result].sort((a, b) => {
        const aP = REC_PRIORITY[recommendationClass(a)] ?? 6;
        const bP = REC_PRIORITY[recommendationClass(b)] ?? 6;
        if (aP !== bP) return aP - bP;
        return (b.date ?? "").localeCompare(a.date ?? "");
      });
    }
    // "time" is the default — emails already sorted newest-first from SET_EMAILS
    return result;
  }, [state.emails, state.activeAccount, state.unreadOnly, state.searchQuery, state.sortMode]);

  const accountNames = useMemo(() => {
    const names = new Set<string>();
    for (const e of state.emails) if (e.account) names.add(e.account);
    return [...names];
  }, [state.emails]);

  const status = useMemo(() => {
    if (state.loading) return state.loadingLabel || "Working...";
    if (state.error) return "Error";
    if (state.totalEmails !== null) return `${filteredEmails.length} email${filteredEmails.length === 1 ? "" : "s"}`;
    return "Ready";
  }, [state.loading, state.loadingLabel, state.error, state.totalEmails, filteredEmails.length]);

  const unreadCount = useMemo(
    () => filteredEmails.filter((email) => email.read === false).length,
    [filteredEmails]
  );
  const totalCount = filteredEmails.length;

  const selectedEmail = state.selectedIndex !== null
    ? state.emails.find((e) => e.index === state.selectedIndex) ?? null
    : null;
  const detailOpen = state.selectedIndex !== null && selectedEmail !== null;

  // Load accounts and folders on mount
  useEffect(() => {
    listImapAccounts()
      .then((data) => {
        dispatch({ type: "SET_ACCOUNTS", accounts: data });
        if (data.length > 0) {
          dispatch({ type: "SET_ACTIVE_ACCOUNT", name: data[0].name });
        } else if (cachedEmails.length === 0) {
          // Show the onboarding banner whenever no IMAP accounts are
          // configured — including in DEV_MODE. Previously gated by
          // !DEV_MODE which left dev users on a blank list with no prompt.
          dispatch({ type: "SET_SETUP_REQUIRED" });
        }
      })
      .catch(() => {})
      .finally(() => dispatch({ type: "SET_ACCOUNTS_LOADED" }));
  }, []);

  useEffect(() => {
    getMailConfig()
      .then((config) => dispatch({ type: "SET_PREFERENCES", value: config.mail_preferences ?? "" }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getMailFolders(state.activeAccount)
      .then((data) => dispatch({ type: "SET_FOLDERS", folders: data.folders }))
      .catch(() => dispatch({ type: "SET_FOLDERS", folders: COMMON_FOLDERS }));
  }, [state.activeAccount]);

  // Load any saved mailbox state on mount. If there is no saved state,
  // the backend route falls back to sync outside dev mode.
  useEffect(() => {
    if (!state.accountsLoaded || initialLoadAttemptedRef.current) return;
    initialLoadAttemptedRef.current = true;
    void loadMailPage(1, { allowFetchFallback: !DEV_MODE });
  }, [state.accountsLoaded]);

  // Re-fetch when folder changes (skip the initial load)
  const prevFolderRef = useRef(state.activeFolder);
  useEffect(() => {
    if (prevFolderRef.current === state.activeFolder) return;
    prevFolderRef.current = state.activeFolder;
    if (!state.accountsLoaded) return;
    dispatch({ type: "CLEAR_VIEW" });
    void fetchLatestMail();
  }, [state.activeFolder]);

  // Keyboard handler — uses refs to avoid stale closures and excessive re-registration
  const filteredEmailsRef = useRef(filteredEmails);
  filteredEmailsRef.current = filteredEmails;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const cur = stateRef.current;
      const emails = filteredEmailsRef.current;
      if (cur.selectedIndex !== null) {
        if (e.key === "Escape") closeEmailRef.current();
        return;
      }
      if (e.key === "j") {
        e.preventDefault();
        if (emails.length > 0) {
          dispatch({ type: "SET_HIGHLIGHTED_POS", pos: Math.min(cur.highlightedPos + 1, emails.length - 1) });
        }
      } else if (e.key === "k") {
        e.preventDefault();
        if (emails.length > 0) {
          dispatch({ type: "SET_HIGHLIGHTED_POS", pos: Math.max(cur.highlightedPos - 1, 0) });
        }
      } else if (e.key === "Enter" && emails.length > 0 && emails[cur.highlightedPos]) {
        openEmailRef.current(emails[cur.highlightedPos].index);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Update refs when handlers change
  useEffect(() => {
    openEmailRef.current = async (index: number) => {
      dispatch({ type: "SET_LOADING", loading: true });
      dispatch({ type: "SET_LOADING_LABEL", value: "Loading message..." });
      dispatch({ type: "SET_ERROR", error: "" });
      try {
        const response = await readMail(index);
        // Defensive guards: backend may return malformed/empty body on edge cases.
        if (!response || typeof response !== "object") {
          throw new Error("Mail server returned an empty response.");
        }
        const content = (typeof response.body === "string" && response.body) || "No content available.";
        const contentHtml = typeof response.body_html === "string" ? response.body_html : "";
        const attachments = Array.isArray(response.attachments) ? response.attachments : [];
        const nextEmails = stateRef.current.emails.map((email) =>
          email.index === index ? { ...email, read: true } : email
        );
        saveCachedEmails(nextEmails);
        dispatch({ type: "OPEN_EMAIL", index, content, contentHtml, attachments });
        sessionStorage.setItem("myagent.content", content);
      } catch (err) {
        let message: string;
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
          message = "Mail session not active — hit sync, or open settings to configure an IMAP account.";
        } else if (err instanceof Error && err.message) {
          message = err.message;
        } else {
          message = "Failed to load email.";
        }
        dispatch({ type: "SET_ERROR", error: message });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
        dispatch({ type: "SET_LOADING_LABEL", value: "" });
      }
    };
    closeEmailRef.current = () => {
      dispatch({ type: "CLOSE_EMAIL" });
    };
  }, []);

  async function loadMailPage(nextPage: number, options?: { allowFetchFallback?: boolean }) {
    if (!state.accountsLoaded || state.setupRequired) return;
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_LOADING_LABEL", value: "Loading saved mailbox view..." });
    dispatch({ type: "SET_ERROR", error: "" });
    try {
      const response = await getMailPage(nextPage);
      dispatch({
        type: "SET_EMAILS",
        emails: response.emails,
        page: response.page,
        totalPages: response.total_pages,
        totalEmails: response.total_emails,
      });
      saveCachedEmails(response.emails);
      dispatch({ type: "SET_MAIL_CHECKED" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        if (options?.allowFetchFallback) {
          await fetchLatestMail();
          return;
        }
        // No saved session yet — show empty state, not an error
        dispatch({ type: "SET_MAIL_CHECKED" });
        return;
      }
      dispatch({ type: "SET_MAIL_CHECKED" });
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Failed to load mail" });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
      dispatch({ type: "SET_LOADING_LABEL", value: "" });
    }
  }

  async function fetchLatestMail() {
    const current = stateRef.current;
    if (!current.accountsLoaded) return;
    syncProgress.start("sync");
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_LOADING_LABEL", value: "Syncing mailbox..." });
    dispatch({ type: "SET_ERROR", error: "" });
    try {
      const accountName = current.activeAccount;
      const response = await fetchMail({ account: accountName, count: 10, unread_only: current.unreadOnly, preferences: current.preferences, folder: current.activeFolder });
      dispatch({
        type: "SET_EMAILS",
        emails: response.emails,
        page: response.page,
        totalPages: response.total_pages,
        totalEmails: response.total_emails,
      });
      saveCachedEmails(response.emails);
      dispatch({ type: "SET_MAIL_CHECKED" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        dispatch({ type: "SET_AUTH_ERROR" });
      } else if (current.accounts.length === 0 && err instanceof ApiError && err.status === 400) {
        if (DEV_MODE) {
          await seedDevMail();
          return;
        }
        dispatch({ type: "SET_SETUP_REQUIRED" });
      } else {
        dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Failed to fetch mail" });
      }
      dispatch({ type: "SET_MAIL_CHECKED" });
    } finally {
      syncProgress.finish();
      dispatch({ type: "SET_LOADING", loading: false });
      dispatch({ type: "SET_LOADING_LABEL", value: "" });
    }
  }

  async function handleMove(index: number, folder: string) {
    dispatch({ type: "SET_ACTION_LOADING", value: true });
    dispatch({ type: "SET_ACTION_ERROR", error: "" });
    try {
      await moveMail([index], folder);
      dispatch({ type: "REMOVE_EMAIL", index });
      const next = stateRef.current.emails.filter((e) => e.index !== index);
      saveCachedEmails(next);
      dispatch({ type: "CLOSE_EMAIL" });
    } catch (err) {
      dispatch({ type: "SET_ACTION_ERROR", error: err instanceof Error ? err.message : "Move failed" });
      dispatch({ type: "SET_CONFIRM_DELETE", value: false });
    } finally {
      dispatch({ type: "SET_ACTION_LOADING", value: false });
    }
  }

  async function handleBulkMove(folder: string) {
    const indices = [...stateRef.current.selectedIndices];
    if (indices.length === 0) return;
    dispatch({ type: "SET_ACTION_LOADING", value: true });
    dispatch({ type: "SET_ACTION_ERROR", error: "" });
    try {
      await moveMail(indices, folder);
      for (const idx of indices) dispatch({ type: "REMOVE_EMAIL", index: idx });
      const remaining = stateRef.current.emails.filter((e) => !indices.includes(e.index));
      saveCachedEmails(remaining);
      dispatch({ type: "CLEAR_SELECTION" });
      dispatch({ type: "CLOSE_EMAIL" });
    } catch (err) {
      dispatch({ type: "SET_ACTION_ERROR", error: err instanceof Error ? err.message : "Bulk move failed" });
    } finally {
      dispatch({ type: "SET_ACTION_LOADING", value: false });
    }
  }

  async function handleFetchOnly() {
    syncProgress.start("fetch");
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_LOADING_LABEL", value: "Fetching emails (no analysis)..." });
    dispatch({ type: "SET_ERROR", error: "" });
    try {
      const response = await fetchMailOnly({ count: 10, unread_only: stateRef.current.unreadOnly, folder: stateRef.current.activeFolder });
      dispatch({
        type: "SET_EMAILS",
        emails: response.emails,
        page: response.page,
        totalPages: response.total_pages,
        totalEmails: response.total_emails,
      });
      saveCachedEmails(response.emails);
      dispatch({ type: "SET_MAIL_CHECKED" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        if (DEV_MODE) {
          await seedDevMail();
          return;
        }
        dispatch({ type: "SET_SETUP_REQUIRED" });
      } else {
        dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Fetch failed" });
      }
      dispatch({ type: "SET_MAIL_CHECKED" });
    } finally {
      syncProgress.finish();
      dispatch({ type: "SET_LOADING", loading: false });
      dispatch({ type: "SET_LOADING_LABEL", value: "" });
    }
  }

  async function seedDevMail() {
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_LOADING_LABEL", value: "Seeding dev emails..." });
    dispatch({ type: "SET_ERROR", error: "" });
    try {
      const response = await devSeedMail();
      dispatch({
        type: "SET_EMAILS",
        emails: response.emails,
        page: response.page,
        totalPages: response.total_pages,
        totalEmails: response.total_emails,
      });
      saveCachedEmails(response.emails);
      dispatch({ type: "SET_MAIL_CHECKED" });
      dispatch({ type: "SET_SETUP_CLEARED" });
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Failed to seed" });
      dispatch({ type: "SET_MAIL_CHECKED" });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
      dispatch({ type: "SET_LOADING_LABEL", value: "" });
    }
  }

  async function handleAnalyze() {
    syncProgress.start("analyze");
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_LOADING_LABEL", value: "Analyzing emails with AI..." });
    dispatch({ type: "SET_ERROR", error: "" });
    try {
      const response = await analyzeMail({ preferences: stateRef.current.preferences });
      dispatch({
        type: "SET_EMAILS",
        emails: response.emails,
        page: response.page,
        totalPages: response.total_pages,
        totalEmails: response.total_emails,
      });
      saveCachedEmails(response.emails);
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Analysis failed" });
    } finally {
      syncProgress.finish();
      dispatch({ type: "SET_LOADING", loading: false });
      dispatch({ type: "SET_LOADING_LABEL", value: "" });
    }
  }

  async function handleServerSearch() {
    const query = stateRef.current.searchQuery.trim();
    if (!query) return;
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_LOADING_LABEL", value: "Searching server..." });
    dispatch({ type: "SET_ERROR", error: "" });
    try {
      const current = stateRef.current;
      const response = await searchMail({
        text: query,
        account: current.activeAccount,
        folder: current.activeFolder,
      });
      dispatch({
        type: "SET_EMAILS",
        emails: response.emails,
        page: 1,
        totalPages: 1,
        totalEmails: response.emails.length,
      });
      saveCachedEmails(response.emails);
      dispatch({ type: "SET_SEARCH_QUERY", value: "" });
      dispatch({ type: "SET_MAIL_CHECKED" });
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Search failed" });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
      dispatch({ type: "SET_LOADING_LABEL", value: "" });
    }
  }

  function clearView() {
    dispatch({ type: "CLEAR_VIEW" });
  }

  async function handleSuggestedAction(action: SuggestedAction, emailSubject?: string) {
    if (action.type === "add_to_calendar") {
      try {
        await createEvent({
          title: action.title || emailSubject || "Event from email",
          date: action.date || "",
          time: action.time,
        });
        dispatch({ type: "SET_ACTION_ERROR", error: "" });
        dispatch({ type: "SET_FEEDBACK_NOTICE", value: `Added "${action.title || emailSubject}" to calendar.` });
      } catch (err) {
        dispatch({ type: "SET_ACTION_ERROR", error: err instanceof Error ? err.message : "Failed to add to calendar" });
      }
    }
  }

  async function handleSavePreferences() {
    dispatch({ type: "SET_PREFERENCES_SAVING", value: true });
    dispatch({ type: "SET_PREFERENCES_NOTICE", value: "" });
    try {
      const config = await getMailConfig();
      const response = await updateMailConfig(config.mail_model, state.draftPreferences);
      dispatch({ type: "SET_PREFERENCES", value: response.mail_preferences ?? "" });
      dispatch({ type: "SET_PREFERENCES_OPEN", value: false });
      dispatch({ type: "SET_PREFERENCES_NOTICE", value: "AI preferences saved." });
    } catch (err) {
      dispatch({ type: "SET_PREFERENCES_NOTICE", value: err instanceof Error ? err.message : "Failed to save AI preferences." });
    } finally {
      dispatch({ type: "SET_PREFERENCES_SAVING", value: false });
    }
  }

  async function handleFeedback(index: number, verdict: "good" | "bad") {
    dispatch({ type: "SET_FEEDBACK_SAVING", value: true });
    dispatch({ type: "SET_FEEDBACK_NOTICE", value: "" });
    try {
      await submitMailFeedback({ index, verdict, text: stateRef.current.feedbackText });
      dispatch({
        type: "SET_FEEDBACK_NOTICE",
        value: verdict === "good"
          ? "Saved: recommendation was helpful."
          : "Saved: recommendation needs adjustment.",
      });
      dispatch({ type: "SET_FEEDBACK_TEXT", value: "" });
    } catch (err) {
      dispatch({
        type: "SET_FEEDBACK_NOTICE",
        value: err instanceof Error ? err.message : "Failed to save feedback.",
      });
    } finally {
      dispatch({ type: "SET_FEEDBACK_SAVING", value: false });
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!state.accountsLoaded || (!state.mailChecked && !state.setupRequired)) {
    return null;
  }

  if (state.setupRequired) {
    return (
      <section className="mail-tool mail-setup-only">
        <p>No IMAP accounts are configured.</p>
        <Link to="/settings" className="mail-setup-button">Set up IMAP to fetch mail.</Link>
        {DEV_MODE && (
          <button type="button" className="mail-setup-button" onClick={() => void seedDevMail()} disabled={state.loading} style={{ marginLeft: "0.5rem" }}>
            Load dev data
          </button>
        )}
      </section>
    );
  }

  if (state.authError) {
    return (
      <section className="mail-tool mail-setup-only">
        <p>Session expired.</p>
        <Link to="/settings" className="mail-setup-button">Go to Settings</Link>
      </section>
    );
  }

  return (
    <section className="mail-tool mail-shell">
      <header className="mail-hero">
        <div>
          <h1>Mail</h1>
          <p>Sync, review, and triage your inbox with saved analysis.</p>
          <div className="mail-preferences-bar">
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "SET_DRAFT_PREFERENCES", value: state.preferences });
                dispatch({ type: "SET_PREFERENCES_OPEN", value: true });
              }}
            >
              AI preferences
            </button>
            {state.preferencesNotice ? <span>{state.preferencesNotice}</span> : null}
          </div>
          {state.preferencesOpen ? (
            <div className="mail-preferences">
              <span>AI preferences</span>
              <textarea
                value={state.draftPreferences}
                onChange={(e) => dispatch({ type: "SET_DRAFT_PREFERENCES", value: e.target.value })}
                placeholder="Example: prioritize reply and calendar items, be stricter about delete recommendations."
                rows={3}
              />
              <div className="mail-preferences-actions">
                <button type="button" onClick={() => void handleSavePreferences()} disabled={state.preferencesSaving}>
                  {state.preferencesSaving ? "saving..." : "save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "SET_DRAFT_PREFERENCES", value: state.preferences });
                    dispatch({ type: "SET_PREFERENCES_OPEN", value: false });
                  }}
                  disabled={state.preferencesSaving}
                >
                  close
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mail-hero-status" role="status">
          <strong>{status}</strong>
          <span>{totalCount} total</span>
          <button
            type="button"
            className={["mail-unread-toggle", state.unreadOnly ? "mail-unread-toggle--active" : ""].filter(Boolean).join(" ")}
            onClick={() => {
              const next = !state.unreadOnly;
              dispatch({ type: "SET_UNREAD_ONLY", value: next });
              if (next) void fetchLatestMail();
            }}
            title={state.unreadOnly ? "Show all emails" : "Show only unread emails"}
          >
            {unreadCount} unread
          </button>
        </div>
      </header>

      {syncProgress.active ? (
        <div className="mail-sync-progress">
          <div className="mail-sync-progress-bar">
            <div className="mail-sync-progress-fill" style={{ width: `${syncProgress.percent}%` }} />
          </div>
          <span className="mail-sync-progress-label">{syncProgress.label}</span>
        </div>
      ) : null}

      {state.error ? (
        <div className="mail-error-banner" role="alert">
          <strong>Mail error:</strong> {state.error}
        </div>
      ) : null}

      <div className={["mail-workspace", detailOpen ? "mail-workspace--detail-open" : ""].filter(Boolean).join(" ")}>
        <section className="mail-panel mail-panel--list">
          <div className="mail-panel-heading">
            <span>{state.activeFolder || "Inbox"}</span>
            <div className="mail-panel-controls">
              {state.accounts.length > 1 && (
                <select
                  className="mail-move-select"
                  value={state.activeAccount}
                  onChange={(e) => dispatch({ type: "SET_ACTIVE_ACCOUNT", name: e.target.value })}
                >
                  <option value="">All accounts</option>
                  {state.accounts.map((acc) => (
                    <option key={acc.id} value={acc.name}>{acc.name}</option>
                  ))}
                </select>
              )}
              {state.folders.length > 0 && (
                <select
                  className="mail-move-select"
                  value={state.activeFolder}
                  onChange={(e) => dispatch({ type: "SET_ACTIVE_FOLDER", folder: e.target.value })}
                >
                  {state.folders.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              )}
              <button type="button" onClick={() => void fetchLatestMail()} disabled={state.loading || state.setupRequired}>
                sync
              </button>
              {DEV_MODE && (
                <>
                  <button type="button" onClick={() => void handleFetchOnly()} disabled={state.loading}>
                    fetch (for dev)
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAnalyze()}
                    disabled={state.loading || filteredEmails.length === 0}
                    title={
                      state.loading
                        ? "Wait for the current operation to finish before re-analyzing"
                        : filteredEmails.length === 0
                          ? "No emails loaded to analyze"
                          : "Re-run AI analysis on current emails"
                    }
                  >
                    re-analyze (for dev)
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mail-sort-bar">
            <span>Sort:</span>
            {(["time", "importance", "recommendation"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={state.sortMode === mode ? "mail-sort-btn mail-sort-btn--active" : "mail-sort-btn"}
                onClick={() => dispatch({ type: "SET_SORT_MODE", value: mode })}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="mail-search-bar">
            <input
              type="text"
              value={state.searchQuery}
              onChange={(e) => dispatch({ type: "SET_SEARCH_QUERY", value: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && state.searchQuery.trim()) void handleServerSearch(); }}
              placeholder="Search emails..."
              aria-label="Search emails"
            />
            <button
              type="button"
              onClick={() => void handleServerSearch()}
              disabled={state.loading || !state.searchQuery.trim()}
              title="Typing filters loaded emails instantly. This button queries the IMAP server for all matching emails (slower, hits the network)."
            >
              search all mail (server)
            </button>
            {state.searchQuery.trim() && (
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_SEARCH_QUERY", value: "" })}
              >
                clear
              </button>
            )}
          </div>

          {state.selectedIndices.size > 0 && (
            <div className="mail-bulk-bar">
              <label className="mail-bulk-check">
                <input
                  type="checkbox"
                  checked={filteredEmails.length > 0 && filteredEmails.every((e) => state.selectedIndices.has(e.index))}
                  onChange={() => {
                    const allSelected = filteredEmails.every((e) => state.selectedIndices.has(e.index));
                    if (allSelected) dispatch({ type: "CLEAR_SELECTION" });
                    else dispatch({ type: "SELECT_ALL", indices: filteredEmails.map((e) => e.index) });
                  }}
                />
                {state.selectedIndices.size} selected
              </label>
              <button type="button" className="mail-row-btn" onClick={() => void handleBulkMove("Archive")} disabled={state.actionLoading}>
                archive
              </button>
              <select
                className="mail-move-select"
                value=""
                onChange={(e) => { if (e.target.value) void handleBulkMove(e.target.value); e.target.value = ""; }}
                disabled={state.actionLoading}
              >
                <option value="">move to...</option>
                {(state.folders.length > 0 ? state.folders : COMMON_FOLDERS)
                  .filter((f) => f.toLowerCase() !== state.activeFolder.toLowerCase())
                  .map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <button
                type="button"
                className="mail-row-btn mail-row-btn--danger"
                onClick={() => { if (window.confirm(`Delete ${state.selectedIndices.size} emails?`)) void handleBulkMove("Trash"); }}
                disabled={state.actionLoading}
              >
                delete
              </button>
              <button type="button" className="mail-row-btn" onClick={() => dispatch({ type: "CLEAR_SELECTION" })}>
                cancel
              </button>
            </div>
          )}

          {state.loading && filteredEmails.length === 0 ? (
            <ul className="mail-list" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <li key={`skel-${i}`} className="mail-list-item mail-skeleton" aria-hidden="true">
                  <div className="mail-item-header">
                    <div className="mail-item-header-left">
                      <span className="mail-skel-block" style={{ width: "3rem" }} />
                      <span className="mail-skel-block" style={{ width: "5rem" }} />
                      <span className="mail-skel-block" style={{ width: "10rem" }} />
                    </div>
                    <span className="mail-skel-block" style={{ width: "5.5rem" }} />
                  </div>
                  <div className="mail-skel-block" style={{ width: `${55 + i * 7}%`, height: "1rem" }} />
                </li>
              ))}
            </ul>
          ) : filteredEmails.length > 0 ? (
            <ul className="mail-list">
              {filteredEmails.map((email, pos) => (
                <li
                  key={`${email.account ?? ""}-${email.index}`}
                  className={[
                    "mail-list-item",
                    pos === state.highlightedPos ? "mail-list-item--highlighted" : "",
                    email.read === false ? "mail-list-item--unread" : "",
                    detailOpen && state.selectedIndex === email.index ? "mail-list-item--selected" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => {
                    dispatch({ type: "SET_HIGHLIGHTED_POS", pos });
                    openEmailRef.current(email.index);
                  }}
                >
                  <div className="mail-item-header">
                    <div className="mail-item-header-left">
                      <input
                        type="checkbox"
                        className="mail-item-checkbox"
                        checked={state.selectedIndices.has(email.index)}
                        onChange={() => dispatch({ type: "TOGGLE_SELECT", index: email.index })}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select "${email.subject || "(no subject)"}"`}
                      />
                      {email.read === false ? <span className="mail-unread-dot" aria-label="Unread" title="Unread" /> : null}
                      <span
                        className={`rec-badge rec-${recommendationClass(email)}`}
                        title={email.recommendation_reason || undefined}
                      >
                        {recommendationLabel(email)}
                      </span>
                      {email.importance != null ? (
                        <span className={`mail-importance mail-importance--${email.importance}`} title={`Importance: ${email.importance}/5`}>
                          {email.importance}
                        </span>
                      ) : null}
                      {hasAnalysis(email) ? (
                        <span className="mail-analysis-done" aria-label="AI processed" title="AI processed">
                          ★
                        </span>
                      ) : null}
                      {email.account ? <span className="mail-item-account">{email.account}</span> : null}
                      <span className="mail-item-from">{email.from || "unknown sender"}</span>
                    </div>
                    <span className="mail-item-date">{email.date || "no date"}</span>
                  </div>
                  <div className="mail-item-subject">{email.subject || "(no subject)"}</div>
                  {email.summary ? <p className="mail-item-summary">{email.summary}</p> : null}
                  <div className="mail-item-footer">
                    <div className="mail-item-tags">
                      {email.recommended_todo ? (
                        <div className="mail-item-todo">
                          <span className="mail-item-todo-label">todo</span>
                          <span>{email.recommended_todo}</span>
                        </div>
                      ) : null}
                      {email.suggested_actions?.map((action, i) => (
                        <button
                          key={`${action.type}-${i}`}
                          type="button"
                          className="mail-suggested-action-btn"
                          onClick={(e) => { e.stopPropagation(); void handleSuggestedAction(action, email.subject); }}
                        >
                          {action.type === "add_to_calendar" ? `+ calendar: ${action.title || "event"}` : action.type}
                        </button>
                      ))}
                    </div>
                    <div className="mail-item-actions" onClick={(e) => e.stopPropagation()}>
                      {email.recommended_folder && email.recommended_folder.toLowerCase() !== state.activeFolder.toLowerCase() ? (
                        <button
                          type="button"
                          className="mail-row-btn mail-row-btn--folder-rec"
                          onClick={() => void handleMove(email.index, email.recommended_folder!)}
                          disabled={state.actionLoading}
                          title={`AI recommends: move to ${email.recommended_folder}`}
                        >
                          → {email.recommended_folder}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={[
                          "mail-row-btn",
                          shouldHighlightOpen(email) ? "mail-row-btn--recommended-open" : "",
                        ].join(" ")}
                        onClick={() => {
                          dispatch({ type: "SET_HIGHLIGHTED_POS", pos });
                          openEmailRef.current(email.index);
                        }}
                      >
                        open
                      </button>
                      <select
                        className={[
                          "mail-move-select",
                          recommendationClass(email) === "archive" ? "mail-move-select--recommended" : "",
                        ].join(" ")}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) void handleMove(email.index, e.target.value);
                          e.target.value = "";
                        }}
                        disabled={state.actionLoading}
                      >
                        <option value="">move to...</option>
                        {(state.folders.length > 0 ? state.folders : COMMON_FOLDERS)
                          .filter((f) => f.toLowerCase() !== state.activeFolder.toLowerCase())
                          .map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className={[
                          "mail-row-btn",
                          "mail-row-btn--danger",
                          recommendationClass(email) === "delete" ? "mail-row-btn--recommended" : "",
                        ].join(" ")}
                        onClick={() => {
                          if (window.confirm(`Delete "${email.subject || "(no subject)"}"?`)) {
                            void handleMove(email.index, "Trash");
                          }
                        }}
                        disabled={state.actionLoading}
                      >
                        delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mail-empty-state">
              <p>No messages loaded.</p>
              <p>Hit sync to fetch and analyze your inbox.{DEV_MODE && <> Or <button type="button" className="mail-link-btn" onClick={() => void seedDevMail()} disabled={state.loading}>load dev data</button> to test the UI.</>}</p>
            </div>
          )}

          {state.totalPages !== null && state.totalPages > 1 && state.page !== null ? (
            <div className="mail-pagination">
              <button
                type="button"
                onClick={() => void loadMailPage(state.page! - 1)}
                disabled={state.loading || state.page! <= 1}
              >
                prev
              </button>
              <span>Page {state.page} of {state.totalPages}</span>
              <button
                type="button"
                onClick={() => void loadMailPage(state.page! + 1)}
                disabled={state.loading || state.page! >= state.totalPages!}
              >
                next
              </button>
            </div>
          ) : null}

        </section>

        {detailOpen ? (
          <aside className="mail-panel mail-panel--detail">
            <div className="mail-modal-header">
              <div className="mail-modal-meta">
                {selectedEmail ? (
                  <>
                    <span className="mail-meta-chip">{selectedEmail.from || "unknown sender"}</span>
                    <span className="mail-meta-chip">{selectedEmail.date || "no date"}</span>
                    {selectedEmail.account ? <span className="mail-meta-chip">{selectedEmail.account}</span> : null}
                    <span
                      className={`rec-badge rec-${recommendationClass(selectedEmail)}`}
                      title={selectedEmail.recommendation_reason || undefined}
                    >
                      {selectedEmail.recommendation?.trim() || "N/A"}
                    </span>
                    {selectedEmail.importance != null ? (
                      <span className={`mail-importance mail-importance--${selectedEmail.importance}`} title={`Importance: ${selectedEmail.importance}/5`}>
                        {selectedEmail.importance}
                      </span>
                    ) : null}
                    {selectedEmail.recommendation_reason ? (
                      <span className="mail-meta-chip">{selectedEmail.recommendation_reason}</span>
                    ) : null}
                    {hasAnalysis(selectedEmail) ? (
                      <span className="mail-analysis-done" aria-label="AI processed" title="AI processed">
                        ★
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
              <button type="button" onClick={closeEmailRef.current} aria-label="Close">x</button>
            </div>

            <div className="mail-modal-subject">
              <h2>{selectedEmail?.subject || "(no subject)"}</h2>
              {selectedEmail?.summary ? <p className="mail-modal-summary">{selectedEmail.summary}</p> : null}
              {selectedEmail?.recommended_todo ? <p className="mail-modal-todo"><strong>Recommended:</strong> {selectedEmail.recommended_todo}</p> : null}
              {selectedEmail?.suggested_actions && selectedEmail.suggested_actions.length > 0 ? (
                <div className="mail-suggested-actions">
                  {selectedEmail.suggested_actions.map((action, i) => (
                    <button
                      key={`${action.type}-${i}`}
                      type="button"
                      className="mail-suggested-action-btn"
                      onClick={() => void handleSuggestedAction(action, selectedEmail.subject)}
                    >
                      {action.type === "add_to_calendar" ? `Add to calendar: ${action.title || "event"}` : action.type}
                      {action.date ? ` (${action.date}${action.time ? ` ${action.time}` : ""})` : ""}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {selectedEmail ? (
              <div className="mail-actions">
                <button
                  type="button"
                  className="mail-action-btn"
                  onClick={() => void handleMove(selectedEmail.index, "Archive")}
                  disabled={state.actionLoading}
                >
                  Archive
                </button>
                <div className="mail-action-move">
                  <select
                    value={state.moveFolder}
                    onChange={(e) => dispatch({ type: "SET_MOVE_FOLDER", folder: e.target.value })}
                    disabled={state.actionLoading}
                  >
                    <option value="">Move to...</option>
                    {(state.folders.length > 0 ? state.folders : COMMON_FOLDERS)
                      .filter((f) => f.toLowerCase() !== state.activeFolder.toLowerCase())
                      .map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="mail-action-btn"
                    onClick={() => void handleMove(selectedEmail.index, state.moveFolder)}
                    disabled={state.actionLoading || !state.moveFolder}
                  >
                    Move
                  </button>
                </div>
                <button
                  type="button"
                  className="mail-action-btn"
                  onClick={() => dispatch({ type: "SET_CONFIRM_DELETE", value: true })}
                  disabled={state.actionLoading}
                >
                  Delete
                </button>
                {state.confirmDelete ? (
                  <span className="mail-action-confirm">
                    Delete?
                    <button
                      type="button"
                      className="mail-action-btn mail-action-btn--danger"
                      onClick={() => void handleMove(selectedEmail.index, "Trash")}
                      disabled={state.actionLoading}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="mail-action-btn"
                      onClick={() => dispatch({ type: "SET_CONFIRM_DELETE", value: false })}
                    >
                      No
                    </button>
                  </span>
                ) : null}
              </div>
            ) : null}

            {selectedEmail ? (
              <div className="mail-feedback">
                <span>Feedback</span>
                <input
                  type="text"
                  value={state.feedbackText}
                  onChange={(e) => dispatch({ type: "SET_FEEDBACK_TEXT", value: e.target.value })}
                  placeholder="why?"
                  aria-label="Feedback note"
                  disabled={state.feedbackSaving}
                />
                <button
                  type="button"
                  onClick={() => void handleFeedback(selectedEmail.index, "good")}
                  disabled={state.feedbackSaving}
                  aria-label="Upvote recommendation"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => void handleFeedback(selectedEmail.index, "bad")}
                  disabled={state.feedbackSaving}
                  aria-label="Downvote recommendation"
                >
                  ↓
                </button>
                {state.feedbackNotice ? <span>{state.feedbackNotice}</span> : null}
              </div>
            ) : null}

            {state.actionError && <p className="mail-error mail-action-error">{state.actionError}</p>}

            {state.attachments.length > 0 && state.selectedIndex !== null ? (
              <div className="mail-attachments">
                <span>Attachments</span>
                <ul>
                  {state.attachments.map((att, i) => (
                    <li key={`${att.filename}-${i}`}>
                      <button
                        type="button"
                        className="mail-attachment-btn"
                        onClick={() => void downloadAttachment(state.selectedIndex!, i)}
                      >
                        {att.filename}
                      </button>
                      <span className="mail-attachment-meta">
                        {att.content_type} — {att.size < 1024 ? `${att.size} B` : `${(att.size / 1024).toFixed(1)} KB`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mail-modal-body">
              {state.loading
                ? <p className="mail-modal-loading">Loading...</p>
                : state.emailContentHtml ? (
                  <iframe
                    className="mail-html-frame"
                    srcDoc={state.emailContentHtml}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    title="Email content"
                  />
                ) : (
                  <div className="mail-modal-content">{renderLinkedText(state.emailContent)}</div>
                )}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
