#!/usr/bin/env bash
# 服务器一键更新：git pull → 重建后端 → 构建前端 → 启动 Nginx
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull origin main

echo "==> backend (api + worker)"
sudo docker compose -f docker-compose.dev.yml up -d --build api worker

echo "==> frontend build"
cd frontend
pnpm install
pnpm build
cd "$ROOT"

echo "==> nginx frontend (:80, /api 反代)"
mkdir -p docker/certbot/www
# 若曾手动 docker run 名为 frontend 的容器，先删掉一次：sudo docker rm -f frontend
sudo docker compose -f docker-compose.dev.yml -f docker-compose.frontend.yml up -d frontend

echo "==> health (同源 /api)"
curl -sf "http://127.0.0.1/api/v1/health" || {
  echo "health check failed; try: sudo docker compose -f docker-compose.dev.yml logs --tail=30 api"
  exit 1
}
echo
echo "Deploy done. Browser: http://YOUR_PUBLIC_IP/ (login uses same-origin /api/v1)."
