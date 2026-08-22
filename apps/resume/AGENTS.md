<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# apps/resume/

作品集站 `resume.yibinfeng.com`。Next.js 15 静态导出 + React Three Fiber 3D 场景。

> 上方 `nextjs-agent-rules` 块由工具自动注入维护，**不要手改块内内容**。项目约定写在本分隔线以下。

## 硬约束：纯静态，不能加运行时后端

`next.config.js` 是 `output: 'export'`，构建产物由 nginx 直接提供，**没有 Node 运行时**（ADR 20260822120803）。

因此：**不能在本应用内新增 API route、Server Action、或任何需要运行时的 Next.js 特性。** 需要后端时调 portal 的接口或另立服务。这不是风格偏好——加一个 route 就会让整站退回 SSR，从"一堆 nginx 托管的文件"变回"一个需要监控和重启的服务"。

## 结构

```
app/                     # Next.js App Router（路由与页面）
├── page.tsx             # 入口
├── classic/             # Classic 简历视图
├── lab/                 # Lab 3D 视图
└── gallery/             # 画廊（独立路由，绕过 R3F 房间挂载流程）
components/              # 组件（99 文件）
├── canvas/ entry/ layout/ providers/ ui/
├── classic/ lab/ rooms/ sections/
└── gallery/
lib/                     # 纯逻辑与数据
├── content/             # 简历内容数据
├── scene/ lab/ animations/ gallery/
context/                 # React Context（Scene / Audio / Performance / Achievements）
hooks/                   # 通用 hooks
__tests__/               # vitest（31 个）
```

**`features/` 不是本应用的分层，git 里不存在它。** `git ls-files` 无任何 `apps/resume/features/` 条目——本地若看到 `features/lab/` 下 8 个空子目录（experience / context / loading / corridor / hooks / shaders / dom），那是从未落地的骨架残留（空目录不入 git，所以只在工作副本里）。清理：`rm -r apps/resume/features`。

`lab` 的真实实现在 `components/lab/`（视图）与 `lib/lab/`（逻辑）两处。**不要往 `features/` 加代码，也不要重建它**——若确需第三个落点，先说明为什么现有两处不够。

## 已知未修项（P1，来自验收报告）

`docs/reviews/2026-07-12-resume-lab-room-audit.md` 的四条 P1 至今未修。动到相关文件时留意：

| 位置 | 问题 |
|------|------|
| `components/rooms/ProjectsRoom.tsx:105` | 独立 GSAP camera tween 与 `DoorSection` 争抢 `camera.position` 写入权，未持有所有权也未在 cleanup 中 kill |
| `components/rooms/ProjectsRoom.tsx:259-301` | 每个 `MonitorBlock` 无条件声明 monitor/TV/phone 三类共 26 个纹理 loader，即使只用其中一种 |
| `app/gallery/` | 缺 `loading.tsx`，且动态 import 无 fallback UI，首次进入会白屏 |
| `components/rooms/ContactRoom.tsx:156` | MESSAGE 桶 `onClick={() => {}}` 空交互，有可点击视觉但无动作 |

**相机所有权**：房间转场的 `camera.position` 动画由 `DoorSection` 统一编排。房间组件只应提供目标 pose，不要自行起 tween——上面第一条就是违反这条的后果。

## 测试环境的两个坑（都栽过）

**1. 渲染任何读 locale 的组件必须包 `LocaleProvider`。**

`LocaleContext` 的默认值是一个**访问即抛异常**的对象（`components/providers/LocaleProvider.tsx` 的 `throwingDefault`），设计意图是让"忘了包 Provider"立刻失败而不是静默拿到错误语言。代价是测试里直接 `render(<组件 />)` 会炸。写法：

```tsx
import { LocaleProvider } from '@/components/providers/LocaleProvider'

render(<PublicationCard {...props} />, { wrapper: LocaleProvider })
// rerender 会自动继承 wrapper，不用重复传
```

`publicationCard.test.tsx` 与 `projectsRoomCamera.test.tsx` 曾因缺这个 wrapper 共 16 个测试全红。

**2. `localStorage` 在本项目的测试环境需要 stub，已在 `vitest.setup.ts` 处理。**

Node 25 内置了一个实验性 `localStorage` 全局，未带 `--localstorage-file` 启动时一经访问就抛 `SecurityError`，且它盖过了 vitest jsdom 环境提供的实现。`LocaleProvider` 的 `useEffect` 读 `resume-locale` 正好命中。`vitest.setup.ts` 装了内存实现顶掉它——**不要删那段**，删了所有碰 storage 的组件测试会一起红。

这两条合起来是同一个教训：**CI 从不跑测试期间，main 分支的 16 个失败一直没人发现**。现在 `ci.yml` 会跑，保持它绿。

## 命令

```bash
pnpm dev:resume          # 从仓库根起（:3000）
cd apps/resume
pnpm test                # vitest run —— 当前 443 个全绿
pnpm type-check          # tsc --noEmit
pnpm build               # 静态导出到 out/
```

> `pnpm lint` **当前跑不起来**：`eslint.config.mjs` 按 flat config 写，但装的
> `eslint-config-next@15.5.20` 导出的是旧版 eslintrc 对象 → `nextVitals is not iterable`。
> 这是依赖版本不匹配，从未跑通过，CI 刻意不跑（见根 `CLAUDE.md`「已知负债」）。
> 要修先写 ADR：升 `eslint-config-next`，或把配置改回 eslintrc 形态。
