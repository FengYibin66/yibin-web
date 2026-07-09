#!/bin/bash
# Complete local production deployment verification with browser access
# Usage: bash scripts/verify-local-complete.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=verify-local-compose.sh
source "$ROOT/scripts/verify-local-compose.sh"

echo "🔍 Complete local production deployment verification"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ $1${NC}"
  else
    echo -e "${RED}❌ $1${NC}"
    exit 1
  fi
}

# ──────────────────────────────────────────────────────────────
# 1. Prerequisites
# ──────────────────────────────────────────────────────────────
echo "📋 1. Prerequisites..."
command -v docker &>/dev/null && check "Docker installed" || exit 1
docker compose version &>/dev/null && check "Docker Compose installed" || exit 1
command -v pnpm &>/dev/null && check "pnpm installed" || exit 1

# ──────────────────────────────────────────────────────────────
# 2. Build applications
# ──────────────────────────────────────────────────────────────
echo ""
echo "🔨 2. Building applications..."
pnpm install --frozen-lockfile > /dev/null 2>&1 && check "Dependencies installed" || exit 1
pnpm --filter @yibin/portal build > /dev/null 2>&1 && check "Portal built" || exit 1
pnpm --filter @yibin/resume build > /dev/null 2>&1 && check "Resume built" || exit 1
cd apps/auto-wechat/frontend && pnpm run build > /dev/null 2>&1 && cd - > /dev/null && check "Auto-Wechat frontend built" || exit 1

# ──────────────────────────────────────────────────────────────
# 3. Build environment (.env.production)
# ──────────────────────────────────────────────────────────────
echo ""
echo "⚙️  3. Building environment configuration..."

ENV_SHARED_LOCAL="$ROOT/config/env.shared.verify.example" \
ENV_EXTRA="$ROOT/config/env.production.localhost.example" \
"$ROOT/scripts/env-build.sh" production

check ".env.production built via scripts/env-build.sh"

ensure_local_tls_certs
check "local TLS certs ready"

# ──────────────────────────────────────────────────────────────
# 4. Build Docker images
# ──────────────────────────────────────────────────────────────
echo ""
echo "🐳 4. Building Docker images..."
compose_local build --progress=plain > /dev/null 2>&1 && check "Docker images built" || exit 1

# ──────────────────────────────────────────────────────────────
# 5. Start services
# ──────────────────────────────────────────────────────────────
echo ""
echo "🚀 5. Starting services..."
compose_local up -d > /dev/null 2>&1 && check "Services started" || exit 1
# Re-mount static assets after pnpm build (Docker bind mount can go stale on macOS)
compose_local up -d --force-recreate nginx > /dev/null 2>&1 && check "Nginx recreated with fresh static mounts" || exit 1

# Wait for services to stabilize
echo -e "${YELLOW}Waiting for services to stabilize...${NC}"
for i in {1..60}; do
  if compose_local ps 2>/dev/null | grep -q "healthy"; then
    sleep 3
    break
  fi
  echo -n "."
  sleep 1
done
echo ""

# ──────────────────────────────────────────────────────────────
# 6. Verify services are running
# ──────────────────────────────────────────────────────────────
echo ""
echo "❤️  6. Verifying services..."

compose_local ps | grep -q "Up" && check "Services running" || exit 1

compose_local exec -T mysql mysqladmin ping -h 127.0.0.1 > /dev/null 2>&1 && check "MySQL running" || exit 1

compose_local exec -T redis redis-cli ping > /dev/null 2>&1 && check "Redis running" || exit 1

# ──────────────────────────────────────────────────────────────
# 7. Web access tests (the REAL verification!)
# ──────────────────────────────────────────────────────────────
echo ""
echo "🌐 7. Testing web access..."

echo -n "   Portal /api/health (via Nginx)... "
if curl -sf -H 'Host: www.yibinfeng.com' http://127.0.0.1/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌${NC}"
  exit 1
fi

echo -n "   Portal homepage (via Nginx)... "
if curl -sf -H 'Host: www.yibinfeng.com' http://127.0.0.1/ > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌${NC}"
  exit 1
fi

echo -n "   Resume homepage (via Nginx)... "
if curl -sf -H 'Host: resume.yibinfeng.com' http://127.0.0.1/ > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌${NC}"
  exit 1
fi

echo -n "   Auto-Wechat /api/v1/health (via Nginx)... "
if curl -sf -H 'Host: mpauto.yibinfeng.com' http://127.0.0.1/api/v1/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌${NC}"
  exit 1
fi

echo -n "   Portal /api/projects (via Nginx)... "
if curl -sf -H 'Host: www.yibinfeng.com' http://127.0.0.1/api/projects | grep -q '"nameEn"'; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌${NC}"
  exit 1
fi

# ──────────────────────────────────────────────────────────────
# 8. Display access URLs
# ──────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${BLUE}🎉 Verification complete! Services are running locally${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}Access locally:${NC}"
echo ""
echo "  Portal (SwitchHosts → 127.0.0.1):"
echo "    http://www.yibinfeng.com"
echo "    http://www.yibinfeng.com/api/health"
echo "    http://www.yibinfeng.com/api/projects"
echo ""
echo "  Resume:"
echo "    http://resume.yibinfeng.com"
echo ""
echo "  Auto-Wechat:"
echo "    http://mpauto.yibinfeng.com"
echo "    http://mpauto.yibinfeng.com/api/v1/health"
echo ""
echo -e "${BLUE}或使用 curl 测试:${NC}"
echo ""
echo "  curl -H 'Host: www.yibinfeng.com' http://127.0.0.1/api/health"
echo "  curl -H 'Host: mpauto.yibinfeng.com' http://127.0.0.1/api/v1/health"
echo ""
echo -e "${BLUE}停止服务:${NC}"
echo "  docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.local-prod.yml down -v"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✅ 本地验证成功！${NC}"
echo "现在可以按照 DEPLOYMENT.md 部署到腾讯云 CVM 了"
echo ""
