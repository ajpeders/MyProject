# HOWTO

Operational recipes for the MyProject monorepo. For per-service procedures (auth, IMAP, chat, memory, calendar, admin, agents), read the `HOWTO.md` inside each active subproject.

## Start everything

```bash
./start-servers.sh
```

This script lives at the repo root and is verified to boot, in order:

1. `devTeam` — `python -m daemon.main --config config/local-test.yaml` from `devTeam/`. Prefers `devTeam/.venv/bin/python` if present, otherwise falls back to `python3`/`python`. Listens on `localhost:4223` per `devTeam/config/local-test.yaml`.
2. `MyAgent` — runs `./start.sh` from `MyAgent/` with `HOST` and `PORT` env vars (defaults `127.0.0.1:8000`).
3. `MyWeb` — `npm run dev -- --host 127.0.0.1 --port 5173` from `MyWeb/`.

Logs are written to `.logs/devteam.log`, `.logs/myagent.log`, and `.logs/myweb.log`. Press `Ctrl+C` once to stop all three (trap handler kills each PID).

Prerequisites before first run:

- `python3` on `PATH` (or `devTeam/.venv` populated).
- `MyAgent/.venv` populated and `MyAgent/start.sh` executable.
- `cd MyWeb && npm install` has been run at least once.
- Local `ollama` reachable at `http://localhost:11434` (devTeam agents and MyAgent both default to ollama models).

Overridable env vars (from the script):

- `MYAGENT_HOST`, `MYAGENT_PORT` (default `127.0.0.1`, `8000`)
- `MYWEB_HOST`, `MYWEB_PORT` (default `127.0.0.1`, `5173`)
- `LOG_DIR` (default `<repo>/.logs`)

`MyCli` is not part of `start-servers.sh`. (The Discord bot — formerly `musicBot/` here — was extracted to a standalone sibling repo `../discord-bot/` on 2026-05-11.)

## Run tests across subprojects

### devTeam

```bash
cd devTeam
make test
```

`devTeam/Makefile` declares `test: test-api test-agents`, running `pytest daemon/api/test_server.py -q` and the agents test suite via `$(VENV_DIR)/bin/python -m pytest`. `TODO: verify` venv bootstrap (`make venv`) is needed on a fresh checkout.

### MyAgent

```bash
cd MyAgent
.venv/bin/python -m pytest tests/ -v
```

Sourced from `MyAgent/README.md` and `MyAgent/pyproject.toml` (`testpaths = ["tests"]`).

### MyWeb

```bash
cd MyWeb
npm test          # vitest run  (unit + component)
npm run e2e       # playwright test
```

Both scripts are in `MyWeb/package.json`.

## Add a new subproject

Template for adding a sibling service under `MyProject/`:

1. Pick a directory name and create it: `mkdir MyProject/<newproj>`.
2. Decide whether it gets its own `.git` (matches `devTeam`, `MyAgent` pattern) or is tracked by the top-level `MyProject` repo (matches `MyWeb`, `MyCli`).
   - Own repo: `cd <newproj> && git init` and push to `git.thelunadog.com/forgo/<newproj>`.
   - Tracked by parent: just commit the new directory at the top level.
3. Seed the four required docs in `<newproj>/`: `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `HOWTO.md`.
4. If the service needs to run as part of the dev stack, add a `start_service` block to `start-servers.sh` following the existing devTeam / MyAgent / MyWeb pattern (name, working dir, log file, command).
5. Update the top-level `README.md` subproject table, `ARCHITECTURE.md` port table, and `ROADMAP.md` status block in this directory.
6. If it needs a new port, document it in `ARCHITECTURE.md` and pick one that does not collide with `4223`, `8000`, or `5173`.

## Stop / restart

`start-servers.sh` foregrounds and waits on the first child to exit. To stop everything, focus the terminal running it and send `Ctrl+C`. There is no separate `stop-servers.sh` at the time of this writing.
