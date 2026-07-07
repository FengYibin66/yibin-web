# 生产部署指南

> **状态**: ✅ 生产就绪  
> **日期**: 2026-07-07  
> **目标**: 单一 CVM（腾讯云香港）上统一部署 yibin_web 三应用

---

## 快速开始

### 前置条件
- Linux 服务器（Ubuntu 22.04+）
- Docker + Docker Compose
- 三个域名已配置 DNS A 记录指向 CVM IP
- Let's Encrypt SSL 证书

### 部署命令（5 分钟完成）

```bash
# 1. 登录 CVM
ssh user@your_cvm_ip

# 2. 克隆项目
mkdir -p /data && cd /data
git clone https://github.com/FengYibin66/yibin-web.git
cd yibin-web

# 3. 配置环境变量
cp .env.production.example .env.production
# 编辑 .env.production：
#   - MYSQL_ROOT_PASSWORD / MYSQL_PASSWORD
#   - DASHSCOPE_API_KEY
#   - 微信 API Key
#   - 其他敏感信息

# 4. 启动服务
docker compose -f docker-compose.prod.yml up -d --build

# 5. 验证
docker compose -f docker-compose.prod.yml ps
curl https://www.yibinfeng.com/api/health
```

---

## 架构概览

```
┌─ Tencent Cloud CVM（Hong Kong 2C4G）
├─ Docker Network (yibin-net)
│  ├─ nginx:alpine （port 80/443）
│  │  ├─ www.yibinfeng.com → portal-client (dist/) + portal-server (:3001)
│  │  ├─ resume.yibinfeng.com → resume (out/)
│  │  └─ mpauto.yibinfeng.com → auto-wechat-frontend (dist/) + api (:8080)
│  ├─ portal-server:3001 （Node.js Hono）
│  ├─ auto-wechat-api:8080 （Go）
│  ├─ auto-wechat-worker （Go task processor）
│  ├─ llm-service:8090 （Python FastAPI）
│  ├─ mysql:3306 （MySQL 8.4）
│  └─ redis:6379 （Redis 7）
├─ Volumes
│  ├─ mysql_data （数据持久化）
│  ├─ redis_data （缓存持久化）
│  └─ media_data （用户上传文件）
└─ External
   ├─ /etc/letsencrypt （SSL 证书）
   └─ Tencent Cloud COS （对象存储）
```

---

## 核心文件清单

| 文件 | 说明 |
|------|------|
| `docker-compose.prod.yml` | 完整的生产编排配置 |
| `docker/Dockerfile.portal-server` | Portal 后端多阶段构建 |
| `docker/Dockerfile.resume` | Resume 静态 Nginx 容器 |
| `docker/nginx-prod.conf` | Nginx 反向代理（HTTPS、路由、缓存） |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD 自动部署 |
| `.env.production.example` | 环境变量配置模板 |

---

## 详细部署步骤

### Step 1: 初始化 CVM

```bash
# 系统更新
sudo apt-get update && sudo apt-get upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证
docker --version
docker compose --version
```

### Step 2: 配置 SSL 证书（Let's Encrypt）

```bash
# 安装 certbot
sudo apt-get install -y certbot

# 获取证书（使用 standalone 模式）
sudo certbot certonly --standalone \
  -d www.yibinfeng.com \
  -d resume.yibinfeng.com \
  -d mpauto.yibinfeng.com \
  -d yibinfeng.com \
  --agree-tos \
  --email your-email@example.com

# 证书位置：
# - /etc/letsencrypt/live/www.yibinfeng.com/fullchain.pem
# - /etc/letsencrypt/live/www.yibinfeng.com/privkey.pem
# （其他域名类似）

# 配置自动续期（crontab）
sudo certbot renew --dry-run
# 应该能看到 "Congratulations! All renewals succeeded."
```

### Step 3: 克隆项目 & 配置环境

```bash
# 创建数据目录
sudo mkdir -p /data
sudo chown $USER:$USER /data
cd /data

# 克隆项目
git clone https://github.com/FengYibin66/yibin-web.git
cd yibin-web

# 复制环境配置模板
cp .env.production.example .env.production

# 编辑 .env.production（使用 vim/nano）
nano .env.production
```

