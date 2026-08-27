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

Also fixed this pass:

- **devTeam could not be installed from scratch.** `build-backend` pointed at the
  private `setuptools.backends._legacy:_Backend`, gone in setuptools 84 — so
  `pip install -e .`, the documented `make test` bootstrap, and any CI runner all
  failed on a clean machine. Now on `setuptools.build_meta` with explicit package
  discovery; verified by `rm -rf .venv && make test-all`.
- **CI added** — `.forgejo/workflows/ci.yml` in all three repos (see `HOWTO.md`).
  Caveat: never executed, runner label unconfirmed.

### Known gaps, not addressed this pass

- `MYDEVTEAM_*` env var names are shared by both services — one key grants access to
  both. Renaming is breaking for existing deployments; needs a decision.
- MyAgent serves unauthenticated when the key is empty (devTeam fails closed). Making
  MyAgent fail closed too is a behavior change for local dev workflows.
- CI workflows exist now (see below) but have **never been executed** — the runner
  label is a guess. Until a job goes green, nothing is actually enforced.
- MyWeb ships one 476 kB JS chunk (139 kB gzip) — no code splitting.

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
- Container fixes landed 2026-08-16 (bind/advertise split, boot path, `/healthz`) — see the production-readiness section above.
- Per-subproject roadmap: `devTeam/ROADMAP.md` — cite that file for forward-looking items.

### MyAgent — Active

- Tracked as a git submodule (`.gitmodules`); FastAPI gateway with structured tool dispatch over a local LLM. Voice-agent path live (Whisper transcription, device tokens, ntfy push).
- Next major thread: **voice-to-note (organize / summarize / integrate)** — promote raw voice transcripts into a structured PKM layer on top of the existing Whisper toolbox. Details in `MyAgent/ROADMAP.md` → Planned.
- In-progress thread: **BudgetAgent** — first MyAgent tool surface shipped 2026-06-27 for budget summary, transaction lookup, account listing, and guarded categorization over the headless `budget` service (homelab `apps/budget`); auto-categorize-on-import remains planned. Details in `MyAgent/ROADMAP.md` → Planned.
- Per-subproject roadmap: `MyAgent/ROADMAP.md`.

### MyWeb — Active

- Tracked directly in this repo (not a submodule). Budget page, AI-configs settings and the MyMobile-parity mail work landed 2026-08-16.
- React 19 + TS 5.9 + Vite 8 frontend for the whole tool suite.
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
- ~~**Naming-collision rename**~~ — done 2026-08-16. `MyAgent/README.md`, `CLAUDE.md`, and the stale `ROADMAP.md` entry now all say MyAgent. Env var names deliberately left alone (see gaps above).

## Out of scope here

No new features are invented in this document. For concrete forward-looking work, read the per-subproject `ROADMAP.md` files and `STABLE_RELEASE_PLAN.md`.
## Make this usable by others (added 2026-08-27)

- [ ] Universalize the README / docs / code for outside users: document setup
  from scratch on generic infrastructure, replace homelab-specific assumptions
  (private hostnames, LAN addresses, personal paths and defaults) with
  env-driven configuration plus examples, and keep the public GitHub mirror
  directly runnable.
