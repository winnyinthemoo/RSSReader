#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(dirname "$0")"
BACKEND_PID=""
FRONTEND_PID=""

"$SCRIPT_DIR/backend-dev.sh" &
BACKEND_PID="$!"
"$SCRIPT_DIR/frontend-dev.sh" &
FRONTEND_PID="$!"

cleanup() {
  trap - INT TERM EXIT
  for pid in "$BACKEND_PID" "$FRONTEND_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

wait