**需要填写的关键变量：**
```ini
# MySQL
MYSQL_ROOT_PASSWORD=your_strong_password_here
MYSQL_PASSWORD=wechat_password_here

# Portal
ADMIN_PASSWORD=your_admin_password

# API Keys
DASHSCOPE_API_KEY=your_dashscope_key
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret

# Tencent Cloud
TENCENT_SECRET_ID=your_tencent_id
TENCENT_SECRET_KEY=your_tencent_key
COS_BUCKET=your_bucket_name

# Session / Security
SECRET_KEY=generate_a_random_32_char_string_here
```

### Step 4: 启动 Docker Compose

```bash
# 构建镜像并启动容器（首次 ~5-10 分钟）
docker compose -f docker-compose.prod.yml up -d --build

# 查看所有服务状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f portal-server
docker compose -f docker-compose.prod.yml logs -f auto-wechat-api
```

### Step 5: 验证部署

```bash
# 等待所有服务启动（~30 秒）
sleep 30

# 健康检查
curl -i https://www.yibinfeng.com/api/health
curl -i https://resume.yibinfeng.com/
curl -i https://mpauto.yibinfeng.com/api/v1/health

# 查看容器日志
docker compose -f docker-compose.prod.yml logs --tail=20 mysql
docker compose -f docker-compose.prod.yml logs --tail=20 redis
```

---

## GitHub Actions CI/CD 配置

### 前置：添加 GitHub Secrets

在你的 GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，添加以下值：

| Secret Name | Value |
|-------------|-------|
| `DOCKER_USERNAME` | Docker Hub 用户名 |
| `DOCKER_PASSWORD` | Docker Hub 个人访问令牌 |
| `SSH_PRIVATE_KEY` | CVM SSH 私钥（`cat ~/.ssh/id_rsa`） |
| `CVM_IP` | 腾讯云 CVM 公网 IP |
| `CVM_USER` | SSH 用户名（通常 `ubuntu` 或 `root`） |

### 自动部署工作流

每次 push 到 `main` 分支时，GitHub Actions 会：

1. ✅ 检查代码
2. ✅ 构建所有应用（Portal、Resume、Auto-Wechat）
3. ✅ 构建 Docker 镜像
4. ✅ 推送镜像到 Docker Hub
5. ✅ SSH 连接 CVM
6. ✅ 拉取最新镜像并重启容器
7. ✅ 健康检查

**查看部署状态：** GitHub repo → **Actions** 标签页

---

## 监控 & 维护

### 查看日志

```bash
# 实时日志
docker compose -f docker-compose.prod.yml logs -f

# 特定服务
docker compose -f docker-compose.prod.yml logs nginx
docker compose -f docker-compose.prod.yml logs portal-server

# 最后 N 行
docker compose -f docker-compose.prod.yml logs --tail=50
```

### 常见命令

```bash
# 重启所有服务
docker compose -f docker-compose.prod.yml restart

# 重启特定服务
docker compose -f docker-compose.prod.yml restart portal-server

# 停止所有服务
docker compose -f docker-compose.prod.yml down

# 清理未使用的镜像 & 卷
docker image prune -f
docker volume prune -f

# 查看资源使用
docker stats
```

### SSL 证书续期

```bash
# 手动续期
sudo certbot renew

# 查看证书过期时间
sudo certbot certificates

# 自动续期（已通过 cron 配置）
sudo systemctl status certbot.timer
```

---

## 故障排查

### Portal Server 无法连接数据库

```bash
# 1. 检查 MySQL 是否正常
docker compose -f docker-compose.prod.yml logs mysql

# 2. 验证连接字符串
docker compose -f docker-compose.prod.yml exec portal-server env | grep DATABASE_URL

# 3. 手动测试数据库连接
docker compose -f docker-compose.prod.yml exec mysql \
  mysql -h mysql -u wechat -p$MYSQL_PASSWORD wechat_ai -e "SELECT 1"
```

### Nginx 返回 502 Bad Gateway

