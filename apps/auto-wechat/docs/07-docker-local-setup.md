# 07 · 本地 Docker 环境配置

> 文档版本：**v1.2**  
> 最后更新：2026-06-02  
> 适用：`make dev-up` 本地全栈启动

---

## 1. 前置条件

| 项 | 要求 |
|----|------|
| 系统 | macOS（Apple Silicon / Intel 均可） |
| Docker | **Docker Desktop** 已安装并处于 **Running** |
| 项目配置 | 根目录 `.env.development`（`./scripts/env-build.sh development`） |

验证 Docker 可用：

```bash
docker --version
docker compose version
```

---

## 2. 配置镜像加速（国内必做）

直连 Docker Hub（`registry-1.docker.io`）常超时或拉取失败。本项目使用 **阿里云容器镜像加速器**。

### 2.1 加速器地址（本项目）

```
https://5g26zosj.mirror.aliyuncs.com
```

> 若加速器失效，登录 [阿里云容器镜像服务 → 镜像加速器](https://cr.console.aliyun.com/cn-hangzhou/instances/mirrors) 获取新地址并替换下方 JSON。

### 2.2 在 Docker Desktop 中配置

1. 打开 **Docker Desktop**
2. 右上角 **Settings（设置）**
3. 左侧 **Docker Engine**
4. 将文本框内容替换为（保留原有 builder 配置，加入 `registry-mirrors`）：

```json
{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "experimental": false,
  "registry-mirrors": [
    "https://5g26zosj.mirror.aliyuncs.com"
  ]
}
```

5. 点击 **Apply & restart**（应用并重启）
6. 等待菜单栏鲸鱼图标恢复 **Running**

**注意：** JSON 格式必须合法（逗号、括号）。若 Apply 后 Docker 无法启动，改回修改前的配置再 Apply。

### 2.3 验证镜像加速已生效

```bash
docker info | grep -A 3 "Registry Mirrors"
```

应看到：

```
Registry Mirrors:
  https://5g26zosj.mirror.aliyuncs.com/
```

### 2.4 预拉基础镜像（推荐）

```bash
docker pull redis:7-alpine
docker pull docker.m.daocloud.io/library/mysql:8.4
```

> **MySQL 勿用** 裸 `docker pull mysql:8.4`（Hub 加速器易 403）。  
> 项目 compose 使用 **DaoCloud 公共代理**（见 §4.3）。

两条均 `Downloaded` 或 `up to date` 后再 `make dev-up`。

---

## 3. 启动项目

```bash
cd auto_wechat_tech_content
make dev-up
```

首次会构建 `api`、`worker`、`llm-service`，可能需要 **5～20 分钟**。

### 3.1 检查容器

```bash
docker compose -f docker-compose.dev.yml ps
```

期望 5 个服务均为 **running** / **healthy**：`mysql`、`redis`、`llm-service`、`api`、`worker`。

### 3.2 健康检查

```bash
make health
```

或手动：

```bash
curl http://localhost:8080/api/v1/health

curl -H "X-API-Key: dev-admin-auto-wechat-tech-content" \
  http://localhost:8080/api/v1/health/ready
```

### 3.3 启动前端

```bash
cd frontend && pnpm dev
```

浏览器打开 **http://localhost:5173**。

### 3.4 停止服务

```bash
make dev-down
```

---

## 4. 常见问题

### 4.1 `context deadline exceeded`

**原因：** 未配置镜像加速或加速未生效。  
**处理：** 按 §2 配置阿里云加速器，Apply & restart 后重试 `docker pull`。

### 4.2 `short read ... unexpected EOF`

**原因：** 下载镜像层时网络中断。  
**处理：** 直接重试 `docker pull <镜像名>`；仍失败则 `docker image prune -f` 后重试。

### 4.3 MySQL 拉取失败（403 / access denied）

**推荐：DaoCloud 公共代理（项目 compose / Dockerfile 已配置）**

| 用途 | 镜像 |
|------|------|
| MySQL（compose） | `docker.m.daocloud.io/library/mysql:8.4` |
| Go 构建（Dockerfile） | `docker.m.daocloud.io/library/golang:1.22-alpine` |
| 运行阶段（Dockerfile） | `docker.m.daocloud.io/library/alpine:3.20` |
| Python（Dockerfile） | `docker.m.daocloud.io/library/python:3.11-slim` |

手动预拉 MySQL：

```bash
docker pull docker.m.daocloud.io/library/mysql:8.4
make dev-up
```

### 4.4 `403 Forbidden`（加速器拉 Hub 镜像）

**现象：**

```text
HEAD request to https://5g26zosj.mirror.aliyuncs.com/v2/library/mysql/manifests/8.4 ... 403 Forbidden
```

**原因：** 阿里云**个人加速器**代理 `docker.io` 时可能限流或拒拉部分镜像。

**处理：** 优先用 DaoCloud 前缀拉取（见 §4.3 表格）。

### 4.5 `pull access denied`（阿里云 registry.cn-hangzhou library）

**现象：**

```text
pull access denied for registry.cn-hangzhou.aliyuncs.com/library/mysql, repository does not exist
```

**原因：** 阿里云 **`library/` 公共命名空间已不可用**，并非需要 login。

**处理：** 改用 §4.3 DaoCloud 镜像地址。

### 4.6 端口被占用（3306 / 6379 / 8080 / 8090）

**原因：** 本机已运行 MySQL、Redis 或其他服务。  
**处理：**

```bash
lsof -i :3306
lsof -i :6379
```

停掉冲突进程，或修改 `docker-compose.dev.yml` 中宿主机端口映射。

### 4.7 查看服务日志

```bash
make dev-logs
# 或
docker compose -f docker-compose.dev.yml logs api
docker compose -f docker-compose.dev.yml logs worker
docker compose -f docker-compose.dev.yml logs llm-service
```

---

## 5. 相关文档

- [README.md](../README.md) — 项目概览
- [04-operations-runbook.md](./04-operations-runbook.md) — 运维与排查
- [05-infrastructure-checklist.md](./05-infrastructure-checklist.md) — 环境依赖清单
