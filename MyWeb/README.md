# MyWeb

React + TypeScript tool suite shell for MyAgent.

This README is the source of truth for project guides, architecture notes, backend contracts, roadmap items, and handoff context. It is expected to grow and change as the app changes, so future work should start from this one document instead of scattered notes.

## README Maintenance

- Update this file in the same change that alters architecture, routes, API contracts, setup, verification, roadmap, or handoff state.
- Prefer editing the relevant existing section over appending disconnected notes.
- Keep short-lived handoff details in `Project Notes`, `Current Roadmap`, or the relevant feature section.
- Move completed roadmap items into the appropriate feature notes or delete them when they stop being useful.
- Do not add new root-level guide, roadmap, architecture, or handoff markdown files unless there is a strong reason.
- If a section grows too large, split it into clearer subsections inside this README first.

## Contents

- [Stack](#stack)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Architecture](#architecture)
- [Backend Contracts](#backend-contracts)
- [Implementation Notes](#implementation-notes)
- [Change Guide](#change-guide)
- [Verification Checklist](#verification-checklist)
- [Code Audit — 2026-04-25](#code-audit--2026-04-25)
- [Current Roadmap](#current-roadmap)
- [Project Notes](#project-notes)

## Stack

- Framework: React 19 + TypeScript
- Bundler: Vite 8
- Routing: React Router 7
- Styling: `terminal.css` plus custom CSS in `src/styles/app.css`
- Runtime: browser-only React app, no SSR
- Tests: Vitest, Testing Library, Playwright

## Quick Start

Start the MyAgent API first:

```bash
cd ../MyAgent
./start.sh
```

Then start the web app:

```bash
npm run dev
```

The Vite dev server runs on port `5173` by default and proxies `/api` requests to FastAPI on port `8000`.

Endpoint settings live in `.env` and can start from `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_API_KEY=dev
VITE_DEV_API_PROXY_TARGET=http://localhost:8000
VITE_DEVTEAM_API_URL=http://localhost:4223
VITE_DEVTEAM_API_KEY=
```

## Commands

```bash
npm run dev       # start Vite
npm test          # run unit/component tests
npm run e2e       # run Playwright tests
npm run build     # typecheck and build production assets
npm run lint      # run ESLint
```

The production build is written to `dist/`.

## Architecture

### App Shell

- `src/App.tsx` defines routes and auth boundaries.
- `src/components/Layout.tsx` provides the authenticated sidebar shell, theme toggle, and nested route outlet.
- `src/tools/registry.ts` is the tool listing used by the home page.
- `src/styles/app.css` owns global theme variables and page-level styling.

### API Layer

- `src/api/client.ts` is the main MyAgent fetch wrapper. It adds auth/session headers and normalizes errors.
- `src/api/auth.ts` handles login, register, logout, session storage, and auth checks.
- `src/api/account.ts` handles credential encryption helpers with Web Crypto.
- `src/api/chat.ts` sends chat prompts and receives `ActionResponse[]`.
- `src/api/search.ts` handles web search and result browsing.
- `src/api/memory.ts` handles personal memory list/search/add/delete.
- `src/api/imap.ts` handles IMAP account list/add/delete.
- `src/api/mail.ts` handles structured mail page/fetch/move endpoints.
- `src/api/admin.ts` handles MyAgent admin stats/users/sessions and stores the admin login key.
- `src/api/devteam.ts` talks to the separate DevTeam daemon on port `4223`.

### Pages And Tools

- `/login`: public login/register page.
- `/`: authenticated home page with registered tools.
- `/mail`: authenticated mail UI driven by structured `/api/mail/*` endpoints, with chat kept for free-form commands and reading a message.
- `/search`: authenticated web search page with inline answers, results, and URL browsing.
- `/chat`: authenticated chat page that shows inline web answers from `POST /api/search`.
- `/memory`: authenticated personal memory page for add/search/delete workflows.
- `/admin`: standalone MyAgent admin login and dashboard for users, sessions, and database health.
- `/settings`: authenticated IMAP account management.
- `/devteam`: authenticated DevTeam agent dashboard.

## Security Audit

### Session / Auth Tokens (MyAgent)

**Current state:** Session ID (`myagent.session_id`), User ID (`myagent.user_id`), and API key (`myagent.api_key`) are stored in `localStorage`. These are plaintext and accessible to any JavaScript on the page — XSS injection could exfiltrate them.

**Mitigations in place:**
- `SameSite` browser defaults limit CSRF risk
- API key is a backend env var fallback, not user-provided
- Logout clears session tokens (but not API key — intentional for runtime persistence)
- README documents the risk

**Recommended fix (requires backend change):**
- FastAPI login/register endpoints set `httpOnly; Secure; SameSite=Strict` cookie containing the session token
- Frontend removes manual `X-Session-ID` / `X-User-ID` header injection — cookie sent automatically with every request
- `apiFetch` in `src/api/client.ts` adds `credentials: "include"` to fetch calls (for same-origin cookies)
- Vite dev proxy preserves cookies when proxying to FastAPI

**Backend changes needed:**
1. `POST /api/account/login` and `POST /api/account/register` — set `HttpOnly` cookie on success, still return JSON body for frontend state
2. `POST /api/account/logout` — clear the cookie
3. Auth middleware — read session from cookie, fall back to `X-Session-ID` header for backward compat during rollout

### DevTeam API Key

**Current state:** API key stored in `localStorage["devteam.api_key"]`. Unlike MyAgent sessions, this is a long-lived static credential created by an admin outside the frontend.

**Risk:** XSS exfiltration of the static API key.

**Mitigations:**
- Key is created by admin, not user-chosen
- DevTeam daemon at port `4223` is separate from MyAgent on `8000` — different trust boundary
- Key is read-only in frontend usage (only sent, never displayed)

**Recommended fix:**
- DevTeam daemon should support short-lived JWT tokens or rotated session tokens instead of a static API key passed in localStorage
- Frontend exchanges API key for a time-limited JWT on login; JS never holds the raw long-lived credential

### General

- CSP headers should be configured on the hosting server to block inline script injection
- No user-provided content is rendered as raw HTML (no `dangerouslySetInnerHTML`)
- IMAP passwords are encrypted at rest by the backend — frontend only sends them

## Backend Contracts

### MyAgent API

As of April 20, 2026, the backend schema supports account auth, IMAP setup, structured mail endpoints, and chat:

- `GET /health`
- `POST /api/account/register`
- `POST /api/account/login`
- `GET /api/account/me`
- `POST /api/account/logout`
- `GET /api/imap`
- `POST /api/imap`
- `DELETE /api/imap/{account_id}`
- `GET /api/mail`
- `POST /api/mail/fetch`
- `GET /api/mail/{index}`
- `POST /api/mail/move`
- `POST /api/chat`
- `POST /api/search`
- `GET /api/search/browse?url={url}`
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/sessions`
- `POST /api/admin/login`
- `DELETE /api/admin/users/{user_id}`
- `DELETE /api/admin/sessions/{session_id}`

The schema does not expose IMAP update or IMAP activate endpoints. Do not add edit/update/activate UI unless the backend schema changes.

MyAgent authenticated requests require:

- `X-Session-ID`: `localStorage["myagent.session_id"]`
- `X-User-ID`: `localStorage["myagent.user_id"]`
- `X-API-Key`: from `localStorage["myagent.api_key"]`, falling back to `VITE_API_KEY`

Login/register does not prompt for API keys. In local dev, Vite's `/api` proxy injects the key from `VITE_API_KEY`, `MYDEVTEAM_API_KEY`, or `../MyAgent/.env` when available. A runtime key can be saved later from Settings for direct browser requests.

MyAgent admin endpoints use the same auth headers as regular endpoints (session/user headers from `apiFetch`). The backend determines admin access based on the authenticated user. The frontend gates `/admin` behind the `RequireAdmin` route guard, which checks `isAdmin()` (`localStorage["myagent.account"] === "admin"`).

### DevTeam API

The DevTeam page uses `VITE_DEVTEAM_API_URL`, defaulting to `http://localhost:4223`.

The DevTeam daemon is FastAPI and auto-serves API docs from the running code:

- Swagger UI: `http://localhost:4223/docs`
- OpenAPI JSON: `http://localhost:4223/openapi.json`
- ReDoc: `http://localhost:4223/redoc`

Use `http://localhost:4223/openapi.json` from the running daemon as the source of truth for frontend work. If the daemon repo contains `docs/openapi.yaml`, treat it as a reference document with extra context, not the canonical contract.

Important endpoints used by `src/api/devteam.ts`:

- `POST /api/user/me`
- `POST /api/project/list`
- `POST /api/project/create`
- `POST /api/project/delete`
- `POST /api/webhook/create`
- `POST /api/webhook/list`
- `POST /api/webhook/delete`
- `POST /api/task/list`
- `POST /api/task/create`
- `POST /api/task/get`
- `POST /api/task/cancel`
- `PATCH /api/task/priority`
- `POST /api/deploy/approve`
- `POST /api/agents/list`
- `POST /api/agent/config`
- `POST /api/agent/logs`
- `POST /api/dashboard/stats`
- `POST /api/node/info`
- `WS /ws/tasks`

DevTeam API keys are read from `VITE_DEVTEAM_API_KEY` first, then `localStorage["devteam.api_key"]`. When present, requests include `X-Api-Key`. The daemon no longer exposes public registration; users receive API keys created outside the frontend by an admin.

Agent-only DevTeam endpoints are intentionally not used by the frontend: `/api/task/claim`, `/api/task/status`, `/api/heartbeat`, `/api/git/*`, and `/api/admin/*`.

DevTeam task responses now include `priority` as an integer, defaulting to `0`. New tasks can be created with a priority value, and the daemon exposes `PATCH /api/task/priority` to update it at runtime. Agent claiming is priority-aware and prefers higher priority pending work before older lower-priority work.

## Implementation Notes

### Authentication

- Login/register request bodies are `{ email, password }`.
- Login/register responses include `{ user_id, session_id, account }`.
- The MyAgent API key can be stored later from Settings in `localStorage["myagent.api_key"]`.
- The MyAgent user id is stored in `localStorage["myagent.user_id"]`.
- The MyAgent session id is stored in `localStorage["myagent.session_id"]`.
- The login email is stored in `localStorage["myagent.email"]` so Settings can refresh the session after adding an IMAP account.
- Authenticated routes use the `RequireAuth` wrapper in `src/App.tsx`.
- The API client sends the session id as `X-Session-ID` and the user id as `X-User-ID`.

### Mail

- `/mail` checks IMAP accounts before rendering the normal mail UI.
- If `/api/imap` lists stored accounts, `/mail` uses the selected account name when fetching.
- If `/api/imap` returns `[]`, `/mail` still tries `POST /api/mail/fetch` because the backend can use config-based IMAP accounts from the server environment.
- If that fetch succeeds, the normal mail UI appears even though there are no stored per-user IMAP accounts.
- If that fetch returns the no-IMAP `400`, `/mail` renders only the setup state:
  - `No IMAP accounts are configured.`
  - `Set up IMAP to fetch mail.`
- If at least one IMAP account exists, the normal mail UI appears.
- Structured mail operations use `src/api/mail.ts`:
  - initial load/fetch button: `POST /api/mail/fetch`
  - refresh/current page: `GET /api/mail`
  - previous/next page: `GET /api/mail?page={zero_based_page}`
  - open/read one message: `GET /api/mail/{index}`
  - archive/delete/move: `POST /api/mail/move`
- Free-form commands still use `POST /api/chat`.
- Opening a message uses the structured `GET /api/mail/{index}` endpoint.

### Search

- `/search` calls `POST /api/search` with `{ query }`.
- The response shape is `{ answer, results }`.
- The quick answer is shown inline above the result list.
- Search results show title, snippet, and URL.
- Clicking a result browses it through `GET /api/search/browse?url={url}` for a page summary.
- The result URL remains an external link to the original page.

### Chat

- `/chat` calls `POST /api/search` with `{ query }`.
- The conversational search answer is shown inline in the chat page.

### Memory

- The backend now exposes memory endpoints:
  - `POST /api/memory`
  - `GET /api/memory?q={query}&top_k={n}`
  - `DELETE /api/memory/{memory_id}`
- `/memory` supports:
  - add memory
  - list all memories
  - semantic search with `q`
  - delete memory

### Settings

- IMAP account creation matches the live backend schema:
  - helper: `addImapAccount(name, server, username, imapPassword, userPassword, port = 993)`
  - request body: `{ name, server, port, username, imap_password, user_password }`
- The MyAgent password is required when adding IMAP credentials because the backend uses it to encrypt the IMAP password at rest.
- After adding an IMAP account, Settings logs in again when `myagent.email` is available so the current session receives decrypted IMAP credentials.
- Settings supports list/add/delete only. Do not add edit/update/activate UI unless backend endpoints exist.

### Admin Page

- `/admin` is inside the authenticated route group and protected by `RequireAdmin`, which checks `isAdmin()` from `src/api/auth.ts`.
- `isAdmin()` returns true when `localStorage["myagent.account"]` is `"admin"`.
- Non-admin users are redirected to `/`. The sidebar hides the Admin link for non-admins.
- Admin API calls use the normal `apiFetch` from `src/api/client.ts` — no separate admin fetch or API key.
- On mount, `/admin` loads:
  - `GET /api/admin/stats`
  - `GET /api/admin/users`
  - `GET /api/admin/sessions`
- Admin deletes use:
  - `DELETE /api/admin/users/{user_id}`
  - `DELETE /api/admin/sessions/{session_id}`
- Delete buttons always require `window.confirm`.
- Do not run delete smoke tests against real data unless the target user/session was created specifically for that test.

### DevTeam Page

- `/devteam` shows a task pipeline dashboard for Dev, Review, QA, and Deploy work.
- It supports API-key sign-in, project-divided task sections, task listing/filtering, dashboard stats, new task creation, task detail actions, project setup/deletion, project webhook setup, agent list/logs, agent config inspection, node info, QA-to-deploy approval, and WebSocket task updates.
- Webhook setup lets users register a URL for a selected project, choose an event such as `task.completed`, and view the generated HMAC secret immediately after creation for server-side verification. The list view does not display secrets from `/api/webhook/list`.
- `WS /ws/tasks` is subscribed once and updates task and stats state reactively when messages arrive; HTTP list calls are still used for initial load, refresh, and filter/project changes.
- The selected project is stored in `localStorage["devteam.project_id"]`.
- Task status values are `pending`, `assigned`, `in_progress`, `blocked`, `needs_changes`, `completed`, `failed`, and `cancelled`.
- DevTeam tasks now carry a numeric `priority`, defaulting to `0`.
- User-created tasks require a selected project because `/api/task/create` requires `project_id`.
- The backend supports creating tasks with a priority and updating priority later through `PATCH /api/task/priority`.
- The current frontend already reads agent memory and CPU limits from `POST /api/agents/list` and can inspect running agent settings through `POST /api/agent/config`.
- The current frontend does not yet expose task priority editing controls, so any README update about priority is documenting live backend capability first.

## Change Guide

Use this flow for frontend changes:

1. Check this README for current backend contracts and route ownership.
2. Inspect the relevant page, API wrapper, tests, and styles before editing.
3. Keep backend request shapes aligned with the live OpenAPI schema.
4. Prefer existing project patterns over new abstractions.
5. Update focused tests with behavior changes.
6. Run the narrow relevant tests first, then `npm test` and `npm run build` for broader changes.
7. Update this README when architecture, backend contracts, roadmap, or manual verification steps change.

## Verification Checklist

General:

- `npm test`
- `npm run e2e`
- `npm run build`
- `npm run lint` when lint-sensitive files change

Mail manual checks:

- Start MyAgent on `localhost:8000`.
- Visit `/mail` with zero IMAP accounts and confirm only the no-IMAP setup state appears.
- Add an IMAP account through `/settings`.
- Return to `/mail` and confirm the normal mail UI appears.
- Confirm structured mail fetch, refresh, paging, archive, move, and delete work against the running backend.
- Confirm `read {index}` still opens message content through chat.

DevTeam manual checks:

- Start the DevTeam daemon on `localhost:4223`.
- Visit `/devteam`.
- Save or register an API key if the daemon requires one.
- Create or select a project.
- Confirm task listing, filtering, task creation, agent list, agent config, logs, node info, and live task updates.
- If task priority behavior changes, verify through the live daemon that created tasks include the expected `priority` and that higher-priority pending work is claimed first.

## Code Audit — 2026-04-25

### Test Results

| Check | Result |
|-------|--------|
| Unit tests (Vitest) | 129/129 passing (20 files) |
| TypeScript | No type errors |
| Production build | Succeeds (311 KB JS, 49 KB CSS) |
| ESLint | Clean (all resolved) |

### ESLint Issues

1. **`CalendarPage.tsx:96`** — `useEffect(loadMonth, ...)` triggers `react-hooks/set-state-in-effect` because `loadMonth` calls setState inside the effect callback. Also called imperatively from event handlers, creating a dual-use function that's hard to reason about.
2. **`CalendarPage.tsx:270`** — `day !== null && setSelectedDay(day)` is an expression used as a statement (`@typescript-eslint/no-unused-expressions`). Needs an `if` statement.
3. **`MailPage.tsx:244`** — `useEffect` references `fetchLatestMail` but omits it from the dependency array (`react-hooks/exhaustive-deps`).

### Code Quality Issues

4. **Duplicate `MailSummary` type** — defined identically in `src/api/chat.ts:12` and `src/api/mail.ts:3`. One should re-export from the other.
5. **`MyAgentPage.tsx:32`** — `abortRef` is created and assigned but never used to abort requests. Either wire it into `sendChat` via `AbortController.signal` or remove it.
6. **`MailPage.tsx:372`** — `fetchLatestMail` reads `state.accountsLoaded` and `state.accounts.length` but is called from a `useEffect` without being a dependency, risking stale closures.
7. **`CalendarPage.tsx:55`** — `const today = new Date()` is outside `useMemo`/`useState`, so `isToday()` could return false positives if the component stays mounted past midnight.
8. **`DevTeamPage.tsx`** — 30+ `useState` calls. Would benefit from a reducer (like MailPage uses) for more predictable state transitions.
9. **`DevTeamPage.tsx:345,361,389,399,410`** — uses `window.confirm` and `alert`, which block the main thread and can't be styled. Should use inline confirmation patterns (like MailPage and SettingsPage already do).

### Fix Priority — All Resolved

- [x] Fix ESLint errors in CalendarPage (items 1-2) — split `loadMonth` into `fetchMonthData`/`refreshMonth`, wrapped effect with lint suppression for intentional loading setState, replaced expression-as-statement with `if`
- [x] Fix ESLint warning in MailPage (item 3) — added lint suppression with explanation (all deps already listed, function is unstable)
- [x] Deduplicate `MailSummary` type (item 4) — `chat.ts` now imports from `mail.ts` via `import type`
- [x] Remove unused `abortRef` in MyAgentPage (item 5) — removed
- [x] Replace `window.confirm`/`alert` in DevTeamPage (item 9) — alerts routed to `error`/`connectionMessage` state, confirms replaced with inline Yes/No UI in ConnectionPanel
- [x] Refactor DevTeamPage to `useReducer` (item 8) — 36 `useState` → single `DevTeamState` + `devteamReducer` with compound actions

### Additional Fixes (completed same session)

- [x] CalendarPage `new Date()` drift (item 7) — stabilized with `useState(() => new Date())` so `isToday()` is consistent
- [x] MailPage `fetchLatestMail` stale closure (item 6) — added `stateRef` pattern, function reads `stateRef.current` instead of closure; removed lint suppression and dead `activeAccountName` helper
- [x] Unified fetch patterns — `devteam.ts` local `apiFetch` replaced with typed `devteamFetch<T>` using `ApiError`, structured error parsing, and network error handling matching `client.ts` pattern

## Current Roadmap

- Keep `/mail` aligned to the structured mail backend contract.
- Mail item action roadmap:
  - Reply
  - Mark read / unread
  - Save or star
  - Snooze
  - Add to calendar
  - Create todo
  - Copy summary
  - Re-run AI on this email
  - Show suggested actions
  - Open thread
  - View raw email
  - Move to Saved
- Mail feedback and learning roadmap:
  - Add explicit mail recommendation feedback in the open email view
  - Persist feedback per message with recommendation snapshot and timestamp
  - Include recent user feedback summaries in future mail analysis prompts
  - Add per-user mail preference memory beyond the current freeform preference text
  - Add thread-aware recommendation context
  - Add recommendation quality analytics comparing user actions vs AI suggestions
- Keep `/settings` limited to IMAP list/add/delete until backend update or activate routes exist.
- Manually smoke test `/mail` with a live backend after any mail or IMAP change.
- Add a dedicated structured read endpoint and move the modal off chat when the backend supports it.
- Decide when to expose the backend memory API in the frontend.
- Manually smoke test `/devteam` with a live DevTeam daemon after any DevTeam API or dashboard change.
- Decide when to expose DevTeam task priority create/edit controls in `/devteam`.
- Remove stale CSS when UI paths are deleted.
- Keep this README as the single place for project guides, roadmap, and architecture notes.

## Security Roadmap

- [ ] FastAPI: add `httpOnly` cookie for MyAgent login/register session, clear on logout
- [ ] Frontend: remove manual `X-Session-ID`/`X-User-ID` headers, add `credentials: "include"` to fetch calls
- [ ] FastAPI: add cookie-based auth middleware with header fallback for backward compat
- [ ] Vite: ensure dev proxy preserves cookies (test in dev mode)
- [ ] DevTeam daemon: consider short-lived JWT tokens instead of static API key in localStorage
- [x] Admin: removed separate admin login form and `localStorage["myagent.admin_api_key"]` — admin now uses normal authenticated session with `RequireAdmin` route guard

## Project Notes

- The workspace at `/home/alex/projects/MyWeb` may not be a Git repository. Use file inspection when `git` metadata is unavailable.
- `.codex` may exist as a read-only zero-byte file, not a directory.
- As of the latest handoff, the local backend was sometimes unavailable on resume; live mail smoke testing requires `localhost:8000`.
