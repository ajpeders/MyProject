# Roadmap

## Released — 2026-05-11 (MyProject v0.1)

- Mail page critical crash fixed (bug #6): `readMail()` 404 no longer crashes via `.length`-on-undefined; defensive shape-guards + status-aware error banner via existing `SET_ERROR` reducer.
- Mail UX bugs fixed: #2 dev-button gate tightened with `import.meta.env.DEV` (production builds always strip dev buttons even if `VITE_DEV_MODE=true` leaks); #4 onboarding banner triggers proactively in dev mode; #5 re-analyze button tooltip covers the loading-disabled state; #16 server-search button renamed and tooltip distinguishes it from the inline filter.
- Docs split: README carved into the standard 4-doc set (README + ARCHITECTURE + ROADMAP + HOWTO); `docs/MAIL_BUGS.md` migrated from user memory and reconciled against current code (10/16 already-fixed, 5 fixed this release, 1 deferred upstream).
- +5 new tests; full suite 186/187 (1 pre-existing baseline failure in `src/api/client.test.ts > apiFetch`).

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
