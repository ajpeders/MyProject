# Roadmap

Top-level status and backlog. Detailed roadmaps live inside each active subproject; this file holds cross-cutting and monorepo-level work.

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

- [ ] **MP-01 — Reconcile the subproject status table** (ready)
  - **Why:** The root describes MyMobile as SDK 53 without IMAP/AI settings; its package and README now describe SDK 54 and both settings surfaces.
  - **Start here:** ROADMAP.md, README.md, MyMobile/package.json, MyMobile/README.md, MyWeb/src/App.tsx.
  - **Do:** Update only the current-status prose and links using the checked-in manifests and routes. Preserve dated release history. Add the MyMobile roadmap link; keep MyCli explicitly a stub.
  - **Done when:** Every active subproject links to its own roadmap; current mobile capabilities and versions match files; historical release notes remain intact.

- [ ] **MP-02 — Document service-specific local health checks** (ready)
  - **Why:** The stack now has health checks, but old readiness notes mix local evidence with unverified CI/deployment status.
  - **Start here:** docker-compose.yml, HOWTO.md, devTeam/config/docker.yaml, MyAgent/README.md.
  - **Do:** Add a short troubleshooting table with each service, configured health path, container port, and a local read-only check. Explain bind versus advertised address using the actual config. Do not boot or deploy the production stack.
  - **Done when:** Check each path and port against Compose and route definitions; commands use placeholders and distinguish container checks from host checks. No credentials appear in examples.


**Points** rate difficulty for agent dispatch (1/2/3/5/8): 1–2 = mechanical, safe for an unattended agent; 3 = needs codebase context; 5–8 = design judgment or cross-service work, human review expected.

## Status (2026-09-19)

- **Deployment**: only `myproject-web` runs on the homelab (CD via `bin/deploy.d/myproject.conf`, CI gate `.forgejo/workflows/ci.yml`). `myagent` and devTeam containers are paused/dormant since 2026-07 — deliberately: myagent mounts the docker socket and serves unauthenticated when `MYDEVTEAM_API_KEY` is empty (see ARCHITECTURE.md "Exposure").
- **Compose stack**: verified end-to-end 2026-08-16 (production-readiness pass — see History); all three services healthcheck green.
- **Tests** (verified 2026-08-16): MyWeb 190, MyAgent 316, devTeam 151 — all passing.
- **devTeam** — Active codebase, dormant deployment. Submodule. See `devTeam/ROADMAP.md`.
- **MyAgent** — Active. Submodule; currently has uncommitted content drift (see backlog). Voice-agent path live. See `MyAgent/ROADMAP.md`.
- **MyWeb** — Active, deployed. Budget page, AI-configs settings and MyMobile-parity mail work landed 2026-08-16. Mail-page work tracked in `MyWeb/docs/MAIL_ROADMAP.md` / `MAIL_BUGS.md`. See `MyWeb/ROADMAP.md`.
- **MyMobile** — Active (v1 = mail triage). Expo SDK 54 / RN 0.81. Login, mail list, per-row + bulk Apply, AI-config and IMAP settings. See `MyMobile/README.md`.
- **MyCli** — Empty stub, no work planned (candidate for deletion, see backlog).

## Backlog

| Pts | Item | Notes / acceptance |
|-----|------|--------------------|
| 1 | Delete or repurpose the empty `MyCli/` stub | If deleted: remove from README table, ARCHITECTURE layout, and `.gitignore`/tooling references. |
| 2 | Triage the dirty `MyAgent` submodule drift | `git status` shows modified content in `MyAgent`. Commit it in the submodule repo + bump the pointer, or discard. A dirty tree pauses homelab deploys. |
| 2 | Verify the subproject CI workflows actually execute | The three `.forgejo/workflows/ci.yml` files (added 2026-08-16) have never run — the runner label is a guess. Done when a job goes green in each repo. |
| 2 | Document the CI gate + homelab deploy path in `HOWTO.md` | Cover `.forgejo/workflows/ci.yml`, `docker-compose.homelab.yml`, and how `bin/deploy` (homelab repo) gates on CI. |
| 3 | Make MyAgent fail closed on empty `MYDEVTEAM_API_KEY` | Today empty = no auth, it serves anyway (devTeam refuses to start). Behavior change for local dev — needs an explicit opt-out for dev workflows. |
| 3 | Decide on the shared `MYDEVTEAM_*` env var names | MyAgent and devTeam read the same key names, so one key grants access to both. Renaming breaks existing deployments; needs a decision + migration note. |
| 3 | Unify `X-API-Key` vs `X-Api-Key` header casing | MyAgent uses `X-API-Key`, devTeam `X-Api-Key` (see ARCHITECTURE.md "Auth schemes"). Pick one, accept both server-side during transition, update MyWeb/MyMobile clients + tests. |
| 3 | Code-split MyWeb's bundle | Ships one 476 kB JS chunk (139 kB gzip) today. Route-level splitting; done when no initial chunk exceeds ~200 kB. |
| 3 | Cut and tag v0.2 | Post-v0.1 work is verified (2026-08-16 pass); tag once CI is proven green end-to-end. |
| 3 | Universalize the docs/code for outside users | Document setup from scratch on generic infra; replace homelab-specific hostnames/paths with env-driven config + examples; keep the public GitHub mirror runnable. |
| 5 | Harden MyAgent's `/var/run/docker.sock` mount | Root-equivalent host access today (sandbox spawning). Options: docker-socket-proxy, rootless runtime, or drop the sandbox tool. Requires a design decision. |
| 5 | BudgetAgent: auto-categorize-on-import | Extend the 2026-06-27 BudgetAgent tool surface (summary/lookup/listing/guarded categorization) to categorize automatically at import time. Details in `MyAgent/ROADMAP.md`. |
| 5 | MyMobile: push notifications for mail triage | New actionable mail → push. MyAgent already has ntfy push for voice jobs; decide ntfy vs Expo push, add server trigger + client registration. |
| 8 | Voice-to-note PKM layer | Promote raw voice transcripts into organized/summarized/integrated notes on top of the Whisper toolbox. Details in `MyAgent/ROADMAP.md` → Planned. |

