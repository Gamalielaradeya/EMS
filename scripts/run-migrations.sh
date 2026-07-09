#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for migration in "${ROOT_DIR}"/backend-go/migrations/*.sql; do
  echo "Applying $(basename "${migration}")"
  psql -v ON_ERROR_STOP=1 -f "${migration}" "${DATABASE_URL}"
done
