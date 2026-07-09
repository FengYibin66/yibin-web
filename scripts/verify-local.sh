#!/bin/bash
# Local production deployment verification script
# Usage: bash scripts/verify-local.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=verify-local-compose.sh
source "$ROOT/scripts/verify-local-compose.sh"

echo "🔍 Verifying yibin_web production deployment..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ $1${NC}"
  else
    echo -e "${RED}❌ $1${NC}"
    exit 1
  fi
}

# ──────────────────────────────────────────────────────────────
# 1. Check prerequisites
# ──────────────────────────────────────────────────────────────
echo "📋 1. Checking prerequisites..."

command -v docker &>/dev/null
check "Docker installed"

docker compose version &>/dev/null
check "Docker Compose installed"

command -v pnpm &>/dev/null
check "pnpm installed"

# ──────────────────────────────────────────────────────────────
# 2. Verify file structure
# ──────────────────────────────────────────────────────────────
echo ""
echo "📁 2. Verifying core files..."

[ -f "docker-compose.prod.yml" ]
check "docker-compose.prod.yml exists"

[ -f "docker/Dockerfile.portal-server" ]
check "docker/Dockerfile.portal-server exists"

[ -f "docker/Dockerfile.resume" ]
check "docker/Dockerfile.resume exists"

[ -f "docker/nginx-prod.conf" ]
check "docker/nginx-prod.conf exists"

[ -f ".github/workflows/deploy.yml" ]
check ".github/workflows/deploy.yml exists"

[ -f "config/env.shared.example" ]
check "config/env.shared.example exists"
[ -f "config/env.production.example" ]
check "config/env.production.example exists"

[ -f "DEPLOYMENT.md" ]
check "DEPLOYMENT.md exists"

# ──────────────────────────────────────────────────────────────
# 3. Verify application builds
# ──────────────────────────────────────────────────────────────
echo ""
echo "🔨 3. Verifying application builds..."

echo -e "${YELLOW}Installing dependencies...${NC}"
pnpm install --frozen-lockfile > /dev/null 2>&1
check "pnpm install"

echo -e "${YELLOW}Building Portal...${NC}"
pnpm --filter @yibin/portal build > /dev/null 2>&1
check "Portal build (client + server)"

echo -e "${YELLOW}Building Resume...${NC}"
pnpm --filter @yibin/resume build > /dev/null 2>&1
check "Resume build"

echo -e "${YELLOW}Building Auto-Wechat frontend...${NC}"
cd apps/auto-wechat/frontend && pnpm run build > /dev/null 2>&1
cd - > /dev/null
check "Auto-Wechat frontend build"

# ──────────────────────────────────────────────────────────────
# 4. Verify build artifacts
# ──────────────────────────────────────────────────────────────
echo ""
echo "📦 4. Verifying build artifacts..."

[ -d "apps/portal/client/dist" ] && [ "$(ls -A apps/portal/client/dist)" ]
check "Portal client dist/ generated"

[ -d "apps/portal/server/dist" ] && [ "$(ls -A apps/portal/server/dist)" ]
check "Portal server dist/ generated"

[ -d "apps/resume/out" ] && [ "$(ls -A apps/resume/out)" ]
check "Resume out/ generated (Next.js SSG)"

[ -d "apps/auto-wechat/frontend/dist" ] && [ "$(ls -A apps/auto-wechat/frontend/dist)" ]
check "Auto-Wechat frontend dist/ generated"

# ──────────────────────────────────────────────────────────────
# 5. Verify docker-compose configuration
# ──────────────────────────────────────────────────────────────
echo ""
echo "🐳 5. Building env + verifying docker-compose..."

ENV_SHARED_LOCAL="$ROOT/config/env.shared.verify.example" \
ENV_EXTRA="$ROOT/config/env.production.localhost.example" \
"$ROOT/scripts/env-build.sh" production
check "env-build production"

ensure_local_tls_certs
check "local TLS certs ready"

compose_local config > /dev/null 2>&1
check "docker-compose.prod.yml + local overlay syntax valid"

service_count=$(compose_local config --services | wc -l | tr -d ' ')
[ "$service_count" -eq 7 ]
check "All 7 services defined (nginx, portal-server, resume, auto-wechat-api, auto-wechat-worker, llm-service, mysql, redis)"

# ──────────────────────────────────────────────────────────────
# 6. Build Docker images
# ──────────────────────────────────────────────────────────────
echo ""
echo "🏗️  6. Building Docker images..."
echo -e "${YELLOW}This may take a few minutes...${NC}"

compose_local build --progress=plain > /dev/null 2>&1
check "Docker images built successfully"

# ──────────────────────────────────────────────────────────────
# 7. Start services
# ──────────────────────────────────────────────────────────────
echo ""
echo "🚀 7. Starting services..."

compose_local up -d > /dev/null 2>&1
check "Docker Compose services started"

compose_local up -d --force-recreate nginx > /dev/null 2>&1
check "Nginx recreated with fresh static mounts"

# Wait for services to be ready
sleep 15

# ──────────────────────────────────────────────────────────────
# 8. Verify service health
# ──────────────────────────────────────────────────────────────
echo ""
echo "❤️  8. Checking service health..."

running_services=$(compose_local ps -q | wc -l | tr -d ' ')
[ "$running_services" -ge 7 ]
check "All services running"

compose_local exec -T mysql mysqladmin ping -h 127.0.0.1 > /dev/null 2>&1
check "MySQL health check"

compose_local exec -T redis redis-cli ping > /dev/null 2>&1
check "Redis health check"

compose_local exec -T portal-server node -e \
  "require('http').get('http://localhost:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" \
  > /dev/null 2>&1
check "Portal Server /health"

compose_local exec -T portal-server node -e \
  "require('http').get('http://localhost:3001/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" \
  > /dev/null 2>&1
check "Portal Server /api/health"

curl -sf -H 'Host: www.yibinfeng.com' http://127.0.0.1/api/health > /dev/null 2>&1
check "Nginx → Portal /api/health"

# ──────────────────────────────────────────────────────────────
# 9. Verify network connectivity
# ──────────────────────────────────────────────────────────────
echo ""
echo "🌐 9. Verifying service connectivity..."

compose_local exec -T auto-wechat-api curl -sf http://localhost:8080/api/v1/health > /dev/null 2>&1
check "Auto-Wechat API /api/v1/health"

curl -sf -H 'Host: mpauto.yibinfeng.com' http://127.0.0.1/api/v1/health > /dev/null 2>&1
check "Nginx → Auto-Wechat /api/v1/health"

# ──────────────────────────────────────────────────────────────
# 10. Cleanup
# ──────────────────────────────────────────────────────────────
echo ""
echo "🧹 10. Cleaning up..."

compose_local down -v > /dev/null 2>&1
check "Cleanup complete (containers and volumes removed)"

# ──────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ All verification checks passed!${NC}"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Copy DEPLOYMENT.md to your CVM"
echo "2. Follow the deployment steps in DEPLOYMENT.md"
echo "3. Configure GitHub Secrets for CI/CD"
echo "4. Push to main branch to trigger automated deployment"
echo ""
echo "For detailed deployment guide, see: DEPLOYMENT.md"
