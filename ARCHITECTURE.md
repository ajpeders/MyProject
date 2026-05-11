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

## Naming collision

Both `devTeam/README.md` and `MyAgent/README.md` are titled `# MyDevTeam`. Based on its actual contents (agentic dev-team daemon with 5 AI agents), `devTeam/` is the real "MyDevTeam"; `MyAgent/README.md` is mistitled. Flagged as a follow-up rename for the user — do not auto-rename.

## Repo layout and nested `.git` notes

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

`devTeam` and `MyAgent` each carry their own `.git` directory; they are independent Forgejo repos checked out side-by-side rather than git submodules. Cloning `MyProject` alone will not pull them — clone each subproject separately when bootstrapping a fresh machine. No bootstrap/clone-all script exists today.

The Discord bot (formerly `musicBot/` inside this monorepo) was extracted on 2026-05-11 to its own standalone repo at the sibling path `../discord-bot/` — see `discord-bot/README.md` there.

## Subproject summaries

- **devTeam** — FastAPI HTTP daemon with SQLAlchemy + SQLite (WAL), `AgentManager`, optional NATS sync. Agents: Orchestrator, Dev, PRManager (review), QA, Deploy. LLM calls via `litellm` against ollama or cloud providers. See `devTeam/ARCHITECTURE.md`.
- **MyAgent** — FastAPI gateway exposing structured tool dispatch over a local LLM (default `qwen3:8b` via ollama). Persists sessions in `MyAgent/sessions.db`. See `MyAgent/ARCHITECTURE.md`.
- **MyWeb** — Browser-only SPA shell exposing mail, news, search, chat, memory, calendar, admin, settings, devteam, whisper, and agent pages under one authenticated layout. See `MyWeb/ARCHITECTURE.md`.
- **MyCli** — Empty directory with no tracked files.
