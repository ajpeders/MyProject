# Roadmap

Top-level status. Detailed roadmaps live inside each active subproject. Stable-release work is tracked in `STABLE_RELEASE_PLAN.md` at the repo root.

## Production-readiness pass — 2026-08-16

The compose stack existed since 2026-05-14 but had never been run end to end. It could
not have worked; fixed and verified this pass (`docker compose ps` → all three healthy):

- **devTeam was unreachable in containers.** `api.address` drove both the uvicorn bind
  *and* the address agents dial back on, so no single value worked. Split into
  `api.bind_address` (listen) vs `api.address` (advertise), added `config/docker.yaml`.
- **devTeam crash-looped at boot.** `CMD uv run …` re-resolved dependencies at container
  start and failed to build the project. Deps are resolved at build time now; the image
  runs `.venv/bin/python` directly.
- **MyAgent froze its own event loop.** `NewsCurator.curate()` is async but called the
  blocking `complete_sync`, so the scheduler's curation batch stalled every in-flight
  request — the gateway never finished startup and `/health` was unreachable. Now awaits
  `complete()`; regression test asserts `complete_sync` is not called.
- **No health endpoints.** Added unauthenticated `GET /healthz` to devTeam; compose now
  healthchecks all three and gates `myweb` on both backends.
- **State was destroyed on every rebuild.** Named volumes for devTeam (`/data`) and
  MyAgent (`MYDEVTEAM_DATA_DIR=/data` — which already existed and was simply unused).
- **Secrets.** Removed the hardcoded admin key from the container config path (fail-closed
  via env instead), added `.env.example`, gitignored `.env`.
- **MyWeb lint clean.** 3 `set-state-in-effect` errors fixed by deriving state rather
  than synchronizing it. 0 errors; 3 pre-existing `exhaustive-deps` warnings remain.

Test counts verified this pass: **MyWeb 190**, **MyAgent 316**, **devTeam 151** — all
passing, no known failures. (Previous docs claimed 186/291/38 with 3 baseline failures.)

### Known gaps, not addressed this pass

- `MYDEVTEAM_*` env var names are shared by both services — one key grants access to
  both. Renaming is breaking for existing deployments; needs a decision.
- MyAgent serves unauthenticated when the key is empty (devTeam fails closed). Making
  MyAgent fail closed too is a behavior change for local dev workflows.
- No CI runs any of these suites; nothing enforces the counts above.
- MyWeb ships one 476 kB JS chunk (139 kB gzip) — no code splitting.

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

- Last commit: 2026-05-17 (`feat(auth): API key management with fail-closed admin gate + configurable CORS`), plus the uncommitted container fixes from the 2026-08-16 pass above.
- Git submodule; FastAPI agentic dev-team daemon with 5 AI agents (orchestrator, dev, review, QA, deploy) via ollama.
- Per-subproject roadmap: `devTeam/ROADMAP.md` — cite that file for forward-looking items.

### MyAgent — Active

- Last commit: 2026-05-14 (`chore: add Dockerfile and .dockerignore for containerized runs`).
- Git submodule; FastAPI gateway with structured tool dispatch over a local LLM.
- Per-subproject roadmap: `MyAgent/ROADMAP.md`.

### MyWeb — Active

- Tracked directly in this repo (not a submodule). Last change: 2026-05-17 TS 5.9 upgrade + VITE build args.
- React 19 + TS 5.9 + Vite 8 frontend for the whole tool suite.
- Mail-page hardening tracked in `MyWeb/docs/MAIL_ROADMAP.md` and `MyWeb/docs/MAIL_BUGS.md`; news-page vision noted in user memory.
- Per-subproject roadmap: `MyWeb/ROADMAP.md` (added 2026-05-10 as part of the v0.1 doc split).

### MyCli — Stub

- Empty directory; no tracked files.
- No work planned at this layer.

## Cross-cutting work

- **Stable release**: see `STABLE_RELEASE_PLAN.md` for the active release-stabilization plan (release blockers, doc truth-up, missing-doc creation, mail bug sweep, release tag).
- ~~**Naming-collision rename**~~ — done 2026-08-16. `MyAgent/README.md`, `CLAUDE.md`, and the stale `ROADMAP.md` entry now all say MyAgent. Env var names deliberately left alone (see gaps above).
- ~~**Bootstrap docs**~~ — done. `devTeam/` and `MyAgent/` became git submodules on 2026-05-16; `git clone --recurse-submodules` is the bootstrap, documented in `README.md` and `HOWTO.md`.

## Out of scope here

No new features are invented in this document. For concrete forward-looking work, read the per-subproject `ROADMAP.md` files and `STABLE_RELEASE_PLAN.md`.
