#!/usr/bin/env bash
# Spec: docs/specs/platform.md §3
# Normative production deploy on CVM (after env + SSL are ready).
#
# Prerequisites:
#   - .env.shared.local filled, ./scripts/env-build.sh production --check passes
#   - Let's Encrypt certs at /etc/letsencrypt/live/www.yibinfeng.com/
#   - system nginx stopped & disabled (port 80/443 for Docker)
#   - Node 20+, corepack (see DEPLOYMENT.md)
#
# Usage:
#   ./scripts/deploy-prod.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> 1/4 Validate environment"
./scripts/env-build.sh production
./scripts/env-build.sh production --check

echo "==> 2/4 Ensure pnpm version (packageManager in package.json)"
ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    echo "pnpm $(pnpm -v)"
    return 0
  fi
  if command -v corepack >/dev/null 2>&1; then
    corepack enable 2>/dev/null || sudo corepack enable
    corepack prepare pnpm@10.22.0 --activate 2>/dev/null || sudo corepack prepare pnpm@10.22.0 --activate
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    sudo npm install -g pnpm@10.22.0
  fi
  command -v pnpm >/dev/null 2>&1 || {
    echo "Install pnpm: sudo corepack enable && sudo corepack prepare pnpm@10.22.0 --activate" >&2
    exit 1
  }
  echo "pnpm $(pnpm -v)"
}
ensure_pnpm

if [[ ! -f .npmrc && -f config/npmrc.cvm.example ]]; then
  cp config/npmrc.cvm.example .npmrc
  echo "Using config/npmrc.cvm.example → .npmrc"
fi

echo "==> 3/4 Build static frontends (nginx volume mounts)"
./scripts/build-prod-assets.sh

echo "==> 4/4 Docker Compose up"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

echo ""
echo "✅ Deploy finished. Verify:"
echo "   docker compose -f docker-compose.prod.yml ps"
echo "   curl -sf https://www.yibinfeng.com/api/health"
