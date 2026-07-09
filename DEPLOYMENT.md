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
# 1. SSH into CVM
ssh user@your_cvm_ip

# 2. Clone project
mkdir -p /data && cd /data
git clone https://github.com/FengYibin66/yibin-web.git
cd yibin-web

# 3. Configure environment
cp config/env.shared.example .env.shared.local
nano .env.shared.local  # Fill in all secrets
./scripts/env-build.sh production
./scripts/env-build.sh production --check

# 4. Start services
docker compose -f docker-compose.prod.yml up -d --build

# 5. Verify
docker compose -f docker-compose.prod.yml ps
curl https://www.yibinfeng.com/api/health
```

---

## Architecture

```
Tencent Cloud CVM (Hong Kong)
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
| `scripts/env-build.sh` | Generate .env.production |

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

### Step 4: Start Services

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps  # Verify all 7 services "Up"
```

### Step 5: Verify

```bash
sleep 30  # Let services stabilize

# Health checks
curl -i https://www.yibinfeng.com/api/health
curl -i https://resume.yibinfeng.com/
curl -i https://mpauto.yibinfeng.com/api/v1/health

# Browser access
# https://www.yibinfeng.com
# https://resume.yibinfeng.com
# https://mpauto.yibinfeng.com
```

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

# Update code & redeploy
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

---

## See Also

- [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md) — Local dev setup
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System design
- [docs/deployment/AGENT_PROMPT.md](./docs/deployment/AGENT_PROMPT.md) — Full automation
- [docs/deployment/TROUBLESHOOT.md](./docs/deployment/TROUBLESHOOT.md) — Problem solving
- [docs/deployment/MAINTENANCE.md](./docs/deployment/MAINTENANCE.md) — Regular tasks
