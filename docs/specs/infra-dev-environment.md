# Spec: Monorepo 开发环境基础设施

**状态**: Ready — 已实现  
**作者**: Yibin Feng  
**日期**: 2026-07-05  
**关联**: portal-homepage.md, resume spec (TBD), auto-wechat spec (TBD)

---

## 1. Context

`yibin_web` 是一个 pnpm monorepo，包含三个独立应用。需要统一的开发环境规范，解决以下问题：
- 多应用端口冲突
- 开发域名与生产域名不一致
- 缺少一键启动脚本

---

## 2. 域名架构（生产 & 开发一致）

| 应用 | 域名 | 说明 |
|------|------|------|
| Portal | `www.yibinfeng.com` | 个人主站入口 |
| Resume | `resume.yibinfeng.com` | 交互式简历站 |
| Auto-Wechat | `mpauto.yibinfeng.com` | 微信公众号自动化平台 |

**设计原则**：开发环境域名与生产完全一致，通过 SwitchHosts + 本地 Caddy 实现。

---

## 3. 端口分配

| 服务 | 端口 | 备注 |
|------|------|------|
| portal Vite client | 5173 | Caddy 反代入口 |
| portal Hono server | 3001 | 仅 Vite proxy 访问，不直接暴露 |
| resume Next.js | 3000 | Caddy 反代入口 |
| auto-wechat Vue Vite | 5174 | Caddy 反代入口 |
| auto-wechat Go API | 8080 | auto-wechat Vite proxy 访问 |
| auto-wechat Python LLM | 8090 | 内部服务 |

---

## 4. 启动方式

```bash
# 一键启动（portal + resume + wechat frontend）
pnpm dev:all

# 单独启动
pnpm dev:portal   # → http://www.yibinfeng.com:5173
pnpm dev:resume   # → http://resume.yibinfeng.com:3000
pnpm dev:wechat   # → http://mpauto.yibinfeng.com:5174
```

> **注意**：auto-wechat 后端（Go API + Python LLM + MySQL + Redis）通过 Docker Compose 单独启动：
> ```bash
> cd apps/auto-wechat && make dev-up
> ```

---

## 5. 一次性本地配置

### SwitchHosts 配置
```
127.0.0.1  www.yibinfeng.com
127.0.0.1  resume.yibinfeng.com
127.0.0.1  mpauto.yibinfeng.com
```
开发时启用，不开发时关闭（避免无法访问生产站）。

---

## 6. 各应用 Dev 配置要求

### Portal
- Vite: `host: true`, `allowedHosts: ['www.yibinfeng.com', 'localhost']`
- server `.env`: `PORT=3001`, `CLIENT_ORIGIN=http://www.yibinfeng.com,http://localhost:5173`
- server 启动命令: `tsx watch --env-file=../.env src/index.ts`（Node 20+ 原生 `--env-file`）
- CORS: 服务端按逗号分隔解析 `CLIENT_ORIGIN`，支持多 origin

### Resume
- Next.js dev 命令: `next dev -p 3000`（明确指定，防止未来冲突）

### Auto-Wechat Frontend
- Vite: `port: 5174`, `host: true`, `allowedHosts: ['mpauto.yibinfeng.com', 'localhost']`
- `.env.development`: `CORS_ALLOWED_ORIGINS=http://mpauto.yibinfeng.com,http://localhost:5174`

---

## 7. 生产部署域名说明

Auto-Wechat 生产环境使用 `mpauto.yibinfeng.com`（nginx `server_name`）。  
**变更前历史**：曾使用 `yibinfeng.com`/`www.yibinfeng.com`，2026-07-05 迁移至子域名，归还主站域名给 Portal。

微信公众号后台需同步更新：
- JS-SDK 安全域名
- OAuth 回调域名
- 服务器配置 URL（消息推送）

---

## 8. 验收标准

- [ ] `pnpm dev:all` 启动，三个进程（portal、resume、wechat）无冲突
- [ ] SwitchHosts 启用后，`http://www.yibinfeng.com:5173`、`http://resume.yibinfeng.com:3000`、`http://mpauto.yibinfeng.com:5174` 均可访问
- [ ] `http://www.yibinfeng.com:5173/api/profile` 返回数据，无 CORS 错误
- [ ] 关闭 SwitchHosts 后，三个域名正常解析到生产服务器
