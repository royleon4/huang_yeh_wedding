#!/bin/bash
set -euo pipefail

pnpm install --frozen-lockfile

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is unavailable; skipping development database migration."
  exit 0
fi

echo "Applying tracked Memories migrations to the development database..."
pnpm --filter @workspace/memories-album run db:migrate
