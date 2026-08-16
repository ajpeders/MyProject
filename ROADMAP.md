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

## Post-v0.1 work (2026-05-11 → 2026-05-18)

Material changes since the v0.1 tag, in addition to per-subproject roadmaps:

- **devTeam** — Dockerfile + `.dockerignore` for containerized runs; `DEVTEAM_API_ADDRESS` env override for bind address (so 0.0.0.0 works under Docker); per-user API key management endpoints (`/api/key/{create,list,delete}`, sha256-hashed) with fail-closed admin gate; `MYDEVTEAM_ALLOWED_ORIGINS` for configurable CORS; runtime dep declaration fix in `pyproject.toml`. Test count: 57 API tests (up from 46 at v0.1).
- **MyAgent** — Voice-agent path shipped: `services/whisper/*` package with faster-whisper transcription, single-shot voice→tool→reply pipeline, async jobs (`voice_jobs` table), device tokens (`device_tokens` table, `whsk_*` prefix) for iPhone Shortcuts, ntfy.sh push for async results. `read_mail` tool added to the voice toolbox. Dockerfile + `.dockerignore` shipped. DB path made configurable via `MYDEVTEAM_DATA_DIR`.
- **MyWeb** — TypeScript bumped 5.4 → 5.9 (toolchain fix; older tsc was silently skipping type errors). Dockerfile build-args declared for `VITE_*` env vars so `--build-arg` actually bakes them into the SPA bundle.
- **Root** — Submodules: `devTeam/` and `MyAgent/` are now tracked as git submodules in `.gitmodules`; `docker-compose.yml` boots the full stack with `docker compose up --build` (containers reach host ollama via `host.docker.internal`).

These will land in v0.2 when tagged; for the per-feature changelog of each subproject, see its own `ROADMAP.md`.

## Status by subproject

### devTeam — Active

- Tracked as a git submodule (`.gitmodules`); FastAPI agentic dev-team daemon with 5 AI agents (orchestrator, dev, review, QA, deploy) via ollama.
- Per-subproject roadmap: `devTeam/ROADMAP.md` — cite that file for forward-looking items.

### MyAgent — Active

- Tracked as a git submodule (`.gitmodules`); FastAPI gateway with structured tool dispatch over a local LLM. Voice-agent path live (Whisper transcription, device tokens, ntfy push).
- Next major thread: **voice-to-note (organize / summarize / integrate)** — promote raw voice transcripts into a structured PKM layer on top of the existing Whisper toolbox. Details in `MyAgent/ROADMAP.md` → Planned.
- In-progress thread: **BudgetAgent** — first MyAgent tool surface shipped 2026-06-27 for budget summary, transaction lookup, account listing, and guarded categorization over the headless `budget` service (homelab `apps/budget`); auto-categorize-on-import remains planned. Details in `MyAgent/ROADMAP.md` → Planned.
- Per-subproject roadmap: `MyAgent/ROADMAP.md`.

### MyWeb — Active

- Has uncommitted work in progress at the time of this writing (see top-level `git status`).
- React 19 + TS ~5.9 + Vite 8 frontend for the whole tool suite.
- Mail-page hardening tracked in `MyWeb/docs/MAIL_ROADMAP.md` and `MyWeb/docs/MAIL_BUGS.md`; news-page vision noted in user memory.
- Per-subproject roadmap: `MyWeb/ROADMAP.md` (added 2026-05-10 as part of the v0.1 doc split).

### MyMobile — Active (v0.1 scaffold)

- React Native + Expo SDK 53 + TypeScript phone app. Talks to the same `/api/*` gateway as MyWeb over HTTPS.
- v1 scope (shipped at scaffold time): login/register, mail list, per-row Apply, bulk Apply-all. Mirrors MyWeb's mail-triage UX so "delete = Trash, never expunge" is enforced identically on both clients.
- No IMAP setup or AI-config management on mobile yet — those stay on the web for now; mobile is read+triage.
- Distribution: Expo Go for dev/test, EAS Build for store/sideload later.
- See `MyMobile/README.md` for run instructions and follow-up ideas (push notifications, voice capture, on-device IMAP setup, iPhone on-device LLM support).

### MyCli — Stub

- Empty directory; no tracked files.
- No work planned at this layer.

## Cross-cutting work

- **Stable release**: `STABLE_RELEASE_PLAN.md` is the historical v0.1 execution log; v0.2 will be cut once the post-release work above is verified end-to-end.
- **Submodule bootstrap**: `git clone --recurse-submodules` (or `git submodule update --init --recursive` after a plain clone) pulls `devTeam/` and `MyAgent/`. See `HOWTO.md`.

## Out of scope here

No new features are invented in this document. For concrete forward-looking work, read the per-subproject `ROADMAP.md` files and `STABLE_RELEASE_PLAN.md`.
