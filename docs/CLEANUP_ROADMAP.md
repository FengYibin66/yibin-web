# 🧹 代码库清理路线图

> **状态**: 非阻塞项  
> **上线影响**: 无  
> **建议时间表**: 上线后逐步完成

---

## 问题 1: 环境变量管理分散

### 当前状态
```
/Users/tal/Desktop/Code/personal_yibin/yibin_web/
├── .env.production                    ← 根目录（部署临时，不应 commit）
├── .env.production.example            ← 根目录（生产环境模板）
├── AGENT_DEPLOYMENT_PROMPT.md         ← 引用 .env.production
├── DEPLOYMENT.md                      ← 部署文档
├── apps/
│   ├── portal/
│   │   └── .env.example               ← Portal 配置模板
│   └── auto-wechat/
│       ├── .env                       ← 开发环境（不应 commit）
│       ├── .env.example               ← 开发模板
│       ├── .env.development           ← 开发环境
│       ├── .env.production            ← 生产环境（不应 commit）
│       ├── .env.production.example    ← 生产模板
│       └── frontend/
│           ├── .env.development       ← 前端开发
│           ├── .env.example           ← 前端模板
│           ├── .env.production        ← 前端生产
│           └── .env.production.example ← 前端生产模板
```

### 问题
- ❌ **分散**：配置文件散落在 5 个位置  
- ❌ **重复**：`.env.production.example` 出现 2 次  
- ❌ **混乱**：根目录 `.env.production` 不应该 commit（是部署时临时文件）  
- ❌ **难维护**：更新配置时需要改多个地方  

### 改进方案
✅ **统一到 `config/` 目录**

```
/config/
├── README.md                          ← 环境变量文档
├── env.shared.example                 ← 所有应用共享的变量
├── env.production.example             ← 生产环境专用变量
├── env.development.example            ← 开发环境专用变量
├── env.localhost.example              ← 本地开发模板
└── schemas/
    └── env.schema.ts                  ← Zod schema 验证（可选）
```

### 实施步骤
1. 创建 `config/` 目录
2. 梳理所有 `.env.example`，分类到上述文件
3. 创建 `config/README.md` 说明如何填写
4. 删除 apps 下的冗余 `.env.example`（保留必要的如前端 API 地址）
5. 更新 `.gitignore`（所有 `.env` 和 `.env.production` 忽略）
6. 更新 DEPLOYMENT.md 和 AGENT_DEPLOYMENT_PROMPT.md

---

## 问题 2: 文档入口多

### 当前状态
```
README.md                           ← 项目简介
DEPLOYMENT.md                       ← 生产部署指南（441 行）
AGENT_DEPLOYMENT_PROMPT.md          ← Agent 部署 Prompt（294 行）
DEV_SETUP.md                        ← 开发环境设置
docs/specs/                         ← 功能 Spec
docs/specs/README.md                ← Spec 索引
docs/specs/platform.md              ← 平台 Spec
```

### 问题
- ❌ **入口不清**：新开发者不知道从哪个文档开始  
- ❌ **重复内容**：DEPLOYMENT.md 和 AGENT_DEPLOYMENT_PROMPT.md 有很多重复  
- ❌ **零散**：没有统一的导航和组织  

### 改进方案
✅ **建立文档体系**

```
/docs/
├── README.md                        ← 文档导航（新增）
├── GETTING_STARTED.md               ← 开发快速开始（新增）
├── DEPLOYMENT.md                    ← 生产部署（精简）
├── DEPLOYMENT_AGENT_PROMPT.md       ← Agent Prompt（移到这里）
├── ARCHITECTURE.md                  ← 架构文档（新增）
├── specs/
│   ├── README.md
│   ├── platform.md
│   └── ...
└── deployment/
    ├── setup-cvm.md                 ← CVM 初始化步骤
    ├── troubleshoot.md              ← 故障排查
    └── maintenance.md               ← 运维指南
```

