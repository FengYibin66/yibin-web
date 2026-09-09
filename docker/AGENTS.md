# docker/

生产与本地的容器化资产：两份 nginx 配置、两个 Dockerfile、一个入口脚本。

| 文件 | 用途 |
|------|------|
| `nginx-prod.conf` | 生产 nginx **完整配置**（不是 conf.d 片段），由 `docker-compose.prod.yml` 以**单文件 bind-mount** 挂到 `/etc/nginx/nginx.conf:ro` |
| `nginx-local.conf` | 本地 compose 用，同样形态 |
| `Dockerfile.portal-server` | portal 的 Hono 服务镜像，入口是 `portal-server-entrypoint.sh` |
| `Dockerfile.resume` | nginx 托管 resume 的 `out/`。**已写好但 compose 没用它**——生产是把 `out/` 目录挂进公用 nginx。见 `docs/architecture/platform-roadmap.md` |
| `portal-server-entrypoint.sh` | 容器启动时先跑 `node dist/db/migrate.js` 再起服务。**数据库迁移是在这里执行的**，不是在 CI、也不是人工 |

## 改了 nginx 配置，必须重建容器——`reload` 不够

**2026-09-09 因为这件事绕了一圈**：合入配置修复后在 CVM 上 `git pull` → `nginx -t`（通过）→ `nginx -s reload`（成功）→ 行为**一点没变**。

原因：compose 挂的是**单个文件**

```yaml
- ./docker/nginx-prod.conf:/etc/nginx/nginx.conf:ro
```

Docker 挂单文件时绑定的是那个文件的 **inode**。而 `git pull` 更新文件的方式是「写新文件再改名覆盖」，inode 变了，容器里的挂载点仍指向已经没人引用的旧 inode。于是**宿主机上是新配置，容器里是旧配置**——同一个路径，两个文件。

最坑的是 `nginx -t` 也说"成功"：它在容器内测的正是那份旧配置，语法当然没问题。**"配置检查通过"在这种情况下毫无信息量。**

正确的应用方式：

```bash
cd ~/yibin-web && git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate nginx
./scripts/probe-routes.sh          # 必须用行为验证，不能只看 nginx -t
```

代价是一两秒连接中断（容器替换），三个站都会闪一下。这是单文件 bind-mount 这一形态的固有代价。

**怎么判断容器读的是哪份文件**：`nginx -t` 的警告带行号。拿它跟 `grep -n "listen 443 ssl http2" docker/nginx-prod.conf` 对一下——行号对不上就说明容器读的是旧的。这是当时定位问题的实际手段，比猜快得多。

`scripts/deploy-prod.sh` 已经在构建后 `--force-recreate nginx`，所以**走完整部署流程不会遇到这个问题**；它只出现在「只改配置、想省一步」的捷径上。

## `nginx-prod.conf` 里有两类 server 块，兜底规则相反

| 站点 | 形态 | `try_files` |
|------|------|-------------|
| portal（`www`） | Vite React **SPA**，客户端路由 | `$uri $uri/ /index.html` —— **需要**兜底，未知路径交给前端路由 |
| wechat（`mpauto`） | Vue **SPA** | 同上 |
| resume | Next.js `output: 'export'` + `trailingSlash: true`，**每条路由都有自己的 `index.html`** | `$uri $uri/ =404` + `error_page 403 404 =404 /404.html` —— **不要**兜底 |

resume 那条别改回 `/index.html`。它曾经是，代价是两个缺陷：存在但无 `index.html` 的目录（`/classic/experience/`）吐裸 nginx **403**，未知路径返回 **200 + 首页**（软 404，搜索引擎会把一堆 URL 当重复首页收录）。改动前先读那一段的注释。

`$uri/` 三处都要保留：nginx 靠它做「无斜杠 → 带斜杠」的 301 重定向，删掉 `trailingSlash: true` 的路由会直接 404。

## 已知噪声与已登记的缺陷

- **`listen ... http2 is deprecated` 警告**：四处 `listen 443 ssl http2`，新版 nginx 要求写成独立的 `http2 on;`。是噪声不是错误，`nginx -t` 仍然通过。改它要同时确认镜像里的 nginx 版本支持新写法。
- **nginx 容器健康检查从未通过**：线上常年 `(unhealthy)` 而站点正常。检查打的是 80 端口，而 80 无条件 `301` 到 `https://$host`（此处 `$host` = `localhost`），443 上没有 `localhost` 的 server 块 → 证书名不匹配 → 失败。**它从写下来那天就不可能通过**。已登记在根 `CLAUDE.md` 负债表。
- **证书续期无机制**：webroot 的 acme location 和 `certbot-webroot` 卷都在，但卷是**只读**挂进 nginx 的，缺能写入的一侧。同样在负债表，有时限。

## 验证

配置改动**没法在本机验证**（本仓库的开发机通常没有 nginx）。唯一的验证是对着真实部署发请求：

```bash
./scripts/probe-routes.sh                       # 探生产
./scripts/probe-routes.sh http://localhost:8080 # 探本地 compose
```

单测和 E2E 都覆盖不到这一层——Playwright 跑的是它自己的静态服务器，不经过 nginx；CI 又不部署，也就没有 nginx。
