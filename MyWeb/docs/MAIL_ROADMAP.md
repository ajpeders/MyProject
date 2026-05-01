# Mail Page Roadmap

Tracking the state and planned work for the mail tool (frontend + backend).

## Current State (2026-04-28)

Working mail client with AI-powered triage: sync from IMAP, view/move/delete emails, AI recommendations with user feedback loop.

### What Works
- IMAP fetch from multiple accounts with encrypted credentials
- AI analysis: recommendations (delete/archive/reply/todo/calendar/review), summaries, suggested todos
- User preferences for AI behavior + feedback loop (thumbs up/down influences future analysis)
- Folder selection drives actual IMAP fetch
- Pagination (backend + frontend)
- Email body display (full, untruncated)
- Move/delete with IMAP server-side execution
- Mark-as-read synced to IMAP
- Dev mode with seed data for UI testing
- Encrypted email persistence (AES-256-GCM) with metadata merge on re-fetch
- Session caching for instant page loads
- Keyboard navigation (j/k/Enter/Escape)

### Architecture
```
Frontend (React + useReducer)
  MailPage.tsx          — UI, state machine, keyboard nav
  api/mail.ts           — typed API client
  api/mailConfig.ts     — AI model + preferences config

Backend (FastAPI)
  routes/mail.py        — REST endpoints
  services/mail/        — MailService (orchestration, persistence, feedback)
  core/mail_engine.py   — MailEngine (state, display, LLM calls, IMAP ops)
  core/actions/mail.py  — dispatcher layer
  core/actions/mail_imap.py — raw IMAP operations
```

## Done

### Audit Fixes (2026-04-28)
- [x] Full body storage — removed 500-char truncation so "open" shows complete email
- [x] Test suite rewrite — all MailPage tests now match actual UI (was 8/11 failing)
- [x] Folder selector wired end-to-end — selecting a folder and syncing fetches from that IMAP folder
- [x] Pagination controls — prev/next buttons rendered when multiple pages exist
- [x] Detail panel folder list — now uses dynamic folders instead of hardcoded list
- [x] Account name resolution — removed broken id-vs-name lookup
- [x] Dead state cleanup — removed unused `selectedIndices` from reducer
- [x] Envelope parsing deduplication — extracted shared `_parse_email_data` helper (~120 lines removed)
- [x] Folder route error handling — targeted exception handlers instead of silent catch-all
- [x] Read-only GET no longer writes session — removed redundant `save_session` from `mail_get`
- [x] `read_all_emails` multi-account support — iterates all accounts when no name given
- [x] `uid` typing — `any` replaced with `int | str | None`
- [x] Test coverage — added service-level and route-level tests for feedback, dev-seed, fetch-only, by-date

## Planned

### P0 — Bugs / Correctness
- [x] Search — client-side filter as you type + server-side IMAP SEARCH via `/api/mail/search`
- [ ] Compose/reply — no send capability exists yet (paused)
- [x] Attachment support — metadata extraction during fetch, attachment list in detail view, on-demand IMAP download via `/api/mail/{index}/attachment/{i}`

### P1 — UX
- [x] Sync progress bar — simulated multi-step progress with labels during sync/fetch/analyze
- [ ] Auto-fetch on folder change — selecting a folder should trigger a sync without clicking "sync"
- [x] Suggested actions in UI — renders "add to calendar" buttons from AI analysis, wired to calendar API
- [ ] Bulk actions — multi-select checkboxes for batch move/delete/archive
- [ ] Loading skeleton — show placeholder rows while syncing instead of blank screen
- [ ] Unread filter toggle — backend supports `unread_only` but no UI toggle exists

### P2 — Backend
- [ ] Prompt improvements — refine recommendation/intent system prompts for better triage accuracy (fewer false deletes, better calendar detection, etc.)
- [ ] Incremental sync — currently re-fetches top N emails every time; should use UIDVALIDITY + last-seen UID for delta sync
- [ ] Background sync — periodic IMAP poll instead of on-demand only
- [ ] Rate limiting on LLM analysis — prevent accidental rapid re-analysis calls
- [ ] Email threading — group replies by message-id/in-reply-to headers

### P3 — Future
- [ ] Push notifications via IMAP IDLE
- [ ] Drag-and-drop between folders
- [ ] Email rules / auto-triage based on learned feedback patterns
- [ ] Calendar integration — auto-create events from `suggested_actions`
