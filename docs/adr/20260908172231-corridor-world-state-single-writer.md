# 20260908172231. 走廊有一个世界状态：domain 定义、zustand 持有、单写者、每帧量瞬态读；地标收成一张表；显形是策略不是特例

- 状态：已接受
- 索引：resume 的 Lab 走廊新增一个**世界状态** `lib/lab/app/stores/corridorStore`（zustand）：每帧量（导轨 z 与速度）由 `useCorridorCamera` 独家写入并以瞬态方式被消费（`getState()`，不触发 React 渲染），离散量（模式、圈数、加载进度、去过 / 已显形、动效开关）用 selector 订阅；AST 门禁 `railWriter.test.ts` 全禁第二个写者。配套两项：门 / 家具 / 壁画 / 窗 / 年份刻度 / 活物锚点 / 彩蛋收成**一张判别联合地标表**（吸收 `layout.ts` 头部登记「暂未迁入」的 `MURAL_KEEP_OUTS`），`CorridorSegment` 改为遍历声明渲染；`RevealMaterial` 的显形从「门 hover 特例」提升为**跨切面策略**。判定原则：**同一个量只有一个来源、一个写者；一个机制服务多个特性时，它属于 domain 而不属于某个组件**。注记（2026-09-08 实现时自我修订）：本文正文把显形公式写成 `max(加载, 记忆, 圈数, 悬停)`，**那一项「加载」是错的**——加载进度在加载完成后恒为 1，`max` 会让走廊里所有门永久上色，「只有看过的才上色」这个效果直接失效。实际实现为 `inkLevel = max(记忆, 圈数, 悬停)`（稳态），加载显形是一段**过场表演**、单独导出 `loadIntroInk` 由加载动画自己驱动、不进 `inkLevel`（已定义、未接线）。「显形是一条策略而不是三处各写」这个**结论不变**。注记（2026-09-08 产品评审后）：「圈数 ≥ 1 → 1」改为「→ LAP_INK = 0.55」（已访问仍为 1）——全部上色会抹掉「哪些看过」的记忆，且与顶栏「已探索 N / M」互相否证；「显形是一条策略」的结论不变
- 日期：2026-09-08

## 背景

`docs/architecture/lab-corridor-world.md` 记录了走廊要加的九件事（加载时把走廊「画出来」、时间线墙、招聘官路线、墨迹记忆、纸随风动、三扇窗三座城、会说话的头像、第二圈变化、手绘地图）以及活物（ADR 20260908160918）。它们读的是同一组量，而这组量今天散在五处、且大半读不到：

| 量 | 今天在哪 | 谁能读 |
|----|---------|--------|
| 导轨 z | `useCorridorCamera` 的 `currentZ` ref | 外部只能读 `camera.position.z` |
| 导轨速度 | **不存在**（没人算） | — |
| 加载进度 | `useStableProgress` | 只有 `LabLoader` |
| 去过哪扇门 | **不存在**（成就只记 id，没有空间信息） | — |
| 第几圈 | **不存在** | — |
| 当地时间 | **不存在** | — |
| 是否减少动效 | **Lab 完全没有**（全仓 5 处命中全在 Classic 与加载指示器） | — |

不决策会发生什么：九件事各自去 `useCorridorCamera` 里加一个 ref、各自往组件里塞 `Math.floor((10 - z) / 100)`、各自 `localStorage.getItem`。走廊几何在 `layout.ts` 统一之前正是这个样子——同一组门的 Z 写在四处、段号计算写在三处（其中一处是裸 `/ 100`），改一个门位要同步改四到七处、漏改不报错。世界状态若不统一，会以更大的规模重演一次。

三件事必须一起决定，因为互相依赖：显形要读世界状态（加载进度、圈数），记忆要按**地标 id** 存（没有统一的 id 就没有记忆），地标表的消费者又要读世界状态决定怎么画。

## 选项

### A. 世界状态的持有形态

- **A1. zustand store**（每帧量 `getState()` 瞬态读 + 离散量 selector 订阅）：zustand 已在依赖里（`lib/lab/app/stores/audioStore.ts`），是 ADR 20260903140616 定的方向；瞬态读天然避开重渲染；selector 让「地图只在 visited 变化时重渲染」成立。代价是多一个状态容器，要靠门禁保证单写者。
- **A2. 扩 `SceneContext`**：不加新概念。但它已有 35 个字段，任何一个变都让全部消费者重渲染——成就 `TICK`（100 ms）让 15 个 `DoorSection` 每秒渲染 10 次那次事故就是这个形态的代价（`apps/resume/AGENTS.md`「滚动卡顿」）。把每帧量放进 Context 等于每帧全树重渲染，不可行。
- **A3. 模块级可变对象 + 事件订阅**：零依赖、瞬态读最快（`escapeStack` / `corridorRail` 就是这个形态）。但离散量的 React 订阅要自己实现（`useSyncExternalStore` + 手写 selector 比较），而那正是 zustand 已经做好的部分。

### B. 地标声明

- **B1. 一张判别联合表**（`kind` 区分门 / 家具 / 壁画 / 窗 / 年份刻度 / 活物锚点 / 彩蛋 / 欢迎区）：单一来源；`landmarksInSegment(i)` 一次派生；zod 一处校验；预载表生成器一处读取；`CorridorSegment` 变成遍历。代价是一次重构，触及 5 个文件，且视觉必须零变化。
- **B2. 保持多张常量表 + 一个聚合视图**：改动最小。但「同一侧两个地标不重叠」这类跨类型约束没有地方表达，`MURAL_KEEP_OUTS` 也仍然是第二套坐标真相——`layout.ts` 头部已经把它登记为待迁入的技术债。
- **B3. 每种地标一个模块各自导出**：类型最干净。但要在第三处把它们聚合起来才能校验与渲染，等于 B1 加一层间接。

