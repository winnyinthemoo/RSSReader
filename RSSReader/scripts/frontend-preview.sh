#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/../frontend"
npm run preview -- --port 4173
