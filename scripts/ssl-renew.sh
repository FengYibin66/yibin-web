#!/usr/bin/env bash
#
# Let's Encrypt 零停机续期（webroot 模式）。
#
# 为什么不用 --standalone：standalone 需要独占 80 端口，而 nginx-prod 容器常驻占用
# 80/443。用 standalone 的话每次续期都要停 nginx，无人值守的 cron 必然失败。
# webroot 模式把验证文件写到 /var/www/certbot，由常驻 nginx 直接对外提供
# （见 docker/nginx-prod.conf 的 /.well-known/acme-challenge/ location），全程不停机。
#
# 首次签发见 DEPLOYMENT.md「Step 2: SSL Certificates」。
# 本脚本只负责续期，可安全重复执行：证书剩余有效期 > 30 天时 certbot 自动跳过。
#
set -euo pipefail

CERT_NAME="www.yibinfeng.com"
WEBROOT="/var/www/certbot"
COMPOSE_FILE="docker-compose.prod.yml"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { echo "[ssl-renew] $*"; }

# webroot 目录必须存在且能被 nginx 容器读到（compose 里是 bind mount）
if [[ ! -d "$WEBROOT" ]]; then
  log "创建 webroot: $WEBROOT"
  sudo mkdir -p "$WEBROOT"
fi

log "续期证书 $CERT_NAME（webroot=$WEBROOT，不停机）"
sudo certbot renew \
  --cert-name "$CERT_NAME" \
  --webroot \
  --webroot-path "$WEBROOT" \
  --non-interactive \
  --deploy-hook "cd '$REPO_DIR' && docker compose -f '$COMPOSE_FILE' exec -T nginx nginx -s reload"

log "当前证书状态："
sudo certbot certificates
