# Architecture

Browser-only React 19 SPA. No SSR. All data flows through `src/api/*` clients
backed by two backends: MyAgent (FastAPI on `:8000`) and DevTeam daemon
(separate FastAPI on `:4223`).

## Pages and Routing

`src/App.tsx` declares the route tree and auth boundaries:

- `RequireAuth` (`App.tsx:18`) gates the authenticated layout
- `RequireAdmin` (`App.tsx:22`) gates `/admin` on top of `RequireAuth`
- Public: `/login`
- Authenticated: `/`, `/mail`, `/news`, `/search`, `/chat`, `/memory`,
  `/myagent`, `/calendar`, `/devteam`, `/admin`, `/settings`, `/whisper`

`src/components/Layout.tsx` provides the sidebar shell, theme toggle, and
nested route outlet.

## Tool Registry Pattern

`src/tools/registry.ts` exports a static `tools: ToolEntry[]` consumed by the
home page. Each entry has `{ name, path, description }`. Current entries:

- Mail, News, Search, Chat, Memory, MyAgent, DevTeam, Calendar, Admin,
  Settings, Whisper

Page components live under `src/tools/<name>/<Name>Page.tsx`
(e.g. `src/tools/mail/MailPage.tsx`, `src/tools/news/NewsPage.tsx`). Routes in
`App.tsx` import these directly; the registry is only for the home-page tool
listing.

## API Client Layer

Files in `src/api/` wrap fetch calls. They normalize errors via `ApiError` and
inject auth headers.

MyAgent clients (use `apiFetch` from `src/api/client.ts`):

- `auth.ts` — login, register, logout, session storage, `isAuthenticated`,
  `isAdmin`
- `account.ts` — Web Crypto credential encryption helpers
- `mail.ts` — `/api/mail`, `/api/mail/fetch`, `/api/mail/{index}`,
  `/api/mail/move`
- `mailConfig.ts` — mail config endpoints
- `imap.ts` — IMAP account list/add/delete
- `chat.ts` — `/api/chat`
- `search.ts`, `searchConfig.ts` — search and search config
- `memory.ts` — `/api/memory` list/search/add/delete
- `calendar.ts` — calendar data
- `news.ts` — news feed and curated feed
- `profile.ts` — user profile with interests (added 717cb79)
- `schedule.ts` — schedule data (added 0bcf03c)
- `whisper.ts` — voice transcription test surface
- `admin.ts` — `/api/admin/stats|users|sessions`, admin deletes

DevTeam client (separate transport — uses `devteamFetch` with `X-Api-Key`):

- `devteam.ts` — talks to `http://localhost:4223` (configurable via
  `VITE_DEVTEAM_API_URL`). Endpoints include `/api/project/*`, `/api/task/*`,
  `/api/agent/*`, `/api/webhook/*`, `WS /ws/tasks`.

## Auth Headers

`apiFetch` in `src/api/client.ts` sends:

- `X-Session-ID` from `localStorage["myagent.session_id"]`
- `X-User-ID` from `localStorage["myagent.user_id"]`
- `X-API-Key` from `localStorage["myagent.api_key"]` (fallback `VITE_API_KEY`)

DevTeam requests carry `X-Api-Key` from `VITE_DEVTEAM_API_KEY` or
`localStorage["devteam.api_key"]`.

## State Patterns

Larger pages use `useReducer` plus refs to avoid stale closures inside async
handlers. The canonical example is `src/tools/mail/MailPage.tsx`:

- `mailReducer` owns a single `MailState`
- `stateRef.current` mirrors state for handlers fired from outside the React
  render path (keyboard listeners, async callbacks)
- `openEmailRef` and similar refs hold the latest async-safe function

`DevTeamPage.tsx` was refactored to the same pattern (`DevTeamState` +
`devteamReducer`, see audit log entry in `docs/MAIL_ROADMAP.md` / prior commit
history).

## For You Curation Data Flow

Recent commits added a curated news feed (commits `49c38fe`, `0bcf03c`,
`dfada2b`):

1. Browser hits `/api/news/curated*` via `src/api/news.ts`
2. Vite proxy forwards `/api/*` to MyAgent `:8000`
3. MyAgent backend personalizes the feed using the user profile from
   `src/api/profile.ts` (interests, ratings)
4. `src/tools/news/NewsPage.tsx` renders the For You tab and writes article
   ratings back through the same `/api/news/*` surface

## Vite Proxy

`vite.config.ts` (lines 20-26) proxies two prefixes to MyAgent:

- `/api/admin` -> `VITE_DEV_API_PROXY_TARGET` (default `http://localhost:8000`)
- `/api` -> same target

DevTeam is **not** proxied; the frontend fetches `http://localhost:4223`
directly with an `X-Api-Key` header.

## Tests

- Unit/component: Vitest 4 (`vitest run` via `npm test`). Files co-located as
  `*.test.ts(x)` next to source.
- E2E: Playwright (`npm run e2e`). Config in `playwright.config.ts`,
  `testDir: "./tests/e2e"`. Current specs: `tests/e2e/devteam.spec.ts`,
  `tests/e2e/myagent.spec.ts`.
