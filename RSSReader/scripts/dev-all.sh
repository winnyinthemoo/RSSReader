#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(dirname "$0")"

"$SCRIPT_DIR/backend-dev.sh" &
"$SCRIPT_DIR/frontend-dev.sh" &

wait
