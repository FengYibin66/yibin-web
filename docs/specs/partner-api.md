# Spec: Partner API（协作服务 / 小程序）

**状态**: Phase T（www 分流，不改小程序 URL）→ Phase 1（`partner.yibinfeng.com`）  
**日期**: 2026-07-11  
**关联**: [platform.md](./platform.md)

---

## 1. 背景

Partner 小程序已上线，request 域名配置为 `www.yibinfeng.com`。

- **换域名**（`partner.yibinfeng.com`）→ 微信后台配置审核  
- **改 API 路径**（如加 `/partner`）→ 小程序发版提审  

过渡期只能在 **Nginx 服务端**分流，**不能改客户端 URL**。

---

## 2. Phase T 路由（当前）

`www.yibinfeng.com` 上：

| 优先级 | 匹配 | 上游 |
|--------|------|------|
| 1 | `^~ /api/auth/` | `portal-server:3001` |
| 1 | `^~ /api/profile` | `portal-server:3001` |
| 1 | `^~ /api/projects` | `portal-server:3001` |
| 1 | `^~ /api/uploads` | `portal-server:3001` |
| 1 | `= /api/health` | `portal-server:3001` |
| 1 | `^~ /api/ws` | `partner-api:8080`（WebSocket，长连接） |
| 2 | `/api/`（其余） | `partner-api:8080` |

小程序继续请求现有路径，例如 `https://www.yibinfeng.com/api/v1/...`，由 Partner catch-all 转发。

### WebSocket（`/api/ws`）

Partner 后端在远程服务器 `${PARTNER_API_HOST}:8080` 提供 WebSocket。对外经 Nginx 升级为 **WSS**：

| 环境 | 小程序 / 客户端应连接 |
|------|------------------------|
| Phase T（www） | `wss://www.yibinfeng.com/api/ws` |
| Phase 1（partner 域名） | `wss://partner.yibinfeng.com/api/ws` |

**不要**在小程序里写 `ws://212.56.40.104:8080/...`（非 HTTPS、且 IP 会变）。

Nginx 已配置 `Upgrade` / `Connection` 与 24h 读超时（`location ^~ /api/ws`）。

微信后台还需配置 **socket 合法域名**（与 request 域名相同或单独添加 `www.yibinfeng.com` / `partner.yibinfeng.com`）。

**注意**：Portal 新增 `/api/xxx` 接口时，若路径未被上表覆盖，会进入 Partner。新增 Portal API 须同步扩展 nginx 白名单前缀。

---

## 3. Phase 1（正式）

微信合法域名增加 `partner.yibinfeng.com` 后：

- 小程序 baseURL 改为 `https://partner.yibinfeng.com`
- `docker/nginx-prod.conf` 中 **删除** www 的 Partner `location /api/` catch-all
- Portal 可恢复单一 `location /api/` → `portal-server:3001`

---

## 4. Upstream

| 项 | 说明 |
|----|------|
| 主机名 | `partner-api:8080`（nginx `proxy_pass`） |
| 解析 | `docker-compose.prod.yml` → `extra_hosts: partner-api:${PARTNER_API_HOST}` |
| 生产默认 | `PARTNER_API_HOST=212.56.40.104`（Partner 独立服务器，非 CVM 本机） |
| 本地 prod compose | `docker-compose.local-prod.yml` 覆盖为 `host-gateway`（本机调试） |
| 长期 | Partner 容器加入 `yibin-net`，容器名 `partner-api`，删除 `extra_hosts` |

**禁止**在 `nginx-prod.conf` 中硬编码公网 IP；IP 通过 env `PARTNER_API_HOST` + compose `extra_hosts` 注入。

**Nginx 解析注意**：Alpine/musl 下 Nginx 即使用直连 `proxy_pass http://partner-api:8080` 也可能走 Docker DNS（`127.0.0.11`）而非 `/etc/hosts`，报 `partner-api could not be resolved`。生产 nginx 须用 **IP 变量**：`set $partner_upstream ${PARTNER_API_HOST}:8080`（与 `.env.production` 同步，当前默认 `212.56.40.104`）。

变更 `PARTNER_API_HOST` 后须重建 nginx：`docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate nginx`

---

## 5. 验收

**Portal（必须）**：

```bash
curl -sf https://www.yibinfeng.com/api/health
curl -sf https://www.yibinfeng.com/api/profile
curl -sf https://www.yibinfeng.com/api/projects
```

**Partner（服务运行中）**：

```bash
curl -sf https://www.yibinfeng.com/api/<小程序实际路径>
curl -sf https://partner.yibinfeng.com/api/v1/health
```

---

## 6. Phase 1 Checklist

- [ ] 微信合法域名含 `partner.yibinfeng.com`
- [ ] certbot 含 `-d partner.yibinfeng.com`
- [ ] 小程序已切域名并验证
- [ ] 删除 www Partner catch-all；Portal 恢复完整 `/api/`
