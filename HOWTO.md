# HOWTO

Operational recipes for the MyProject monorepo. For per-service procedures (auth, IMAP, chat, memory, calendar, admin, agents), read the `HOWTO.md` inside each active subproject.

## Clone the repo (first time)

```bash
git clone --recurse-submodules git@github.com:ajpeders/MyProject.git
```

`devTeam/` and `MyAgent/` are git submodules pinned at specific commits via `.gitmodules`. If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

To bump a submodule to its latest upstream commit: `cd` into it, `git pull` (or check out the ref you want), then at the root `git add devTeam` (or `MyAgent`) and commit the pointer bump.

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

## Start everything with Docker

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # paste into MYDEVTEAM_API_KEY
docker compose up --build
```

**`.env` with `MYDEVTEAM_API_KEY` is required.** The devTeam daemon fails closed and
exits at startup with `no admin API key configured` if it is empty, because its admin
endpoints would otherwise be unprotected. `.env` is gitignored; only `.env.example` is
tracked. Verified 2026-08-16: with an empty key the container logs the refusal and exits.

MyAgent reads the *same* variable but behaves differently — an empty key means **no auth
at all**, and it starts anyway (`src/core/config.py:15`). So a missing key does not just
break devTeam, it silently publishes MyAgent's API on `:8000`. Always set it.

`docker-compose.yml` at the repo root builds and runs all three services:

1. `devteam` — built from `devTeam/Dockerfile`, published on `localhost:4223`. Runs `config/docker.yaml` (**not** `local-test.yaml`): it binds `0.0.0.0` so the published port is reachable, points the agents' LLM endpoint at `host.docker.internal`, and ships no baked-in admin key. State (task DB, agent logs, workspaces) persists in the `devteam-data` volume at `/data`.
2. `myagent` — built from `MyAgent/Dockerfile`, published on `localhost:8000`. Mounts `/var/run/docker.sock` so MyAgent can spawn its alpine sandbox container — this grants the container root-equivalent access on the host and is required by design.
3. `myweb` — built from `MyWeb/Dockerfile` (multi-stage Vite build → nginx), published on `localhost:5173`.

All three declare healthchecks (`devteam` → `GET /healthz`, `myagent` → `GET /health`,
`myweb` → `GET /healthz` served by nginx). `myweb` waits for both backends to report
healthy before it starts. Check status with `docker compose ps` — the STATUS column
shows `(healthy)` once probes pass.

Prerequisites:

- `ollama` running on the host at `:11434`. Containers reach it via `host.docker.internal`, mapped through the `host-gateway` alias in the compose file. To run ollama inside compose instead, uncomment the `ollama` service (and its `volumes:` block) — note its model store is separate from any host ollama.
- The `MyDevTeam` deploy agent and `MyAgent` sandbox both rely on the host Docker daemon; no extra setup beyond Docker itself.

Caveats:

- `MyAgent` state persists in the `myagent-data` volume via `MYDEVTEAM_DATA_DIR=/data`. All of it (users, sessions, encrypted IMAP creds, cached mail) is the single `data.db`; there is no separate `sessions.db` any more.
- `MyWeb` is served as static files by nginx — all `VITE_*` values are baked in at **build** time from `.env` via compose `build.args`. Changing an API URL or key requires `docker compose build myweb`, not just a restart. Anything in `VITE_API_KEY` / `VITE_DEVTEAM_API_KEY` is readable in the shipped JavaScript: leave them empty unless the deployment is fully private, and let users supply their key at runtime (the login page stores it in localStorage).
- `devTeam` does **not** read `OLLAMA_HOST` — its LLM endpoint comes from `config/docker.yaml`, which is passed to litellm. Only MyAgent honors `OLLAMA_HOST` (the `ollama` python client reads it natively).
- `devTeam/` and `MyAgent/` are git submodules. The root `MyProject` repo pins a specific commit of each; changes to their `Dockerfile` are committed in the sub-repo first, then the pinned SHA is bumped at the root.

Stop with `Ctrl+C`, or `docker compose down` from another terminal.

## Run tests across subprojects

### devTeam

```bash
cd devTeam
make test
```

`devTeam/Makefile` declares `test: test-api test-agents`, running `pytest daemon/api/test_server.py -q` and the agents test suite via `$(VENV_DIR)/bin/python -m pytest`. `test-api` depends on the `venv` target (`devTeam/Makefile:20`), so `make test` will bootstrap `.venv` automatically on a fresh checkout.

To run everything (tests are colocated next to sources, not only under `tests/`):

```bash
.venv/bin/python -m pytest -q
```

Counts verified 2026-08-16: **151 passing** overall, of which `daemon/api/test_server.py` is 60.

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

## CI

Each repo carries its own Forgejo Actions workflow at `.forgejo/workflows/ci.yml`,
running on push to the default branch and on pull requests:

| Repo             | What it runs                                                            |
| ---------------- | ----------------------------------------------------------------------- |
| MyProject (root) | MyWeb lint + tests + production build (`tsc -b`, so also the typecheck); `docker compose config`; a guard that fails if `.env` is ever committed |
| devTeam          | full `pytest -q` (151), plus an assertion that `config/docker.yaml` binds `0.0.0.0`, advertises `localhost`, and has no baked-in admin key |
| MyAgent          | full `pytest tests/ -q` (316)                                           |

Submodules are intentionally not tested by the root workflow — each sub-repo tests
itself, so a pointer bump doesn't re-run their suites.

Two caveats, both unverified because they need the Forgejo instance:

- `runs-on: ubuntu-latest` is a guess at the runner label this instance registers.
  If jobs sit queued forever, that label is wrong — change it in all three files.
- No workflow has actually been executed. Every command in them was run locally
  first (including devTeam's suite in a throwaway venv), but that is not the same
  as a green pipeline.

To reproduce CI locally:

```bash
cd MyWeb    && npm ci && npm run lint && npm test && npm run build
cd devTeam  && make test-all
cd MyAgent  && .venv/bin/python -m pytest tests/ -q
docker compose config --quiet
```

## Add a new subproject

Template for adding a sibling service under `MyProject/`:

1. Pick a directory name and create it: `mkdir MyProject/<newproj>`.
2. Decide whether it gets its own `.git` (matches `devTeam`, `MyAgent` pattern) or is tracked by the top-level `MyProject` repo (matches `MyWeb`, `MyCli`).
   - Own repo: `cd <newproj> && git init`, push to `github.com/alex/<newproj>`, then at the root `git submodule add git@github.com:ajpeders/<newproj>.git <newproj>` so the parent pins it.
   - Tracked by parent: just commit the new directory at the top level.
3. Seed the four required docs in `<newproj>/`: `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `HOWTO.md`.
4. If the service needs to run as part of the dev stack, add a `start_service` block to `start-servers.sh` following the existing devTeam / MyAgent / MyWeb pattern (name, working dir, log file, command).
5. Update the top-level `README.md` subproject table, `ARCHITECTURE.md` port table, and `ROADMAP.md` status block in this directory.
6. If it needs a new port, document it in `ARCHITECTURE.md` and pick one that does not collide with `4223`, `8000`, or `5173`.

## Stop / restart

`start-servers.sh` foregrounds and waits on the first child to exit. To stop everything, focus the terminal running it and send `Ctrl+C`. There is no separate `stop-servers.sh` at the time of this writing.
