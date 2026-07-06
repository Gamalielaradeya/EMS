#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql -v ON_ERROR_STOP=1 \
  -f "${ROOT_DIR}/backend-go/migrations/006_seed_initial_data.sql" \
  "${DATABASE_URL}"
