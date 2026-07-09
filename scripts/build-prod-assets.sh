#!/usr/bin/env bash
# Spec: docs/specs/platform.md §3
# Build static frontends for docker-compose.prod.yml nginx volume mounts.
#
# Requires: Node 20+, pnpm 10.22+ (corepack prepare pnpm@10.22.0 --activate)
# Requires: pnpm-lock.yaml committed in repo (--frozen-lockfile)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f pnpm-lock.yaml ]]; then
  echo "Missing pnpm-lock.yaml — run 'pnpm install' on dev machine and commit the lockfile." >&2
  exit 1
fi

command -v pnpm >/dev/null 2>&1 || {
  echo "Enable corepack: corepack enable && corepack prepare pnpm@10.22.0 --activate" >&2
  exit 1
}

echo "📦 pnpm install --frozen-lockfile..."
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
