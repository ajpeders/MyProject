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

## Repo layout and submodules

```
MyProject/                       # this repo
├── devTeam/    (own .git)       # FastAPI agentic dev-team daemon
├── MyAgent/    (own .git)       # FastAPI personal LLM agent
├── MyWeb/                       # React 19 + TS ~5.4.0 + Vite 8 SPA
├── MyCli/                       # empty stub
├── start-servers.sh             # boots devTeam + MyAgent + MyWeb
├── STABLE_RELEASE_PLAN.md
└── .logs/                       # runtime logs from start-servers.sh
```

`devTeam` and `MyAgent` are tracked as git submodules (see `.gitmodules`) pinned at specific commits. Clone with `git clone --recurse-submodules` to fetch them, or run `git submodule update --init --recursive` after a plain clone. To advance a pinned commit: `cd` into the submodule, check out the target ref, then at the root `git add <submodule>` and commit the pointer bump. See `HOWTO.md` for the full workflow.

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
