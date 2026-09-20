# MyMobile roadmap

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

- [ ] **MOB-01 — Add an explicit TypeScript verification script** (ready)
  - **Why:** The mobile package has tests but no typecheck script, making a basic agent completion check harder to discover.
  - **Start here:** package.json, tsconfig.json, README.md.
  - **Do:** Add typecheck: tsc --noEmit to scripts and document it beside npm test. Run it with the installed project TypeScript. Fix only small local typing errors; list broad pre-existing failures rather than disabling checks.
  - **Done when:** npm run typecheck succeeds or the exact pre-existing blocker is recorded. Existing Jest tests still run with npm test -- --runInBand; no Expo/React Native upgrade.

- [ ] **MOB-02 — Add a first mail-screen regression test** (ready)
  - **Why:** README explicitly requests screen tests; existing tests exercise API/helpers rather than React Native screens.
  - **Start here:** app/mail.tsx, __tests__/applyRecommendation.test.ts, jest.config.js, package.json, __tests__/mail.test.tsx (new).
  - **Do:** Use a React Native Testing Library version compatible with the installed React/React Native peer dependencies. Mock SecureStore, navigation, and mail API. Add one screen test that cancels Apply all and one that confirms it for an actionable delete recommendation.
  - **Done when:** Cancellation sends no mutation; confirmation moves to Trash through the existing helper and never expunges. Run the focused Jest file and existing applyRecommendation tests. No live mailbox or new triage semantics.

Mobile-specific follow-ups. Cross-project status lives in [the parent roadmap](../ROADMAP.md).
