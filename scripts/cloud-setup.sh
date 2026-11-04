#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("Select Node.js 24 or newer for this environment."); process.exit(1); }'
npm ci --no-audit --no-fund

# Prisma generation reads its config even though it does not connect to Postgres.
if [[ -z "${DATABASE_URL:-}" || -z "${DATABASE_URL_UNPOOLED:-}" ]]; then
  printf '%s\n' 'Missing database configuration: request DATABASE_URL and DATABASE_URL_UNPOOLED as private environment variables. Do not put their values in chat or Git.' >&2
  exit 1
fi

npm run db:generate
npx playwright install --with-deps chromium
bash .agents/skills/impeccable/scripts/impeccable engine-probe
printf '%s\n' 'Dependencies, Prisma client, Chromium, and Impeccable are ready. Database migrations and browser verification are separate explicit steps; see CLOUD.md.'
