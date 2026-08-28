# Architecture

Top-level view of the MyProject monorepo. For per-service internals, read the `ARCHITECTURE.md` inside each active subproject (`devTeam/`, `MyAgent/`, `MyWeb/`).

## Data flow

```
                  ┌───────────────────────────┐
                  │ Browser (user)            │
                  └─────────────┬─────────────┘
                                │  HTTP
                                ▼
                  ┌───────────────────────────┐
                  │ MyWeb  (Vite dev :5173)   │
                  │ React 19 + TS + Vite 8    │
                  └──────┬─────────────┬──────┘
                         │             │
              Vite /api  │             │  direct fetch
              proxy      │             │  (X-Api-Key)
                         ▼             ▼
            ┌──────────────────┐  ┌──────────────────┐
            │ MyAgent  :8000   │  │ devTeam  :4223   │
            │ FastAPI gateway  │  │ FastAPI daemon   │
            │ (tool dispatch)  │  │ (5 AI agents)    │
            └──────────────────┘  └──────────────────┘
```

Verified:

- `MyWeb/package.json` declares Vite 8 dev server (`npm run dev`).
- `start-servers.sh` binds MyAgent to `${MYAGENT_HOST:-127.0.0.1}:${MYAGENT_PORT:-8000}` and prints `devTeam: http://localhost:4223`.
- `devTeam/config/local-test.yaml` sets `api.address: localhost:4223`.
- `MyWeb/src/api/client.ts` is the MyAgent client; `MyWeb/src/api/devteam.ts` is the devTeam client.
- No runtime call from MyAgent into devTeam exists. The only `devteam`-shaped string under `MyAgent/src/` is the `mydevteam-sandbox` Docker container name in `src/core/docker.py:6` (sandboxed shell execution), unrelated to the devTeam dev-daemon on port 4223.

## Containerized deployment

`docker-compose.yml` builds all three services. Two facts drive most of its shape:

- **Bind address ≠ advertised address (devTeam).** `api.address` is what agent
  subprocesses dial back on (`DEVTEAM_SOCKET`); `api.bind_address` is what uvicorn
  listens on. In a container these must differ — bind `0.0.0.0:4223` so the published
  port works, while agents (which run *inside* that container) keep using
  `localhost:4223`. `config/docker.yaml` sets both; `local-test.yaml` sets only
  `address` and is for native dev.
- **MyWeb config is build-time.** The SPA is static files behind nginx, so every
  `VITE_*` value is baked into the bundle by `docker compose build myweb`. Secrets
  placed there are public.

Health endpoints, all unauthenticated so orchestrators can probe them:

| Service | Endpoint   | Reports                                     |
| ------- | ---------- | ------------------------------------------- |
| devTeam | `/healthz` | process liveness + `node_id` (not agent/LLM health) |
| MyAgent | `/health`  | process liveness                            |
| MyWeb   | `/healthz` | nginx is serving (static 200 from nginx.conf) |

`myweb` waits on `service_healthy` for both backends. State persists in named volumes:
`devteam-data` at `/data` (task DB, agent logs, workspaces) and `myagent-data` at `/data`
(`MYDEVTEAM_DATA_DIR` — all MyAgent state is the single `data.db`).

Two MyAgent settings that only bite in a long-lived deployment, both now wired through
`.env`: `JWT_SECRET` (random per process if unset — every restart invalidates all
sessions) and `ALLOWED_ORIGINS` (code default `*`, which browsers reject because the app
sends credentials).

**Exposure.** Published ports bind to `127.0.0.1` unless `BIND_HOST` says otherwise.
Three facts compose badly: myagent mounts the host docker socket (root-equivalent), it
serves unauthenticated when `MYDEVTEAM_API_KEY` is empty, and published ports would
otherwise reach the LAN. That combination is why myagent was removed from the homelab
deploy on 2026-07-06 (`docker-compose.homelab.yml` header). Loopback is the safe default;
widen it only after setting the API key.

**Auth asymmetry, by design of the two codebases:** devTeam refuses to start without an
admin key; MyAgent treats an empty `MYDEVTEAM_API_KEY` as "no auth" and serves anyway
(`MyAgent/src/core/config.py:15`). Both read the *same* variable, so one key covers both
— and forgetting it leaves MyAgent open while devTeam merely fails to boot.

## Port assignments

| Service | Host (default)         | Port (default) | Set by                                       |
| ------- | ---------------------- | -------------- | -------------------------------------------- |
| MyWeb   | `127.0.0.1`            | `5173`         | `start-servers.sh` (`MYWEB_HOST`/`MYWEB_PORT`) |
| MyAgent | `127.0.0.1`            | `8000`         | `start-servers.sh` (`MYAGENT_HOST`/`MYAGENT_PORT`) |
| devTeam | `localhost`            | `4223`         | `devTeam/config/local-test.yaml` (`api.address`) |

## Auth schemes per edge

