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
components/              # 组件
├── canvas/ entry/ layout/ providers/ ui/
├── classic/ lab/ rooms/ sections/
│   └── rooms/projects/  # 「深夜实验室」（ADR 20260903140619）
└── gallery/
lib/
├── content/             # 简历内容数据
├── lab/
│   ├── domain/          # 纯声明：房间、走廊、音频、状态图、手写层
│   │   ├── rooms/       # RoomDefinition（含 projects/scene.ts 空间声明）
│   │   ├── machines/    # XState 状态图
│   │   ├── sketch/      # 手写层的类型与 plan（纯函数）
│   │   └── audio/       # 音频清单
│   ├── app/             # 编排：相机所有者、音频混音器、store、ESC 消费栈
│   │   ├── camera/      # CameraDirector —— 唯一能写相机的地方
│   │   ├── audio/       # AudioMixer（howler）
│   │   └── assets/      # manifest.gen.ts（派生生成物，勿手改）
│   └── infra/           # 外部依赖实现（roughjs 栅格化、纹理缓存）
├── scene/ animations/ gallery/
media-src/               # 原始素材，**不部署**（见该目录的 AGENTS.md）
context/                 # React Context（Scene / Performance / Achievements）
hooks/                   # 通用 hooks
scripts/
├── lab/                 # 预载表生成器
└── media/               # 四条素材流水线：音频 / 门贴纸 / 纹理 / 字体子集
                         # 都支持 --check，CI 会跑（见 media-src/AGENTS.md）
