#!/usr/bin/env sh
set -eu

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo was not found. Please install Rust before running the backend dev server."
  exit 1
fi

cd "$(dirname "$0")/../backend"
cargo run --bin rssreader-backend-dev
