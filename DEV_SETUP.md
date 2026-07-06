# Dev Environment Setup

## 快速参考

| 命令 | 访问地址 |
|------|---------|
| `pnpm dev:portal` | http://www.yibinfeng.com:5173 |
| `pnpm dev:resume` | http://resume.yibinfeng.com:3000 |
| `pnpm dev:resume` → Gallery | http://resume.yibinfeng.com:3000/gallery |
| `pnpm dev:wechat` | http://mpauto.yibinfeng.com:5174 |

> SwitchHosts 必须开着才能用域名访问，否则用 `localhost:端口`

---

## 域名架构

| 应用 | 开发访问地址 | 生产域名 |
|------|------------|---------|
| Portal（主站） | `http://www.yibinfeng.com:5173` | `www.yibinfeng.com` |
| Resume（简历站） | `http://resume.yibinfeng.com:3000` | `resume.yibinfeng.com` |
| Auto-Wechat（微信平台） | `http://mpauto.yibinfeng.com:5174` | `mpauto.yibinfeng.com` |

---

## 一次性配置（首次）

在 SwitchHosts 中新建规则组 `yibin-local-dev`，添加：

```
127.0.0.1  www.yibinfeng.com
127.0.0.1  resume.yibinfeng.com
127.0.0.1  mpauto.yibinfeng.com
```

开发时启用，不开发时关闭（避免无法访问生产站）。

---

## 启动 Portal / Resume

```bash
# 从 monorepo 根目录

# 一键启动全部前端应用
pnpm dev:all

# 或单独启动
pnpm dev:portal   # portal client + server 同时启动
pnpm dev:resume
pnpm dev:wechat   # 仅 auto-wechat 前端
```

启动后访问：
- `http://www.yibinfeng.com:5173`
- `http://resume.yibinfeng.com:3000`

---

## 启动 Auto-Wechat 后端

后端依赖 Docker Compose，需单独启动。

### 前置条件
- Docker Desktop 已运行

### 1. 进入目录

```bash
cd apps/auto-wechat
```

### 2. 启动所有后端服务

```bash
make dev-up
```

启动的服务：MySQL、Redis、Go API（air 热更新）、Python LLM service（uvicorn 热更新）、Worker。

### 3. 验证是否成功

```bash
make health
```

两行都返回 200 / `{"status":"ok"}` 即为成功。

### 4. 查看日志

```bash
make dev-logs
```

### 5. 停止

```bash
make dev-down
```

### 常见问题

**Sequel Ace / 数据库工具连不上 MySQL：**
```bash
make mysql-fix-auth
```

**改了 Go/Python 代码后依赖变更（非热更新能覆盖的情况）：**
```bash
make dev-build
```

---

## 端口分配

| 服务 | 端口 |
|------|------|
| portal Vite client | 5173 |
| portal Hono server | 3001 |
| resume Next.js | 3000 |
| auto-wechat Vue Vite | 5174 |
| auto-wechat Go API | 8080 |
| auto-wechat Python LLM | 8090 |
| auto-wechat MySQL | 3307 |
| auto-wechat Redis | 6379 |