```bash
# 1. 检查后端服务是否运行
docker compose -f docker-compose.prod.yml ps

# 2. 查看后端日志
docker compose -f docker-compose.prod.yml logs portal-server
docker compose -f docker-compose.prod.yml logs auto-wechat-api

# 3. 检查网络连接
docker compose -f docker-compose.prod.yml exec nginx ping portal-server
```

### SSL 证书错误

```bash
# 1. 检查证书有效期
sudo certbot certificates

# 2. 手动续期
sudo certbot renew --force-renewal

# 3. 重新加载 Nginx
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 性能优化建议

1. **MySQL 调优** — 根据数据量调整 `max_connections`, `innodb_buffer_pool_size`
2. **Redis 内存管理** — 在 docker-compose.prod.yml 中调整 `maxmemory` 和 `maxmemory-policy`
3. **Nginx 缓存** — 静态资源已配置 1 年缓存，HTML 文件 1 小时
4. **容器资源限制** — 每个服务都配置了 `mem_limit` 和 `cpus`，可按需调整

---

## 备份策略

### 数据库备份

```bash
# 手动备份
docker compose -f docker-compose.prod.yml exec mysql \
  mysqldump -u root -p$MYSQL_ROOT_PASSWORD wechat_ai > backup_$(date +%Y%m%d).sql

# 自动备份（建议配置 cron）
0 2 * * * cd /data/yibin-web && docker compose exec -T mysql \
  mysqldump -u root -p$MYSQL_ROOT_PASSWORD wechat_ai > /data/backups/backup_$(date +\%Y\%m\%d).sql
```

### Redis 数据备份

```bash
# Redis 已配置 AOF（appendonly: yes）
# 持久化文件：/var/lib/docker/volumes/yibin_web_redis_data/_data/

# 定期备份卷数据
sudo tar -czf /data/backups/redis_backup_$(date +%Y%m%d).tar.gz \
  /var/lib/docker/volumes/yibin_web_redis_data/
```

---

## 灾难恢复

### 容器崩溃自动重启

所有容器已配置 `restart: unless-stopped`，Docker 会自动重启失败的容器。

```bash
# 查看重启历史
docker inspect --format='{{.State.StartedAt}}' container_name
docker inspect --format='{{.State.FinishedAt}}' container_name
```

### 完全重建

```bash
# 1. 停止所有服务
docker compose -f docker-compose.prod.yml down -v

# 2. 清空所有数据（谨慎！）
docker system prune -a --volumes

# 3. 重新启动
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 安全检查清单

- [ ] `.env.production` 已从 git 中排除（`.gitignore` 已配置）
- [ ] HTTPS/SSL 证书已配置且有效
- [ ] 所有敏感信息（API Key、密码）已更新为强密码
- [ ] MySQL 默认用户已删除或密码已更改
- [ ] 防火墙已配置（仅开放 80、443 端口）
- [ ] 定期备份已启用
- [ ] 监控告警已设置（可选：集成 Datadog/Prometheus）

---

## 常见问题

**Q: 如何更新应用代码？**
A: 推送到 main 分支，GitHub Actions 会自动构建、推送镜像，然后 SSH 到 CVM 重启容器。

**Q: 如何添加新的环境变量？**
A: 编辑 `.env.production`，重启容器：`docker compose -f docker-compose.prod.yml restart`

**Q: 磁盘空间不足怎么办？**
A: 运行 `docker system prune -a` 清理未使用镜像，或增加 CVM 磁盘空间。

**Q: 能否用其他云服务商（AWS、阿里云）？**
A: 是的，docker-compose 配置通用，仅需调整域名 DNS 和防火墙规则。

---

## 支持 & 文档

- Deployment Spec: `/docs/specs/`
- Docker Compose 参考: `docker-compose.prod.yml`
- Nginx 配置: `docker/nginx-prod.conf`
- CI/CD 工作流: `.github/workflows/deploy.yml`

---

**部署完成后，请访问以下 URL 验证：**

- 📱 Portal: https://www.yibinfeng.com
- 📄 Resume: https://resume.yibinfeng.com
- 🤖 Auto-Wechat: https://mpauto.yibinfeng.com
- 🏥 Health: https://www.yibinfeng.com/api/health

祝部署顺利！ 🚀
