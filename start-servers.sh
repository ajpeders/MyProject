#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.logs}"
MYAGENT_HOST="${MYAGENT_HOST:-127.0.0.1}"
MYAGENT_PORT="${MYAGENT_PORT:-8000}"
MYWEB_HOST="${MYWEB_HOST:-127.0.0.1}"
MYWEB_PORT="${MYWEB_PORT:-5173}"

mkdir -p "$LOG_DIR"

declare -a PIDS=()

cleanup() {
  local exit_code=$?

  if [ "${#PIDS[@]}" -gt 0 ]; then
    echo
    echo "Stopping servers..."
    kill "${PIDS[@]}" 2>/dev/null || true
    wait "${PIDS[@]}" 2>/dev/null || true
  fi

  exit "$exit_code"
}

trap cleanup INT TERM EXIT

python_cmd() {
  local service_dir=$1
  if [ -x "$service_dir/.venv/bin/python" ]; then
    printf '%s\n' "$service_dir/.venv/bin/python"
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s\n' "python3"
  else
    printf '%s\n' "python"
  fi
}

start_service() {
  local name=$1
  local service_dir=$2
  local log_file=$3
  shift 3

  echo "Starting $name..."
  (
    cd "$service_dir"
    exec "$@"
  ) >"$log_file" 2>&1 &

  local pid=$!
  PIDS+=("$pid")
  echo "  pid=$pid log=$log_file"
}

DEVTEAM_PYTHON="$(python_cmd "$ROOT_DIR/devTeam")"

start_service \
  "devTeam" \
  "$ROOT_DIR/devTeam" \
  "$LOG_DIR/devteam.log" \
  "$DEVTEAM_PYTHON" -m daemon.main --config config/local-test.yaml

start_service \
  "MyAgent" \
  "$ROOT_DIR/MyAgent" \
  "$LOG_DIR/myagent.log" \
  env HOST="$MYAGENT_HOST" PORT="$MYAGENT_PORT" ./start.sh

start_service \
  "MyWeb" \
  "$ROOT_DIR/MyWeb" \
  "$LOG_DIR/myweb.log" \
  npm run dev -- --host "$MYWEB_HOST" --port "$MYWEB_PORT"

echo
echo "Servers started:"
echo "  MyAgent: http://$MYAGENT_HOST:$MYAGENT_PORT"
echo "  devTeam: http://localhost:4223"
echo "  MyWeb:   http://$MYWEB_HOST:$MYWEB_PORT"
echo
echo "Logs:"
echo "  $LOG_DIR/myagent.log"
echo "  $LOG_DIR/devteam.log"
echo "  $LOG_DIR/myweb.log"
echo
echo "Press Ctrl+C to stop all three."

wait -n "${PIDS[@]}"
