# MyProject

Monorepo of personal-productivity services and the web UI that fronts them. Three active backends (an agentic dev-team daemon, a personal LLM agent, and the React web app) plus an empty CLI stub. Owned by the `forgo` organization; primary repo host is `git.thelunadog.com` (Forgejo).

## Subprojects

| Name        | Description                                                            | Status               | Port  |
| ----------- | ---------------------------------------------------------------------- | -------------------- | ----- |
| `devTeam/`  | Agentic dev-team daemon (FastAPI, 5 AI agents via ollama)              | Active (2026-05-03)  | 4223  |
| `MyAgent/`  | Personal local-LLM agent gateway (FastAPI, structured tool dispatch)   | Active (2026-05-03)  | 8000  |
| `MyWeb/`    | React 19 + TS ~5.4.0 + Vite 8 tool-suite frontend                      | Active (uncommitted) | 5173  |
| `MyCli/`    | Empty stub, no tracked files                                           | Stub                 | n/a   |

The Discord music bot was extracted from this monorepo on 2026-05-11 — it now lives as a standalone repo at `../discord-bot/` (Forgejo: `alex/discord-bot`, GitHub: `ajpeders/discord-bot`).

Sources: `start-servers.sh`, `devTeam/config/local-test.yaml`, `MyWeb/package.json`.

## Quick start

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

See `ARCHITECTURE.md`, `ROADMAP.md`, and `HOWTO.md` in this directory. Stable-release work is tracked in `STABLE_RELEASE_PLAN.md`. Each active subproject also keeps its own README/ARCHITECTURE/ROADMAP/HOWTO.
