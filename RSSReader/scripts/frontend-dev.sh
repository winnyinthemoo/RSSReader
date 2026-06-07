#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/../frontend"
npm run dev -- --port 5173
