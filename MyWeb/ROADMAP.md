# Roadmap

## Agent-sized TODO queue — 2026-09-18

These cards break selected existing priorities and observed gaps into small tasks.
They are the execution queue; the broader roadmap below remains product context.
Pick one card per change. Paths and commands are relative to this project root;
`(new)` marks a file to create. Read applicable `AGENTS.md` first. Check whether the
work has already landed before editing. If so, cite the implementation and checks
instead of rebuilding it. Install dependencies using this project's documented setup.

`ready` means no product decision is needed, not that every tool is installed.
Honor explicit dependencies and blocked/parked labels. Do not expand a card into an
architecture rewrite. If a contract or prerequisite is missing, record the blocker.
Mark a card complete only with its acceptance evidence; report changed files, checks
run, and remaining limitations. These TODOs do not authorize deployment, publishing,
live messages, or changes to production data.

- [ ] **MWEB-01 — Reconcile forward priorities with current routes and fixed mail bugs** (ready)
  - **Why:** Forward Priorities lists bugs as still present that the release section calls fixed; current App.tsx routes only the reduced tool surface.
  - **Start here:** ROADMAP.md, docs/MAIL_BUGS.md, docs/MAIL_ROADMAP.md, src/App.tsx, src/tools/registry.ts.
  - **Do:** Audit the specifically cited bug IDs against their test/code evidence. Remove contradictory still-present claims, distinguish unrouted historical pages from current UI, and keep the actual remaining mail items linked to their detailed backlog.
  - **Done when:** Current priorities do not reassign fixed work or imply an unrouted page is active. Preserve dated history; no routes are re-enabled in this task.

- [ ] **MWEB-02 — Load the Mail page on demand** (ready)
  - **Why:** The parent roadmap identifies a single large initial JS chunk; App.tsx eagerly imports MailPage.
  - **Start here:** src/App.tsx, src/tools/mail/MailPage.tsx, src/components/Layout.test.tsx, package.json.
  - **Do:** Convert only MailPage to React.lazy with a visible Suspense fallback in the authenticated route. Preserve the auth guard and existing navigation. Do not migrate routing libraries or change other pages.
  - **Done when:** Run npm test -- --run and npm run build. Inspect build output to confirm a separate Mail chunk; manually check logged-in direct /mail navigation and logged-out redirect. No size improvement is claimed without measured output.

## Post-v0.1 (2026-05-11 → 2026-05-18)

- **TS toolchain bump** (commit `c0f5df1`, 2026-05-16): `typescript` from `~5.4.0` → `^5.9.0`. The old `tsc` was silently skipping type errors that newer `tsconfig.app.json` semantics actually catch — fixing this surfaced and resolved a batch of latent type errors. Removed unused `accountNames` useMemo and `clearView` function in `src/tools/mail/MailPage.tsx` along the way. Vitest 190/190 passing.
- **Docker build-args wired** (commit `1c22dc0`, 2026-05-17): `VITE_API_BASE_URL`, `VITE_DEVTEAM_API_URL`, `VITE_API_KEY`, `VITE_DEVTEAM_API_KEY`, and `VITE_DEV_MODE` are now declared as `ARG`s in `Dockerfile`, so `--build-arg` actually takes effect in the SPA bundle (previously these were `ENV`-only and silently ignored at build time). See `HOWTO.md` → "Docker Production Build".

## Released — 2026-05-11 (MyProject v0.1)

- Mail page critical crash fixed (bug #6): `readMail()` 404 no longer crashes via `.length`-on-undefined; defensive shape-guards + status-aware error banner via existing `SET_ERROR` reducer.
- Mail UX bugs fixed: #2 dev-button gate tightened with `import.meta.env.DEV` (production builds always strip dev buttons even if `VITE_DEV_MODE=true` leaks); #4 onboarding banner triggers proactively in dev mode; #5 re-analyze button tooltip covers the loading-disabled state; #16 server-search button renamed and tooltip distinguishes it from the inline filter.
- Docs split: README carved into the standard 4-doc set (README + ARCHITECTURE + ROADMAP + HOWTO); `docs/MAIL_BUGS.md` migrated from user memory and reconciled against current code (10/16 already-fixed, 5 fixed this release, 1 deferred upstream).
- +5 new tests; full suite 186/187 at v0.1 (1 pre-existing baseline failure in `src/api/client.test.ts > apiFetch` — now passing after the TS bump, 190/190).

## Status — 2026-05-10

Active iteration on mail, news, and settings. Recent commits show a sustained
push on the personal news curation pipeline (Phases 1-5 marked complete) plus
ongoing mail hardening.

## Recently Shipped (last 10 commits)

```
dfada2b docs: mark Phase 5 (personal news agent) as complete
717cb79 feat: add profile settings with interests
49c38fe feat: add For You tab with curated feed and article ratings
0bcf03c feat: add frontend API clients for profile, schedule, and curated feed
6cb8ed8 docs: add core agent implementation plan (14 tasks, 5 chunks)
b61d02c docs: add core agent & personal news curation design spec
700c998 fix: search page audit — UI, security cleanup, markdown, tests
52d9463 feat: news page phases 1-4 complete, roadmap updated for personal agent
5d05476 feat: initial MyProject repo with MyWeb frontend and news page
```

Visible deliveries since the previous baseline:

- News page personalization, including For You tab and article ratings
- Profile interests UI in Settings (`src/tools/SettingsPage.tsx`)
- Frontend API clients for profile, schedule, and curated feed
  (`src/api/profile.ts`, `src/api/schedule.ts`, `src/api/news.ts`)
- Mail crash fix and error banner this release (see `docs/MAIL_BUGS.md` bug
  #6, fixed 2026-05-10)

## Forward Priorities

Mail:

- Work the open items in `docs/MAIL_ROADMAP.md` (reply, mark read/unread,
  snooze, etc.).
- Burn down the live bug list in `docs/MAIL_BUGS.md` (items #2, #4, #5, #7,
  #16 are still-present).

News:

- Continue the personal news agent track per `docs/MAIL_ROADMAP.md`-style
  follow-ups (recent commits indicate Phase 5 just landed; next phase work
  should be tracked in a future news-specific doc when it exists).

Other:

- No other claims tracked here — if a priority is not cited above, it is not
  on the roadmap. Add an entry with a citation before doing the work.

## Stable Release Plan

A repo-root `STABLE_RELEASE_PLAN.md` (untracked at time of writing) drives
chunked release work. This roadmap is the MyWeb-scoped view; the release plan
is the cross-project sequencing.
