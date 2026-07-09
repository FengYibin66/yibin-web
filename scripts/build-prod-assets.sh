#!/usr/bin/env bash
# Build static frontends for docker-compose.prod.yml nginx volume mounts.
# Run on CVM (or Mac) before: docker compose -f docker-compose.prod.yml up -d --build
#
# Requires: node 20+, pnpm 10.22+

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

command -v pnpm >/dev/null 2>&1 || { echo "Install pnpm first: npm install -g pnpm@10.22.0" >&2; exit 1; }

echo "📦 pnpm install..."
pnpm install --frozen-lockfile

echo "🔨 Portal (client + server TS)..."
pnpm --filter @yibin/portal build

echo "🔨 Resume (Next.js export)..."
pnpm --filter @yibin/resume build

echo "🔨 Auto-Wechat frontend..."
(
  cd apps/auto-wechat/frontend
  if [[ ! -f .env.production ]]; then
    cp .env.production.example .env.production
  fi
  pnpm run build
)

echo "✅ Static assets ready:"
echo "   apps/portal/client/dist"
echo "   apps/resume/out"
echo "   apps/auto-wechat/frontend/dist"
