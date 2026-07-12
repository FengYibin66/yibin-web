# Production Deployment

> **Spec:** [docs/specs/platform.md](./docs/specs/platform.md)  
> **Status:** ✅ Production Ready  
> **Last Updated:** 2026-07-09

---

## Quick Start (5 Minutes)

### Prerequisites
- Linux server (Ubuntu 22.04+)
- Docker + Docker Compose installed
- Three domains with DNS A records pointing to CVM IP
- Let's Encrypt SSL certificates

### Deploy

```bash
# 1. SSH into CVM (OrcaTerm or ssh ubuntu@your_cvm_ip)
cd ~/yibin-web
git pull

# 2. Environment (once)
cp config/env.shared.example .env.shared.local
nano .env.shared.local  # Fill secrets — never commit
./scripts/env-build.sh production --check

# 3. SSL (once — stop system nginx first if port 80 busy)
sudo systemctl stop nginx
sudo certbot certonly --standalone -d www.yibinfeng.com -d resume.yibinfeng.com -d mpauto.yibinfeng.com -d partner.yibinfeng.com --agree-tos -m your@email.com
sudo systemctl disable nginx

# 4. Node 20 + pnpm (once on CVM)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
corepack enable && corepack prepare pnpm@10.22.0 --activate
cp config/npmrc.cvm.example .npmrc   # optional, China mirror

# 5. Normative deploy (build static assets + Docker)
./scripts/deploy-prod.sh

# 6. Verify
docker compose -f docker-compose.prod.yml ps
curl https://www.yibinfeng.com/api/health
```

---

## Architecture

```
Tencent Cloud CVM (Beijing · Lighthouse)
├─ Docker Network (yibin-net)
│  ├─ Nginx (80/443, reverse proxy)
│  ├─ portal-server:3001
│  ├─ auto-wechat-api:8080
│  ├─ auto-wechat-worker
│  ├─ llm-service:8090
│  ├─ MySQL:3306
│  └─ Redis:6379
├─ Volumes (data persistence)
│  ├─ mysql_data
│  ├─ redis_data
│  └─ media_data
└─ SSL Certificates (/etc/letsencrypt)
```

---

## Core Files

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production orchestration |
| `docker/Dockerfile.*` | Multi-stage builds |
| `docker/nginx-prod.conf` | HTTPS routing & caching |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD |
| `config/env.*.example` | Environment templates |
| `scripts/env-build.sh` | Generate `.env.production` |
| `scripts/build-prod-assets.sh` | Build portal/resume/wechat static assets |
| `scripts/deploy-prod.sh` | **Normative** CVM deploy (env → build → compose) |
| `pnpm-lock.yaml` | **Committed** — required for `--frozen-lockfile` |

---

## Detailed Deployment Steps

### Step 1: Initialize CVM

```bash
sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
docker --version && docker compose --version
```

### Step 2: SSL Certificates (Let's Encrypt)

```bash
sudo apt-get install -y certbot

sudo certbot certonly --standalone \
  -d www.yibinfeng.com \
  -d resume.yibinfeng.com \
  -d mpauto.yibinfeng.com \
  -d partner.yibinfeng.com \
  --agree-tos \
  --email your-email@example.com

sudo certbot renew --dry-run  # Verify auto-renewal
```

### Step 3: Clone & Configure

```bash
sudo mkdir -p /data && sudo chown $USER:$USER /data
cd /data
git clone https://github.com/FengYibin66/yibin-web.git
cd yibin-web

cp config/env.shared.example .env.shared.local
nano .env.shared.local  # Fill in: MYSQL_ROOT_PASSWORD, DASHSCOPE_API_KEY, etc.
./scripts/env-build.sh production
./scripts/env-build.sh production --check
```

See [config/README.md](./config/README.md) for all required variables.

### Step 4: Build & Start (normative)

```bash
corepack enable && corepack prepare pnpm@10.22.0 --activate
cp config/npmrc.cvm.example .npmrc   # optional on CVM (China)

./scripts/deploy-prod.sh
# Or manually: ./scripts/build-prod-assets.sh && docker compose -f docker-compose.prod.yml up -d --build

docker compose -f docker-compose.prod.yml ps  # Verify all 7 services "Up"
```

### Step 5: Verify

```bash
sleep 30  # Let services stabilize

# Health checks
curl -i https://www.yibinfeng.com/api/health
curl -i https://resume.yibinfeng.com/
curl -i https://mpauto.yibinfeng.com/api/v1/health
curl -i https://partner.yibinfeng.com/   # Partner API (502 ok if service not up yet)

# Browser access
# https://www.yibinfeng.com
# https://resume.yibinfeng.com
# https://mpauto.yibinfeng.com
# https://partner.yibinfeng.com
```

---

## Add `partner.yibinfeng.com` (二级域名)

Nginx 配置已在仓库内；上线只需 **DNS + 证书扩展 + 部署**。

