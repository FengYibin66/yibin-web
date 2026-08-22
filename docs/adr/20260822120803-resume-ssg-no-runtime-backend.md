# 20260822120803. Resume 用 Next.js SSG 静态导出，不保留运行时后端

- 状态：已接受
- 索引：resume 站 `output: export` 纯静态、由 nginx 直接提供，无 Node 运行时；代价是任何动态需求都必须外置成独立接口，不能在 resume 内加 API route
- 日期：2026-08-22

> 追认性 ADR。

## 背景

resume 站（`resume.yibinfeng.com`）是作品集，含 3D 场景（React Three Fiber）、多个房间、图片画廊。内容变更频率低（月级），访问量小但首屏体积大（纹理资源多）。

## 选项

- **A. Next.js SSR（保留 Node 运行时）**：可做动态内容、可加 API route；但需常驻 Node 进程、占内存、成为一个需要监控和重启的部署单元。
- **B. Next.js SSG 静态导出**：构建期产出纯静态文件，nginx 直接提供。零运行时、零内存占用、无法宕机（除 nginx 本身）。
- **C. 纯手写静态站**（如根目录 `FengYibin66.github.io` 那种）：最轻，但 3D 场景与组件化开发离不开 React 工程体系。

## 决策

选 **B**。判定原则：**内容变更频率低于部署频率时，选静态**。

resume 的内容月级变更，而每次内容变更本来就要走一次构建部署——SSR 的动态能力在这里没有使用场景，却要付一个常驻进程的代价。静态化后 resume 从"一个需要监控的服务"降级为"一堆 nginx 托管的文件"，可用性上限直接等于 nginx。

## 影响

- 正面：无运行时故障面；无内存占用；CDN/nginx 缓存友好；部署 = 换一批文件。
- 负面：**任何动态需求都不能就地加 API route**——需要后端时必须调 portal 或另立服务。这条约束要写进 `apps/resume/AGENTS.md`，否则会被"就加一个 route 而已"绕过，一旦加了整站就得退回 SSR。
- 影响面：`apps/resume/next.config.js`（`output: 'export'`）、nginx 静态 location、`docker-compose.prod.yml` 中 resume 无 server 容器。
