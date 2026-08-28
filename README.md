# MyProject

Monorepo of personal-productivity services and the web UI that fronts them. Three active backends (an agentic dev-team daemon, a personal LLM agent, and the React web app) plus an empty CLI stub. Owned by the `forgo` organization; primary repo host is `github.com` (Forgejo).

## Subprojects

| Name        | Description                                                            | Status               | Port  |
| ----------- | ---------------------------------------------------------------------- | -------------------- | ----- |
| `devTeam/`  | Agentic dev-team daemon (FastAPI, 5 AI agents via ollama)              | Active (submodule)   | 4223  |
| `MyAgent/`  | Personal LLM agent gateway (FastAPI, tool dispatch + voice/Whisper)    | Active (submodule)   | 8000  |
| `MyWeb/`    | React 19 + TS 5.9 + Vite 8 tool-suite frontend (mail, news, whisper…)  | Active (in-repo)     | 5173  |
| `MyCli/`    | Empty stub, no tracked files                                           | Stub                 | n/a   |

`devTeam` and `MyAgent` are git submodules pinned at specific commits; the parent repo tracks the pointer SHA. `MyWeb` and `MyCli` are tracked directly in the parent repo. MyWeb has active uncommitted WIP — see `MyWeb/ROADMAP.md` for current threads.

The Discord music bot was extracted from this monorepo on 2026-05-11 — it now lives as a standalone repo at `../discord-bot/` (Forgejo: `alex/discord-bot`, GitHub: `ajpeders/discord-bot`).

Sources: `start-servers.sh`, `devTeam/config/local-test.yaml`, `MyWeb/package.json`.

## Quick start

Containers (closest to a production deploy):

```bash
git clone --recurse-submodules git@github.com:ajpeders/MyProject.git
cd MyProject
cp .env.example .env    # then set MYDEVTEAM_API_KEY — required, see HOWTO.md
docker compose up --build
```

All three services expose health endpoints (`:4223/healthz`, `:8000/health`,
`:5173/healthz`); `docker compose ps` shows `(healthy)` once they pass.

Native dev:

```bash
./start-servers.sh
```

This boots `devTeam` (port 4223), `MyAgent` (port 8000, via `MyAgent/start.sh`), and `MyWeb` (port 5173, via `npm run dev`). Logs land in `.logs/`. `MyCli` is not started.

Prerequisites (per `start-servers.sh` and subproject docs):

- `python3` (devTeam prefers `devTeam/.venv/bin/python` if present)
- `MyAgent/.venv` and `MyAgent/start.sh` configured
- `npm` and `MyWeb/node_modules` installed (`cd MyWeb && npm install`)
- Local `ollama` reachable at `http://localhost:11434` (used by devTeam agents per `devTeam/config/local-test.yaml`)

## Documentation

See `ARCHITECTURE.md`, `ROADMAP.md`, and `HOWTO.md` in this directory. The v0.1 release plan is preserved in `STABLE_RELEASE_PLAN.md` (historical execution log — not a live changelog). Each active subproject also keeps its own README/ARCHITECTURE/ROADMAP/HOWTO.
