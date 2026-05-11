# Roadmap

Top-level status. Detailed roadmaps live inside each active subproject. Stable-release work is tracked in `STABLE_RELEASE_PLAN.md` at the repo root.

## Released — 2026-05-11 (v0.1)

First tagged stable release of the MyProject monorepo. Headline changes:

- **Docs aligned across all active subprojects**: README/ARCHITECTURE/ROADMAP/HOWTO grep-verified against current code for `devTeam`, `MyAgent`, `MyWeb`, and the monorepo root (root was previously bare).
- **`musicBot` extracted from monorepo**: the dormant Discord music bot was moved out to its own standalone repo at the sibling path `../discord-bot/` (Forgejo: `alex/discord-bot`, GitHub: `ajpeders/discord-bot`). The 4-doc set seeded for it during this release shipped in that repo's first push.
- **MyAgent unblocked for editable install**: `pyproject.toml` packaging fix — `pip install -e .` works again.
- **MyWeb mail page hardened**: critical opening-email crash (bug #6) fixed with a real surfaced error; 4 UX bugs (#2, #4, #5, #16) fixed; bug list migrated from user memory to `MyWeb/docs/MAIL_BUGS.md` and reconciled against current code.
- **Test deltas**: MyWeb 181 → 186 passing (+5 new tests, 0 regressions). devTeam 38 passing (stable). MyAgent 291 passing (2 pre-existing baseline failures, not introduced by this release).

See `STABLE_RELEASE_PLAN.md`'s execution log for the per-chunk audit trail.

## Status by subproject

### devTeam — Active

- Last commit: 2026-05-03 (`feat: wire sibling_context into dev agent LLM prompt`).
- Owns its own `.git`; FastAPI agentic dev-team daemon with 5 AI agents (orchestrator, dev, review, QA, deploy) via ollama.
- Per-subproject roadmap: `devTeam/ROADMAP.md` — cite that file for forward-looking items.

### MyAgent — Active

- Last commit: 2026-05-03 (58 commits on `main` per audit).
- Owns its own `.git`; FastAPI gateway with structured tool dispatch over a local LLM.
- Per-subproject roadmap: `MyAgent/ROADMAP.md`.

### MyWeb — Active

- Has uncommitted work in progress at the time of this writing (see top-level `git status`).
- React 19 + TS ~5.4.0 + Vite 8 frontend for the whole tool suite.
- Mail-page hardening tracked in `MyWeb/docs/MAIL_ROADMAP.md` and `MyWeb/docs/MAIL_BUGS.md`; news-page vision noted in user memory.
- Per-subproject roadmap: `MyWeb/ROADMAP.md` (added 2026-05-10 as part of the v0.1 doc split).

### MyCli — Stub

- Empty directory; no tracked files.
- No work planned at this layer.

## Cross-cutting work

- **Stable release**: see `STABLE_RELEASE_PLAN.md` for the active release-stabilization plan (release blockers, doc truth-up, missing-doc creation, mail bug sweep, release tag).
- **Naming-collision rename**: `MyAgent/README.md` is mistitled `# MyDevTeam` and should be renamed to match the actual service. Flagged in `ARCHITECTURE.md` as a follow-up.
- **Bootstrap docs**: nested `.git` repos in `devTeam/` and `MyAgent/` mean a fresh clone of `MyProject` does not pull subproject code. `TODO: verify` whether a bootstrap script exists or one is planned.

## Out of scope here

No new features are invented in this document. For concrete forward-looking work, read the per-subproject `ROADMAP.md` files and `STABLE_RELEASE_PLAN.md`.
