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
if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@10.22.0 --activate
fi
command -v pnpm >/dev/null 2>&1 || {
  echo "Install Node 20 + enable corepack, or: npm install -g pnpm@10.22.0" >&2
  exit 1
}

echo "==> 3/4 Build static frontends (nginx volume mounts)"
./scripts/build-prod-assets.sh

echo "==> 4/4 Docker Compose up"
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "✅ Deploy finished. Verify:"
echo "   docker compose -f docker-compose.prod.yml ps"
echo "   curl -sf https://www.yibinfeng.com/api/health"
