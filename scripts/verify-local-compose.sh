#!/usr/bin/env bash
# Shared docker compose invocation for local prod verification (Mac).
# Sources: docker-compose.prod.yml + docker-compose.local-prod.yml
# Requires .env.production in repo root.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ensure_local_tls_certs() {
  if [[ -f "$ROOT/docker/certs/local.crt" && -f "$ROOT/docker/certs/local.key" ]]; then
    return 0
  fi
  mkdir -p "$ROOT/docker/certs"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$ROOT/docker/certs/local.key" \
    -out "$ROOT/docker/certs/local.crt" \
    -subj "/CN=www.yibinfeng.com" \
    -addext "subjectAltName=DNS:www.yibinfeng.com,DNS:yibinfeng.com,DNS:resume.yibinfeng.com,DNS:mpauto.yibinfeng.com,DNS:localhost"
}

compose_local() {
  docker compose --env-file "$ROOT/.env.production" \
    -f "$ROOT/docker-compose.prod.yml" \
    -f "$ROOT/docker-compose.local-prod.yml" "$@"
}