### C. 显形（`RevealMaterial` 的 `uProgress`）

- **C1. 一条策略函数** `inkLevel(id, world) = max(加载, 记忆, 圈数, 悬停)`：四个来源互不知道彼此；新增来源是加一项 `max`；单调性可测（进度增不降、记住后恒 1）。
- **C2. 三处各写**：门组件自己判 hover、加载画面自己驱动一批、圈数再加一个分支。三处都要知道「别人是不是也在写这个 uniform」，而 `uProgress` 只有一个——先写后写互相覆盖，表现为闪烁，且没有任何测试能守住。

## 决策

**A1 + B1 + C1。**

- 世界状态住 `lib/lab/app/stores/corridorStore.ts`，形状与派生函数在 `lib/lab/domain/corridor/world.ts`（纯）。**每帧量只有 `useCorridorCamera` 写**（它已经是走廊相机的持有者，导轨状态本来就归它），AST 门禁 `railWriter.test.ts` 断言全仓只有它调 `setRail`，无棘轮、全禁。**store 不写相机**——它是导轨状态的镜像，相机所有权规则（ADR 20260903211244）完全不变，写点棘轮不动。
- 地标一张表 `lib/lab/domain/corridor/landmarks.ts`，`CORRIDOR_DOORS` / `CORRIDOR_FURNITURE` / `HERO_RELATIVE_Z` / `BUG_RELATIVE_Z` 由它派生（保留旧导出名以免一次改动过大），`MURAL_KEEP_OUTS` 迁入。
- 显形策略 `lib/lab/domain/corridor/ink.ts`，组件经 `useInk(id)` 在 `useFrame` 里读 store、写材质，不经 React。

**判定原则**：*同一个量只有一个来源、一个写者；一个机制服务多个特性时，它属于 domain 而不属于某个组件。* 前半句是 `layout.ts` 那次教训的推广（四处门坐标 → 一处），后半句是 `RevealMaterial` 从组件私有变成公共策略的理由。以后再有「给走廊加个 X」的提议，先问这两句。

**为什么现在做而不是等第一个特性**：第 0 期视觉零变化、无用户可见收益，看起来可以推迟。但九件事里任意一件先落地，都会各自建一套读法，之后再统一就要改两遍——ADR 20260903211338 记录的「已定义未接线」正是反向的同一类损失（先建后接，中间的文档全是错的）。基础设施先行的代价是可测的（一次重构 + 巡检对比），后行的代价是不可测的。

## 影响

- 正面：九件事都变成「往声明里加一项 + 挂一个消费者」；速度这个量全站只算一次；Lab 首次有 `prefers-reduced-motion`；`MURAL_KEEP_OUTS` 的技术债清掉；地图能显示「哪些没去过」这类空间信息。
- 负面：多一个状态容器（要靠门禁维持单写者）；地标重构触及 `CorridorSegment` / `DoorSection` / `corridorMurals` / `useCorridorCamera`（glance 读门表）/ 预载表生成器，视觉零变化必须靠巡检截图逐张对比证明，而不是靠断言；`RevealMaterial` 加一个 `uDirection` uniform（地板要沿 z 画线，不是从下往上擦）。
- 影响面：
  - 新增 `domain/corridor/{world,landmarks,ink}.ts`、`domain/corridor/memory.ts` 的纯部分、`app/stores/corridorStore.ts`、`app/motion.ts`、`app/memory.ts`、`hooks/useInk.ts`、`hooks/useVisitTracker.ts`
  - 改 `domain/corridor/layout.ts`（改为从地标表派生）、`lib/lab/corridorMurals.ts`、`components/lab/CorridorSegment.tsx`、`hooks/useCorridorCamera.ts`（末尾发布 rail）、`components/lab/{Doodles,BugEaster}.tsx`（接 `motionScale`）、`components/ui/NavigationUI.tsx`（地图标未访问）
  - 新增门禁 `railWriter` / `landmarks` / `ink` / `motionConsumers`；新增 `scripts/qa/lab-walkthrough.mjs`
  - 分期与后续见 `docs/architecture/lab-corridor-world.md` §10

## 与既有 ADR 的关系

- [20260903140616](./20260903140616-lab-xstate-and-zustand-replace-context.md)（XState + zustand 取代 Context）：**沿用其方向**。本 ADR 是它「共享状态用 zustand」那一半在走廊侧的落地；房间生命周期仍归 `room.machine`，不动。`corridor.machine` 的接线仍未做，计划在招聘官路线那一期（架构文档 §5.2），届时另写 ADR。
- [20260903211244](./20260903211244-lab-camera-owner-is-explicit-not-suspended-flag.md)（相机所有权显式）：**不变且不受影响**。store 不写相机；导轨仍是走廊侧的相机持有者。
- [20260903140615](./20260903140615-lab-room-registry-and-derived-assets.md)（声明驱动、预载表派生）：**同一纪律扩到走廊**。地标表之于走廊 = 房间注册表之于房间。
- [20260908160918](./20260908160918-lab-companions-are-paper-puppets-on-the-rail.md)（活物是纸偶 + 纯函数）：活物的 `companion-anchor` 是地标表的一种 kind，`motionScale` 由本 ADR 引入的 `app/motion.ts` 提供。
