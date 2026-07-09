# 环境配置模板目录

**权威 Spec**：[`docs/specs/platform.md`](../docs/specs/platform.md)

本目录存放所有 **env 模板**（`env.*.example`），分为两类：

## 1. 后端 / 共享配置

运行时文件由 `scripts/env-build.sh` 生成，详见 Spec。

```bash
cp config/env.shared.example .env.shared.local
./scripts/env-build.sh development   # 或 production
```

### 文件说明

| 文件 | 用途 |
|------|------|
| `env.shared.example` | 敏感信息（密钥、密码）— 所有环境通用 |
| `env.development.example` | 开发环境 URL 和开关（脚本自动合并） |
| `env.production.example` | 生产环境 URL 和开关（脚本自动合并） |
| `env.production.localhost.example` | 本地 prod compose localhost 覆盖 |

## 2. 前端配置

前端应用使用 Vite，环保变量在构建时编译到产物中。

```bash
# Auto-Wechat 前端（开发）
cd apps/auto-wechat/frontend
VITE_API_BASE_URL=http://localhost:8080/api/v1 pnpm run dev

# 生产构建（URLs 在 env.production.example 或 .env.production）
pnpm run build
```

### 文件说明

| 文件 | 用途 |
|------|------|
| `env.frontend.example` | 前端统一模板（所有 Vite 应用） |

详见 [`docs/GETTING_STARTED.md`](../docs/GETTING_STARTED.md) 快速参考。

Spec 索引：[`docs/specs/README.md`](../docs/specs/README.md)