## History

### Production-readiness pass — 2026-08-16

The compose stack existed since 2026-05-14 but had never been run end to end. Fixed and verified this pass (`docker compose ps` → all three healthy):

- **devTeam was unreachable in containers.** `api.address` drove both the uvicorn bind *and* the agents' dial-back address. Split into `api.bind_address` (listen) vs `api.address` (advertise), added `config/docker.yaml`.
- **devTeam crash-looped at boot.** `CMD uv run …` re-resolved deps at container start. Deps now resolve at build time; the image runs `.venv/bin/python` directly.
- **MyAgent froze its own event loop.** Async `NewsCurator.curate()` called blocking `complete_sync`, stalling the gateway at startup. Now awaits `complete()`; regression test guards it.
- **Health endpoints** added (`/healthz` on devTeam); compose healthchecks all three and gates `myweb` on both backends.
- **State survives rebuilds** via named volumes (devTeam `/data`, MyAgent `MYDEVTEAM_DATA_DIR=/data`).
- **Secrets**: hardcoded admin key removed from the container config path (fail-closed via env), `.env.example` added, `.env` gitignored.
- **devTeam installable from scratch**: `build-backend` moved off the private setuptools legacy backend to `setuptools.build_meta`; verified `rm -rf .venv && make test-all`.
- **CI added** — `.forgejo/workflows/ci.yml` in all three repos. Never executed yet (see backlog).
- Test counts verified: MyWeb 190, MyAgent 316, devTeam 151 (previous docs claimed 186/291/38).

### Released — 2026-05-11 (v0.1)

First tagged stable release of the MyProject monorepo. Headline changes:

- **Docs aligned across all active subprojects**: README/ARCHITECTURE/ROADMAP/HOWTO grep-verified against current code for `devTeam`, `MyAgent`, `MyWeb`, and the monorepo root (root was previously bare).
- **`musicBot` extracted from monorepo**: the dormant Discord music bot was moved out to its own standalone repo at the sibling path `../discord-bot/` (Forgejo: `alex/discord-bot`, GitHub: `ajpeders/discord-bot`).
- **MyAgent unblocked for editable install**: `pyproject.toml` packaging fix — `pip install -e .` works again.
- **MyWeb mail page hardened**: critical opening-email crash (bug #6) fixed; 4 UX bugs (#2, #4, #5, #16) fixed; bug list migrated to `MyWeb/docs/MAIL_BUGS.md`.

See `STABLE_RELEASE_PLAN.md`'s execution log for the per-chunk audit trail.

### Post-v0.1 (2026-05-11 → 2026-08-16) — lands in v0.2 when tagged

- **devTeam** — Dockerfile + `.dockerignore`; `DEVTEAM_API_ADDRESS` bind override; per-user API key endpoints (`/api/key/*`, sha256-hashed) with fail-closed admin gate; `MYDEVTEAM_ALLOWED_ORIGINS` CORS; runtime dep fix.
- **MyAgent** — Voice-agent path shipped: faster-whisper transcription, voice→tool→reply pipeline, async jobs (`voice_jobs`), device tokens (`whsk_*`) for iPhone Shortcuts, ntfy.sh push. `read_mail` tool. Dockerfile. `MYDEVTEAM_DATA_DIR` DB path override. BudgetAgent tool surface (2026-06-27).
- **MyWeb** — TypeScript 5.4 → 5.9 (older tsc silently skipped type errors); Dockerfile build-args for `VITE_*` vars; budget page + AI-configs settings + MyMobile-parity mail work (2026-08-16).
- **MyMobile** — Scaffolded and grown to v1: mail triage (Apply/Apply-all, delete-locked-to-Trash), settings with AI-config + IMAP CRUD.
- **Root** — `devTeam/` and `MyAgent/` converted to git submodules; root `docker-compose.yml` boots the full stack; `docker-compose.homelab.yml` + Forgejo CI gate (2026-08-16) wired for homelab CD; homelab deployment taken dormant except `myproject-web` (2026-07); naming-collision rename resolved 2026-08-16 (env var names deliberately kept — see backlog).