__tests__/               # vitest
```

分层方向单向朝内：`domain` 不感知 React / three / DOM，`app` 编排，`infra`
实现外部依赖。与 `auto-wechat/backend` 同一套（见根 CLAUDE.md「分层」）。

**`features/` 不是本应用的分层，git 里不存在它。** `git ls-files` 无任何 `apps/resume/features/` 条目——本地若看到 `features/lab/` 下 8 个空子目录（experience / context / loading / corridor / hooks / shaders / dom），那是从未落地的骨架残留（空目录不入 git，所以只在工作副本里）。清理：`rm -r apps/resume/features`。

`lab` 的真实实现在 `components/lab/`（视图）与 `lib/lab/`（逻辑）两处。**不要往 `features/` 加代码，也不要重建它**——若确需第三个落点，先说明为什么现有两处不够。

## 当前有效的验收报告与目标架构

**当前有效**：`docs/reviews/2026-09-02-resume-lab-full-audit.md` —— 全部 147 个源文件逐个通读 + 实机截图，63 条问题（16 P1 / 31 P2 / 15 P3 / 1 ARCH）、六个根因模式、六项已定稿的产品决定。

`docs/reviews/2026-07-12-resume-lab-room-audit.md` **已被它取代**（头部有前向指针），不要再以旧报告下结论。旧报告 4 条 P1 中 3 条已修，第 4 条（26 个纹理 loader）并入下表的 ADR 20260903140619。

### 现状 ≠ 目标

六步已全部实施，但**不是每一份 ADR 都完全落地**——下表的「取代的现状」列
记的是实际状态。改动前先看清那一栏。

### 落地状态（读之前先读这一段）

**「已定义、未接线」不算落地。** 2026-09-03 的四份独立 review 查出：三份 ADR 的主体
（房间注册表的消费路径、`room`/`corridor` 状态图、派生预载表）代码写了、测试绿了，
**但运行时从没引用过它们**，而这张表上一版把它们写成「已落地 / 已用」。后果不是「文档不整洁」，
而是下一个人会相信 About/Contact 的取景由 `entryPose` 驱动、房间生命周期由状态图保护，
然后基于错误前提往上叠设计——根 CLAUDE.md 用 libSQL 被写成 MySQL 那次事故举的正是这个例子。

判断落地的操作性标准，改动这张表时照着做：

```bash
grep -rl <模块> app components context hooks lib   # 有非测试命中才算接线
```

接线计划见 ADR [20260903211338](../../docs/adr/20260903211338-finish-wiring-lab-registry-and-machines.md)。

| ADR | 目标 | 实际状态 |
|-----|------|-----------|
| [20260903140615](../../docs/adr/20260903140615-lab-room-registry-and-derived-assets.md) | 房间由 `lib/lab/domain/rooms/` 的 `RoomDefinition` 声明；预载表是**派生生成物** | **部分落地**：注册表已定义且门坐标已是单一来源；但 `view` / `tutorial` **零消费者**（`RoomInterior` 仍是硬编码 `switch`，四个房间各自硬编码教程 id），`entryPose` / `cameraFreedom` **只有 Projects 消费**（所以 ADR 说的「A1/A3 由 entryPose 修复」运行时不成立），`manifest.gen.ts` **唯一引用者是生成它的脚本自己**（运行时仍 import 手写的 `roomAssets.ts` / `texturePreload.ts`，两份已漂移，首屏壁画仍是 3 段 = 审计 G1 未修），`roomId === 'gallery'` 特例仍在 7 处，生成物**未**加入 hook 保护名单 |
| [20260903140616](../../docs/adr/20260903140616-lab-xstate-and-zustand-replace-context.md) | 生命周期用 XState 状态图；共享状态用 zustand | **部分落地**：音频 store（zustand）与成就队列 reducer 已接线；三台状态图**只有 `dockMachine` 接线了**（且只有 Projects 用，Publications 仍用 `publicationMotionMachine`），`room.machine` / `corridor.machine` 运行时零引用——`labMachines.test.ts` 守的是死代码，其中为审计 A8 加的 `entered → failed` 边**运行时不存在**，A8 未修。`@xstate/graph` 装了没用 |
| [20260903140617](../../docs/adr/20260903140617-lab-single-camera-owner.md) | **只有 `lib/lab/app/camera/CameraDirector` 能写相机**，底层 `camera-controls`；手势用 `@use-gesture` | **部分落地，且所有权形态已被 [20260903211244](../../docs/adr/20260903211244-lab-camera-owner-is-explicit-not-suspended-flag.md) 修订**：`suspended` 布尔让三处出错——进房时导演与 DoorSection 的 gsap **同帧双写约 2 秒**（靠 rAF 顺序侥幸不出事）、传送的 `moveToWorld({duration:0})` 在挂起态是**空操作**、About 的 `setLean` 是**死代码**。手势未迁移，`@use-gesture` 未安装 |
| [20260903140618](../../docs/adr/20260903140618-lab-audio-howler-mixer.md) | 单一 `AudioMixer`（howler + spatial），三条总线 | **已落地**：四套实现收成一套，环境音重编码 6.8MB → 1.7MB。这是五份里唯一完整落地的 |
| [20260903140619](../../docs/adr/20260903140619-lab-external-assets-and-runtime-sketch.md) | 外部素材许可记录 + Rough.js 运行时草图；Projects 重做 | **部分落地**：手写层（roughjs）+ Projects 重做 + 平台隐喻已去 + Gallery 门贴纸已换。许可记录（`public/CREDITS.md`）当时**未创建**，已补；ADR 表里列的 Doodle Icons / Open Doodles / freesound / Excalidraw **实际一个都没用**，出入见 `public/CREDITS.md` 文末 |

### 源码门禁：一个 AST 扫描器，三条规则

三条门禁（相机所有权、Lab 漏译、覆盖层对比度）共用
`__tests__/helpers/sourceScan.ts`——基于 `typescript` 编译器 API，提供
`cameraWrites` / `userStrings` / `colorLiterals` 三个查询。决策与理由见 ADR
[20260903211320](../../docs/adr/20260903211320-source-gates-use-ts-ast-not-regex.md)。

**为什么不是正则。** 第一版三条都是 grep + 手写字符串剥离器，独立 review 构造
20 个绕过形态**活了 10 个**：`camera.rotation.set(`（`DoorSection.tsx` 眼下在用、
白名单注释里也登记过的写法）、`position.setZ(`、`rotateX(`、
`gsap.to(camera.rotation`、别名 `const cam = camera` 全不认；一个 JSX 里的
`Don't` 撇号或一条含 `//` 的 URL 就能吞掉同文件后面所有代码；漏译那条要求
「2 个以上单词」，于是 `Back` / `Skip` / `Mute` 全溜过去、门禁报告「无漏译」而
截图满屏英文；对比度那条只认 `rgba()`，`#hex` 与 `opacity` 的二次衰减都看不见。

**三条共同的形态是棘轮，不是布尔。**

| 门禁 | 棘轮 | 当前基线 |
|------|------|---------|
| `cameraOwnership.test.ts` | `{ 文件: 期望写点数 }` | 8 文件 / 34 写点 |
| `labI18n.test.ts` | `KNOWN_LEAKS`（按文件记漏译条数） | 10 文件 / 20 条 |
| `labContrast.test.ts` | `KNOWN_LOW_CONTRAST`（同上） | 4 文件 / 9 条 |

数字只能往下：写点变少了要把数字改小（有一条断言专门管这个），否则棘轮留一截
空档，下一个人可以在不触发红灯的情况下加回去。文件级白名单的漏洞正是这个
——已在名单里的文件再加 20 个写点也是绿的。

**验收标准在 `__tests__/gateMutations.test.ts`**：那 20 个变异形态固化成清单，
每条标明当年是被杀还是存活。这份清单只能增不能删——删一条就是把一个已知的
绕过形态重新变成盲区。

**扫描器的已知边界**（写在这里以免被当成已覆盖）：别名只追一层；CSS module 里
的颜色与祖先节点的 `opacity` 看不到（`RoomLoadingIndicator` 的错误详情就落在
这个盲区，实算约 2.5 而门禁测得 0 条）；Tailwind 的透明度工具类看不到；
`app/` 下页面的文案与 `<head>` metadata 不在漏译门禁范围内。各条的理由写在
`labContrast.test.ts` 顶部与 `sourceScan.ts` 的文档注释里。

四个踩过的坑，改这块前先读：

1. **`entryPose` 是门坐标系**：原点在门平面、**+Z 指向门外**，所以房间内的
   一切都是负 z。房间自己的内容用「桌心坐标系」，两者差一个 `ROOM_ORIGIN_Z`
   （见 `domain/rooms/projects/scene.ts` 顶部）。混用这两个系就是审计 A4。
2. **位姿锚定在房间根上**：`enterRoom` 换算一次不够——门板与走廊段落在进房
   之后还会动，房间内容整体移动而相机留在旧世界坐标上。`followAnchor()`
   每帧按房间根矩阵的增量同步。
3. **所有权靠一个布尔 `suspended`，而这是个设计缺陷**：`controls.update()` 每帧
   都把内部位姿写回相机（`enabled` 只关输入），所以 director 默认挂起。问题是
   「此刻谁在写相机」成了隐式运行时状态，且**在挂起态调用动作方法不报错也不生效**
   ——已经造成三条缺陷：进房时导演与 DoorSection 的 gsap 同帧双写约 2 秒
   （今天靠 rAF 注册顺序侥幸看起来正常）、`moveToWorld({duration:0})` 传送是空操作
   （`push()` 只写 controls 内部状态，要 `update()` 才应用）、About 的 `setLean`
   永不生效。改为显式 `claim()` / `release()` 的决策见 ADR
   [20260903211244](../../docs/adr/20260903211244-lab-camera-owner-is-explicit-not-suspended-flag.md)。
4. **不要用内部 `snapshot()` 断言相机行为**：`cameraDirector.test.ts` 就是这么漏掉
   传送失效的——`snapshot()` 是导演记的目标位姿，不是相机的实际位姿。断言对象必须是
   `camera.position`。

### 入口页的两条路径

手机端（`pointer: coarse` **且**宽度 ≤ 768）不挂 Canvas：`EntryStage` 渲染
54 KB 的静态首帧，点了播 CSS 开门动画再跳 `/lab`。实测手机端下载量
3871 → 856 KB。桌面端不变（canvas 在 592ms 就出现，多一张占位图不值）。

两个条件都要：只看宽度会让拖窄的桌面窗口掉进静态路径，只看 pointer 会让
iPad 横屏掉进去。**Lab 本身仍是完整的 3D，没有砍任何东西**——降级的只是
"预览那扇门"。

静态首帧是生成物（`scripts/media/entry-firstframe.mjs`，需要已构建的
`out/`）。它不存在时手机端是一块空白，而那条路径在桌面开发时看不到，
所以 CI 会 `--check`。

### ESC 的优先级

ESC 已绑定「退出房间」。房间内的细节视图（Projects 的停靠）用
`lib/lab/app/escapeStack` 认领它——栈顶（最内层）先消费。自己挂 window
监听会让两者同时触发，房间退场把收回打断。

**加载态**：`ssr: false` 的 dynamic import **必须**配 `loading`。缺它时 chunk 到位前整页只剩背景色；而路由级导航还要额外的 `loading.tsx`——两个时机不同，只补一个仍会白屏。

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

## E2E（Playwright）

`e2e/` 下 78 个用例（39 条 spec × chromium / mobile-safari 两个形态），全部集中在
`staticExport.spec.ts` 一个文件里。

**覆盖缺口：E2E 完全不进 Lab。** `/lab` 只断言了返回 200，进房 / 退房 / 传送 / ESC
一条都没有。ADR [20260903211338](../../docs/adr/20260903211338-finish-wiring-lab-registry-and-machines.md)
把补这批 E2E 列为状态图接线的**前置条件**——没有它，那次改动的回归无从发现。

**打在静态产物 `out/` 上，不打 `next dev`。** 这是刻意的：生产由 nginx 直接提供 `out/`，而 `next dev` 有 HMR、按需编译、不同的路由解析——测它测不到真实部署形态，尤其是 `trailingSlash: true` 的 `dir/index.html` 结构（`next.config.js` 的注释记着一次真实故障：`/gallery` 直接访问返回 403）。

`e2e/staticServer.mjs` 是手写的极简静态服务器，**刻意不做 SPA fallback**——找不到就 404。现成 dev server 的自动兜底会把"页面根本没导出"掩盖成"页面正常"。

```bash
pnpm build               # 必须先构建，E2E 打的是产物
pnpm test:e2e            # 全部形态
pnpm test:e2e --project=chromium   # 只跑一个形态
pnpm test:e2e:ui         # 带 UI 调试
pnpm exec playwright install chromium webkit   # 首次需装浏览器
```

写 E2E 时的两条经验（都踩过）：

- **选择器用 `aria-label` 等可访问性属性**，别用 class。本项目 class 是 Tailwind 生成的长串，一改样式就断。
- **断言要基于真实机制，别照直觉猜**。主题不是改 `body` 的 backgroundColor（那是透明的），而是 `<html data-theme>`；且深色是"属性缺失"而非 `data-theme="dark"`——详见 `e2e/staticExport.spec.ts` 主题那一节的注释。

## 命令

```bash
pnpm dev:resume          # 从仓库根起（:3000）
cd apps/resume
pnpm test                # vitest run
pnpm type-check          # tsc --noEmit
pnpm build               # 静态导出到 out/

# 素材流水线（改了 media-src/ 下的源才需要跑；--check 只报告）
node scripts/lab/gen-asset-manifest.mjs      # 纹理预载表（派生生成物）
node scripts/media/encode-audio.mjs          # 音频重编码
node scripts/media/gallery-door.mjs          # Gallery 门贴纸
node scripts/media/optimize-textures.mjs     # 入口页纹理
python3 scripts/media/subset-fonts.py        # 字体子集 + woff2
pnpm build && node scripts/media/entry-firstframe.mjs   # 手机端入口的静态首帧
```

> `entry-firstframe.mjs` 需要**已构建的 `out/`** ——它是截图，构图来自 3D
> 场景，拼贴拼不出同一个画面。

> `pnpm lint` **当前跑不起来**：`eslint.config.mjs` 按 flat config 写，但装的
> `eslint-config-next@15.5.20` 导出的是旧版 eslintrc 对象 → `nextVitals is not iterable`。
> 这是依赖版本不匹配，从未跑通过，CI 刻意不跑（见根 `CLAUDE.md`「已知负债」）。
> 要修先写 ADR：升 `eslint-config-next`，或把配置改回 eslintrc 形态。
