# Mail Page — Bug List

Migrated from `~/.claude/projects/-home-alex-projects-MyProject/memory/project_mail_bug_fixes.md` on 2026-05-10.
Source memory pointer should be updated to point here.

Status reconciliation done 2026-05-10 against `src/tools/mail/MailPage.tsx`.

## Open

### #7 — recommendationLabel returns "N/A" (Bug — investigate upstream)

- Symptom: `recommendationLabel()` returns the literal string `"N/A"` when
  no recommendation is present on a message.
- Suspected cause: Upstream analysis pipeline is not producing a
  recommendation for some messages. Root cause is **not** in `MailPage.tsx`;
  the `"N/A"` is just the fallback render at lines 44-46.
- Location: `src/tools/mail/MailPage.tsx` lines 44-46. Investigation needed
  in the analysis pipeline (outside this file).

## Fixed 2026-05-10 (UX batch)

- **#2 — Dev buttons leak into all environments**: `DEV_MODE` now also
  requires `import.meta.env.DEV`, so dev-only buttons disappear in
  production builds even when `.env` leaves `VITE_DEV_MODE=true`.
- **#4 — DEV_MODE shows empty list with no onboarding**: removed the
  `!DEV_MODE` gate on the on-mount setup check; the setup banner now
  appears whenever no IMAP accounts are configured, including in dev.
- **#5 — Re-analyze button has inconsistent tooltips**: the `title`
  attribute now also covers the loading-disabled state with explanatory
  copy ("Wait for the current operation to finish before re-analyzing").
- **#16 — Search bar mixes client- and server-side without visual cue**:
  server-search button relabeled to "search all mail (server)" with a
  `title` clarifying that typing filters loaded emails while the button
  queries the IMAP server.

## Recently Fixed

### #6 — Critical: openEmail crash (fixed 2026-05-10)

`openEmailRef` now has defensive guards, and a `SET_ERROR` action surfaces
a banner with `ApiError`-aware copy. Tests added in
`src/tools/mail/MailPage.test.tsx`.

## Verified Fixed / Dismissed 2026-05-10

- #1 — `loadMailPage()` (`MailPage.tsx` lines 546-554) treats 404 as empty
  state.
- #3 — `status` memo (`MailPage.tsx` lines 407-412) returns `"Error"` when
  `state.error` is set.
- #8 — Not a bug (Playwright snapshot artifact).
- #9 — `<li>` element (`MailPage.tsx` lines 1068-1080) has `onClick` wired.
- #10 — `useEffect` (`MailPage.tsx` lines 461-468) watches
  `state.activeFolder`.
- #11 — Bulk-bar dropdown (`MailPage.tsx` lines 1031-1033) filters via
  `state.activeFolder`.
- #12 — Highlight class is no longer gated on `detailOpen`.
- #13 — Keyboard handler reads through refs, avoiding stale closures.
- #14 — Detail-pane move dropdown (`MailPage.tsx` lines 1300-1304) filters
  via `state.activeFolder`.
- #15 — `handleMove()` (`MailPage.tsx` lines 602-617) optimistically removes
  the row and surfaces `actionError`.