### Step A: 腾讯云 DNS（域名控制台）

登录 [腾讯云 DNS](https://console.cloud.tencent.com/cns) → 选择 `yibinfeng.com` → **添加记录**：

| 主机记录 | 记录类型 | 记录值 | TTL |
|----------|----------|--------|-----|
| `partner` | A | `49.233.142.172`（你的 CVM 公网 IP） | 600 |

保存后本机验证（需等待 1–10 分钟生效）：

```bash
dig +short partner.yibinfeng.com
# 期望：49.233.142.172
```

### Step B: CVM 扩展 SSL 证书

已有三域名证书时，用 `--expand` 追加 `partner`（**须先停占用 80 端口的容器**）：

```bash
cd ~/yibin-web
docker compose --env-file .env.production -f docker-compose.prod.yml stop nginx

sudo certbot certonly --standalone --expand \
  -d www.yibinfeng.com \
  -d resume.yibinfeng.com \
  -d mpauto.yibinfeng.com \
  -d partner.yibinfeng.com \
  --agree-tos \
  -m your@email.com

sudo certbot certificates
# 应看到 Certificate Name: www.yibinfeng.com，Domains 含 partner.yibinfeng.com
```

### Step C: 拉代码并重启

```bash
git pull
./scripts/deploy-prod.sh
# 或仅重建 nginx：docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate nginx
```

### Step D: 验收

```bash
curl -I https://partner.yibinfeng.com/
# 期望：HTTP/2 200；若 Partner 远程服务未启动则为 502（证书须无报错）

openssl s_client -connect partner.yibinfeng.com:443 -servername partner.yibinfeng.com </dev/null 2>/dev/null | openssl x509 -noout -subject -dates
```

Partner 服务在远程服务器（`PARTNER_API_HOST`，默认 `212.56.40.104:8080`）运行后：

```bash
# 确认 nginx 容器内 hosts 指向正确 IP
docker compose --env-file .env.production -f docker-compose.prod.yml exec nginx cat /etc/hosts | grep partner-api

curl -sf https://partner.yibinfeng.com/api/v1/health   # 按 Partner 实际 health 路径调整
```

### Step E: 微信小程序（Partner 方，域名批下来后）

微信公众平台 → 开发 → 开发管理 → 开发设置 → **服务器域名** → request 合法域名 → 添加 `https://partner.yibinfeng.com`（仅域名，不带路径）。

批下来后小程序改 baseURL，再按 [docs/specs/partner-api.md](./docs/specs/partner-api.md) 删除 www 上的 Partner catch-all。

---

## GitHub Actions CI/CD

### 1. Add Repository Secrets

In GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|--------|-------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Personal access token |
| `SSH_PRIVATE_KEY` | CVM SSH private key |
| `CVM_IP` | CVM public IP |
| `CVM_USER` | SSH username (ubuntu/root) |

### 2. Auto-Deploy

Each push to `main` → GitHub Actions → Build → Push to Docker Hub → SSH to CVM → Restart containers

Check progress at: GitHub repo → Actions

---

## Monitoring & Maintenance

See [docs/deployment/MAINTENANCE.md](./docs/deployment/MAINTENANCE.md) for:
- Daily health checks
- Weekly backups
- Monthly cleanup
- SSL cert renewal
- Performance optimization

## Troubleshooting

See [docs/deployment/TROUBLESHOOT.md](./docs/deployment/TROUBLESHOOT.md) for:
- Container issues
- Database connection errors
- Nginx 502 errors
- SSL certificate problems
- Disk space management

---

## Full Deployment Automation

For hands-off CVM deployment via Agent, see [docs/deployment/AGENT_PROMPT.md](./docs/deployment/AGENT_PROMPT.md)

---

## Security Checklist

- [ ] `.env.production` excluded from git (.gitignore)
- [ ] SSL/HTTPS configured and valid
- [ ] All secrets set to strong passwords
- [ ] Firewall allows only 80/443 (or specific IPs)
- [ ] Regular backups enabled
- [ ] Database accessible only from containers

---

## Common Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop everything
docker compose -f docker-compose.prod.yml down

# Update code & redeploy (normative — remounts nginx after static build)
git pull && ./scripts/deploy-prod.sh

# If resume/portal/wechat return 403/404 after a rebuild but files exist on disk:
# see docs/deployment/TROUBLESHOOT.md § "stale bind mount"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate nginx
```

---

## See Also

- [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md) — Local dev setup
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System design
- [docs/deployment/AGENT_PROMPT.md](./docs/deployment/AGENT_PROMPT.md) — Full automation
- [docs/deployment/TROUBLESHOOT.md](./docs/deployment/TROUBLESHOOT.md) — Problem solving
- [docs/deployment/MAINTENANCE.md](./docs/deployment/MAINTENANCE.md) — Regular tasks
