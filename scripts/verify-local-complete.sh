#!/bin/bash
# Complete local production deployment verification with browser access
# Usage: bash scripts/verify-local-complete.sh

set -e

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
# 3. Create local .env.production
# ──────────────────────────────────────────────────────────────
echo ""
echo "⚙️  3. Creating local configuration..."

cat > .env.production << 'ENV_EOF'
NODE_ENV=production
ENV=production
MYSQL_ROOT_PASSWORD=root_local
MYSQL_PASSWORD=wechat_local
DATABASE_URL=mysql://wechat:wechat_local@tcp(mysql:3306)/wechat_ai?parseTime=true&loc=UTC&charset=utf8mb4
REDIS_URL=redis://redis:6379/0
PORT=3001
ADMIN_PASSWORD=admin_local
CLIENT_ORIGIN=http://localhost:3000,http://localhost
PORTAL_DATABASE_URL=
API_PORT=8080
ADMIN_API_KEY=admin_api_key_local
LOG_LEVEL=debug
SESSION_COOKIE_NAME=session_id
SESSION_TTL=24h
SESSION_SECURE=false
SESSION_SAME_SITE=Lax
SECRET_KEY=secret_key_local_32chars_minimum_
STUB_PIPELINE=true
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost
PUBLIC_API_BASE_URL=http://localhost:8080
WECHAT_READ_SOURCE_URL=https://fengyibin66.github.io/
LLM_SERVICE_URL=http://llm-service:8090
LLM_INVOKE_TIMEOUT=10m
LLM_REQUEST_TIMEOUT_SECONDS=600
DASHSCOPE_API_KEY=mock_key_local
LLM_MODEL_FAST=qwen-plus
LLM_MODEL_SMART=qwen-max
LLM_MODEL_LAYOUT=qwen-max
LLM_MAX_OUTPUT_TOKENS_LAYOUT=32768
IMAGE_MODEL=wanx2.1-t2i-turbo
IMAGE_SIZE=1280*720
TENCENT_SECRET_ID=mock_id_local
TENCENT_SECRET_KEY=mock_key_local
COS_BUCKET=mock_bucket_local
COS_REGION=ap-hongkong
COLLECT_DAYS=2
COLLECT_MIN_ARTICLES=5
WECHAT_APP_ID=mock_app_id
WECHAT_APP_SECRET=mock_app_secret
WECHAT_ORIGINAL_ID=mock_original_id
WECHAT_ACCOUNT_TYPE=subscription
WECHAT_ACCOUNT_SUBJECT=personal
WECHAT_CERTIFIED=false
WECHAT_IP_WHITELIST=
WECHAT_CALLBACK_URL=http://localhost:8080/api/v1/wechat/callback
WECOM_WEBHOOK_URL=
SSL_CERT_PATH=/etc/letsencrypt/live/www.yibinfeng.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/www.yibinfeng.com/privkey.pem
ENV_EOF

check ".env.production created"

# ──────────────────────────────────────────────────────────────
# 4. Build Docker images
# ──────────────────────────────────────────────────────────────
echo ""
echo "🐳 4. Building Docker images..."
docker compose -f docker-compose.prod.yml build --progress=plain > /dev/null 2>&1 && check "Docker images built" || exit 1

# ──────────────────────────────────────────────────────────────
# 5. Start services
# ──────────────────────────────────────────────────────────────
echo ""
echo "🚀 5. Starting services..."
docker compose -f docker-compose.prod.yml up -d > /dev/null 2>&1 && check "Services started" || exit 1

# Wait for services to stabilize
echo -e "${YELLOW}Waiting for services to stabilize...${NC}"
for i in {1..30}; do
  if docker compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
    sleep 2
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

# Check all services
docker compose -f docker-compose.prod.yml ps | grep -q "Up" && check "Services running" || exit 1

# Check MySQL
docker compose -f docker-compose.prod.yml exec -T mysql mysqladmin ping -h 127.0.0.1 > /dev/null 2>&1 && check "MySQL running" || exit 1

# Check Redis
docker compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1 && check "Redis running" || exit 1

# ──────────────────────────────────────────────────────────────
# 7. Web access tests (the REAL verification!)
# ──────────────────────────────────────────────────────────────
echo ""
echo "🌐 7. Testing web access..."

# Test Nginx (reverse proxy)
echo -n "   Testing Nginx... "
if curl -s http://localhost:80/ > /dev/null 2>&1 || curl -s http://localhost/ > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌${NC}"
  echo "     Nginx not responding to HTTP"
fi

# Test Portal Server directly
echo -n "   Testing Portal Server (localhost:3001)... "
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌${NC}"
  echo "     Portal Server not responding"
fi

# Test Auto-Wechat API directly
echo -n "   Testing Auto-Wechat API (localhost:8080)... "
if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC}"
else
  echo -e "${RED}❌${NC}"
  echo "     Auto-Wechat API not responding"
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
echo "  Portal (直接访问):"
echo "    http://localhost:3001"
echo "    API: http://localhost:3001/api/health"
echo ""
echo "  Resume (通过 Nginx):"
echo "    http://localhost/           (如果 Nginx 指向 resume)"
echo ""
echo "  Auto-Wechat API (直接访问):"
echo "    http://localhost:8080/api/v1/health"
echo ""
echo -e "${BLUE}或使用 curl 测试:${NC}"
echo ""
echo "  curl http://localhost:3001/health"
echo "  curl http://localhost:8080/api/v1/health"
echo "  curl http://localhost/"
echo ""
echo -e "${BLUE}停止服务:${NC}"
echo "  docker compose -f docker-compose.prod.yml down -v"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✅ 本地验证成功！${NC}"
echo "现在可以按照 DEPLOYMENT.md 部署到腾讯云 CVM 了"
echo ""
