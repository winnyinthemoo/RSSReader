#!/usr/bin/env sh
set -eu

"$(dirname "$0")/frontend-build.sh"
"$(dirname "$0")/backend-check.sh"