| Edge                  | Headers sent                                  | Source                                  |
| --------------------- | --------------------------------------------- | --------------------------------------- |
| Browser → MyWeb       | Browser session cookies / local-storage state | n/a (in-browser only)                   |
| MyWeb → MyAgent       | `X-API-Key`, `X-Session-ID`, `X-User-ID`      | `MyWeb/src/api/client.ts`, `mail.ts`, `whisper.ts` |
| MyWeb → devTeam       | `X-Api-Key` only                              | `MyWeb/src/api/devteam.ts`              |

Note the casing difference: MyAgent uses `X-API-Key` (uppercase API); devTeam uses `X-Api-Key`. Both spellings are present in the code today.

## Naming collision — resolved 2026-08-16

`MyAgent/` was briefly renamed "MyDevTeam" and then reverted, leaving stray references
behind. `devTeam/` is the real MyDevTeam (agentic dev-team daemon, 5 AI agents);
`MyAgent/` is the personal LLM gateway. Its `README.md`, `CLAUDE.md`, and the stale
`ROADMAP.md` rename entry now all say MyAgent.

One deliberate leftover: MyAgent's env vars are still named `MYDEVTEAM_API_KEY` /
`MYDEVTEAM_ADMIN_EMAILS`, and devTeam uses the same names. Renaming them is a breaking
change for every existing deployment and `.env`, so it is **not** done here — see
`ROADMAP.md`.

## Repo layout and submodules

```
MyProject/                       # this repo
├── devTeam/    (submodule)      # FastAPI agentic dev-team daemon
├── MyAgent/    (submodule)      # FastAPI personal LLM agent
├── MyWeb/                       # React 19 + TS 5.9 + Vite 8 SPA
├── MyCli/                       # empty stub
├── docker-compose.yml           # builds + runs all three services
├── .env.example                 # compose config; copy to .env (gitignored)
├── start-servers.sh             # native dev alternative to compose
├── STABLE_RELEASE_PLAN.md
└── .logs/                       # runtime logs from start-servers.sh
```

`devTeam` and `MyAgent` are tracked as git submodules (see `.gitmodules`, added 2026-05-16) pinned at specific commits. Clone with `git clone --recurse-submodules` to fetch them, or run `git submodule update --init --recursive` after a plain clone. To advance a pinned commit: `cd` into the submodule, check out the target ref, then at the root `git add <submodule>` and commit the pointer bump. See `HOWTO.md` for the full workflow.

The Discord bot (formerly `musicBot/` inside this monorepo) was extracted on 2026-05-11 to its own standalone repo at the sibling path `../discord-bot/` — see `discord-bot/README.md` there.

## Subproject summaries

- **devTeam** — FastAPI HTTP daemon with SQLAlchemy + SQLite (WAL), `AgentManager`, optional NATS sync. Agents: Orchestrator, Dev, PRManager (review), QA, Deploy. LLM calls via `litellm` against ollama or cloud providers. Ships with a Dockerfile for containerized runs. Auth surface includes per-user API key management (`/api/key/*` endpoints, sha256-hashed) and a fail-closed admin gate. See `devTeam/ARCHITECTURE.md`.
- **MyAgent** — FastAPI gateway exposing structured tool dispatch over a local LLM (default `qwen3:8b` via ollama). Persists sessions in `MyAgent/sessions.db` and structured data in `src/core/data.db` (path overridable via `MYDEVTEAM_DATA_DIR`). Includes a voice-agent path: `/api/whisper/transcribe`, `/api/whisper/agent`, `/api/whisper/agent/async`, device tokens (`whsk_*`) for iPhone Shortcuts, and ntfy.sh push for async results. See `MyAgent/ARCHITECTURE.md`.
- **MyWeb** — Browser-only SPA shell exposing mail, news, search, chat, memory, calendar, admin, settings, devteam, whisper, and agent pages under one authenticated layout. See `MyWeb/ARCHITECTURE.md`.
- **MyCli** — Empty directory with no tracked files.

## Voice-input path

```
iPhone Shortcut ──► MyAgent /api/whisper/agent[/async]   (X-Device-Token: whsk_*)
                       │
                       ├── transcribe via faster-whisper
                       ├── LLM picks one tool (save_note, recall_notes,
                       │     create_event, list_events, read_mail, search_web, answer)
                       └── async: result pushed via ntfy.sh; sync: result in response
```

Async jobs are recorded in `voice_jobs`; transcripts in `whisper_transcripts`; long-lived device tokens in `device_tokens`. All three tables live in MyAgent's SQLite DB.

## Containerized stack

`docker-compose.yml` at the repo root builds and runs all three services (devTeam, MyAgent, MyWeb) with the same port mappings as the script-based flow. Each subproject ships its own `Dockerfile`. Containers reach the host's ollama at `host.docker.internal:11434` via the `host-gateway` extra_host alias. MyAgent mounts `/var/run/docker.sock` to spawn its alpine sandbox container — required by design, grants root-equivalent host access. See `HOWTO.md` for prereqs and caveats.