### 文档内容梳理
| 文件 | 当前位置 | 建议 | 行数 |
|------|---------|------|------|
| README.md | 根目录 | 保留，精简到 50 行（只说明是什么、技术栈、快速链接） | 50 |
| DEV_SETUP.md | 根目录 | 重命名为 docs/GETTING_STARTED.md | 100 |
| DEPLOYMENT.md | 根目录 | 精简核心步骤，细节移到 deployment/ 子目录 | 200 |
| AGENT_DEPLOYMENT_PROMPT.md | 根目录 | 移到 docs/deployment/AGENT_PROMPT.md | 294 |

### 实施步骤
1. 创建 `docs/README.md` — 文档导航中心
2. 创建 `docs/GETTING_STARTED.md` — 开发快速开始
3. 创建 `docs/ARCHITECTURE.md` — 架构说明
4. 精简根目录 README.md（只保留项目介绍 + 链接）
5. 创建 `docs/deployment/` 子目录，拆分 DEPLOYMENT.md
6. 移动 AGENT_DEPLOYMENT_PROMPT.md → `docs/deployment/AGENT_PROMPT.md`
7. 删除根目录的冗余文档

---

## 问题 3: 工具函数可能有重复

### 当前状态
```
apps/resume/lib/
├── utils.ts                         ← 通用工具
├── gallery/data.ts                  ← Gallery 数据
├── content/*.ts                     ← 多语言内容
├── audio/audioManager.ts            ← 音频管理
├── scene/                           ← 3D 场景工具
└── animations/                      ← 动画工具

apps/portal/client/src/
├── lib/
│   ├── i18n.ts                      ← 国际化
│   └── api.ts                       ← API 调用
```

### 问题判断标准
❓ 不确定是否有重复，需要深入检查：
- `utils.ts` 中的函数是否在其他应用中有相似实现？
- 国际化、API 调用、数据转换等常见函数是否重复？
- 是否有可以提取到 `packages/` 中的通用工具？

### 改进方案
✅ **创建共享工具包**

```
packages/
├── ui-utils/                        ← UI 相关工具
├── api-client/                      ← API 调用工具
├── i18n-core/                       ← 国际化核心
├── common-utils/                    ← 通用工具函数
└── types/                           ← 共享类型定义
```

### 实施步骤（需要先审计）
1. **审计 apps/resume/lib/utils.ts**
   - 列出所有函数
   - 检查其他应用是否有类似实现
   
2. **检查国际化重复**
   - apps/portal/client/src/lib/i18n.ts
   - apps/auto-wechat/frontend 是否也有国际化？
   
3. **检查 API 工具重复**
   - apps/portal/client/src/lib/api.ts
   - 其他前端应用是否也有类似？
   
4. **决策**（根据审计结果）
   - 是否需要创建共享包？
   - 还是保留在各应用中（如果基本没有重复）？

---

## 🎯 优先级和实施计划

### P0: 环境变量统一（必做）
**时间**: 30-45 分钟  
**收益**: 部署流程更清晰，易于维护  

### P1: 文档统一（应做）
**时间**: 30-60 分钟  
**收益**: 新人快速上手，项目更专业  

### P2: 工具函数审计（可选）
**时间**: 1-2 小时  
**收益**: 长期维护性提升  

---

## ✅ 清理完成后的效果

```
yibin-web/
├── config/                          ← 统一的环境配置 ✨
├── docs/                            ← 清晰的文档体系 ✨
│   ├── README.md
│   ├── GETTING_STARTED.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── deployment/
│   └── specs/
├── apps/                            ← 应用代码
├── packages/                        ← 可能的共享工具
├── README.md                        ← 精简版项目简介
└── (其他文件)
```

---

## 建议时间表

- **立即上线**: 这些清理不是阻塞项，不需要延迟部署
- **上线后第 1 周**: 完成 P0 环境变量统一
- **上线后第 2 周**: 完成 P1 文档统一  
- **后续**: 根据需要完成 P2

