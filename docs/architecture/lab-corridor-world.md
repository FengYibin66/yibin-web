# Lab 走廊的目标架构：走廊即世界状态

**日期**：2026-09-08
**性质**：描述性设计——"走廊想长成什么样"。有备选方案的选择列在 §8，落地前各自写 ADR。
**上游**：调研 `../research/2026-09-08-lab-liveliness.md`；活物 ADR `../adr/20260908160918-…`；活物规格 `../specs/lab-companions.md`。

---

## 0. 一句话

走廊要加的九件事（画出走廊的加载、时间线墙、招聘官路线、墨迹记忆、纸随风动、三扇窗三座城、会说话的头像、第二圈变化、手绘地图）加上活物，**都在读同一组量**：相机在导轨上的位置与速度、加载到哪了、去过哪儿、第几圈、几点了、系统要不要减少动效。今天这些量散在五个地方，且大半读不到：

| 量 | 今天住在哪 | 谁能读 |
|----|-----------|--------|
| 导轨 z / 速度 | `useCorridorCamera` 的 `currentZ` / `targetZ` ref | 只有它自己；外部只能读 `camera.position.z`，速度没人算 |
| 加载进度 | `useStableProgress`（drei `useProgress` 包装） | 只有 `LabLoader` |
| 去过哪儿 | `achievementStorage`（成就 id 列表） | 成就面板；空间信息（哪扇门）不存在 |
| 传送 / 在房间 | `SceneContext` 五个布尔 | 全部消费者重渲染 |
| 第几圈 | 不存在 | — |
| 当地时间 | 不存在 | — |
| 减少动效 | 不存在 | — |

所以架构上只做一件事：**让走廊拥有一个 domain 定义、app 持有、只有一个写者、按帧可读、按事件可订阅的世界状态**。九件事全是它的消费者。这与 auto-wechat 后端"domain 不感知传输与存储"是同一条纪律，与 ADR 20260903140616"共享状态用 zustand"同一方向，与 ADR 20260903211244"同一时刻只有一个写者"同一形态。

---

## 1. 分层落点

```
lib/lab/domain/corridor/
├── layout.ts          几何常量（已有）：段长、墙距、派生函数
├── landmarks.ts       【新】地标表：门 / 家具 / 壁画 / 窗 / 年份刻度 / 活物锚点 / 彩蛋，统一形状
├── world.ts           【新】CorridorWorld 类型 + 纯派生：segmentAt / lapAt / nearestDoor / yearAt / laneFor
├── ink.ts             【新】显形策略：inkLevel(landmark, world) = max(加载显形, 记忆显形, 悬停显形)
├── tour.ts            【新】路线声明 TOUR_STOPS + stepTour() 纯函数
├── speech.ts          【新】一行字规则：谁能说、冷却、同时只一个
├── worldClock.ts      【新】localHourIn(tz, now) / skyColorAt(hour)（纯函数）
├── companion.ts       活物 reducer（活物 ADR）
├── keyboard.ts / exploration.ts / assets.ts   （已有）
└── machines/corridor.machine.ts   （已有，零引用）→ 第 4 期接线为走廊模式机

lib/lab/app/
├── stores/corridorStore.ts   【新】zustand：世界状态的唯一运行时持有者
├── camera/corridorRail.ts    （已有）+ 【扩】scrollTo(z, {duration}) / hold() / release()
├── motion.ts                 【新】prefers-reduced-motion → motionScale
├── tour.ts                   【新】路线驱动器：读 TOUR_STOPS，向导轨下命令，被任何输入打断
└── memory.ts                 【新】持久化：visited / inked / lap（带版本号），取代成就存储里的空间信息

components/lab/
├── CorridorSegment.tsx       改为遍历 landmarks 渲染（不再手写门 / 家具 / 虫的坐标）
├── landmarks/                每种地标一个组件：Door / Mural / Furniture / Window / YearMark / …
├── companions/               Dog / ResidentCat
├── SpeechBubble.tsx          一行字（troika Text + fontForText）
└── LabScene.tsx              注入 motionScale；挂 Dog（跨段一只）
```

依赖方向不变：`domain` 不 import react / three / gsap / zustand；`app` 持有运行时状态并编排；组件只读 store、只渲染声明。

---

## 2. 世界状态（`corridorStore`）

### 2.1 形状（domain 定义，`world.ts`）

```ts
interface CorridorWorld {
  rail: { z: number; velocity: number }          // 每帧
  mode: 'free' | 'touring' | 'teleporting' | 'inRoom'
  loadProgress: number                             // 0–1，来自 loader
  lap: number                                      // 0 起，= segmentIndexAtZ(z)
  visited: ReadonlySet<LandmarkId>                 // 经过（进入触发半径）
  inked: ReadonlySet<LandmarkId>                   // 已显形（看过 / 进过）
  clock: { hour: number; tzHours: Record<CityId, number> }
  motionScale: 0 | 1
}
```

派生全是纯函数：`segmentAt(z)`、`lapAt(z)`、`nearestDoorAhead(z)`、`yearAt(z)`（时间线）、`laneFor(z)`（活物侧道）、`inkLevel(id, world)`。**组件里不出现 `Math.floor((10 - z) / 100)` 这类式子**——今天 `layout.ts` 已经立了这条规矩，世界状态把它扩到所有派生量。

### 2.2 两种写入节奏，一个写者

- **每帧量**（`rail.z / velocity`）：由 `useCorridorCamera` 在它的 `useFrame` 末尾调 `corridorStore.getState().setRail(z, v)`。这是 **transient 更新**：消费者在自己的 `useFrame` 里 `getState().rail` 读，不订阅、不重渲染。速度在这里算一次（`targetZ − currentZ` 的差分，EMA 0.2 平滑），全站只算一次。
- **离散量**（`mode / lap / visited / inked / loadProgress / clock / motionScale`）：正常 `set`，React 消费者用 selector 订阅（地图、成就、加载画面）。

**只有一个写者写 `rail`**：`useCorridorCamera`。AST 门禁 `railWriter.test.ts` 断言全仓只有它调用 `setRail`（形态同 `cameraOwnership`，无棘轮、全禁）。相机所有权规则**不变**：store 不写相机，它只是导轨状态的**镜像**；导轨依旧是相机的走廊持有者。

### 2.3 为什么是 zustand 而不是再加一个 Context

`SceneContext` 今天 35 个字段、任何一个变都让全部消费者重渲染，这正是 ADR 20260903140616 要替换它的原因；成就 `TICK` 100 ms 让 15 个 `DoorSection` 每秒渲染 10 次的事故（`AGENTS.md`「滚动卡顿」）就是 Context 形态的代价。zustand 已在依赖里（`audioStore`），selector 订阅 + `getState()` 读每帧量正是它的长处。**不迁移 `SceneContext` 里房间生命周期那部分**——那已经是 `room.machine`，好好的。

---

## 3. 地标表（`landmarks.ts`）

今天走廊里的东西各有一套坐标声明：`CORRIDOR_DOORS`、`CORRIDOR_FURNITURE`、`HERO_RELATIVE_Z`、`BUG_RELATIVE_Z`、`LAMP_LAYOUT`、`lib/lab/corridorMurals.ts` 的 `MURAL_KEEP_OUTS`（`layout.ts` 头部注释明说"暂未迁入"）。加窗、年份刻度、活物锚点、第二圈变体之后会变成十套。

统一成一张表：

```ts
type Landmark =
  | { kind: 'door'; id; relativeZ; side; roomId; textureType }
  | { kind: 'furniture'; id; relativeZ; side; variant: 'desk' | 'cabinet' | 'potted-tree' }
  | { kind: 'mural'; id; relativeZ; side; width }
  | { kind: 'window'; id; relativeZ; side; city: CityId }
  | { kind: 'year-mark'; id; relativeZ; side; year: number }
  | { kind: 'companion-anchor'; id; relativeZ; side; companion: 'cat' }
  | { kind: 'easter'; id; relativeZ; variant: 'bug' }
  | { kind: 'hero'; id; relativeZ }
// 公共字段：segments: 'all' | number[]（第 0 段专属 vs 每段都有）、inkable: boolean、visitRadius?: number
```

派生：`landmarksInSegment(i)`、`keepOuts()`（壁画避让，取代 `MURAL_KEEP_OUTS`）、`inkableIds()`、`visitTargets()`。zod schema：z 在段内、同侧同 z 不重叠、门与家具间距 ≥ 4、`segments` 引用合法、`inkable` 的必须有对应纹理（正反两向门禁，照 `roomRegistry.test.ts` 现有模式）。

`CorridorSegment` 从"手写一堆 JSX + 坐标"变成 `landmarksInSegment(i).map(render)`——与 `components/rooms/projects/AGENTS.md` 那句「加一块墙面装饰是往声明里加一项，不是往这里加 JSX」对齐。预载表生成器读地标表，纹理引用从此有单一来源。

**这是九件事里唯一的"重构"**，其余全是新增。它触及 `DoorSection` / `CorridorSegment` / `TeleportRoom` / `useCorridorCamera`（glance 读门表）/ `corridorMurals`。视觉零变化，靠 `roomRegistry.test.ts` 的几何断言与巡检截图对比守住。

---

## 4. 显形（墨迹）是跨切面策略（`ink.ts`）

`RevealMaterial`（`uProgress` 0→1 从下往上把草稿擦成上色）今天只有一个用途：门 hover。它是"加载时画出走廊"、"看过的永久上色"、"第二圈全上色"三件事的公共机制。定义一条策略而不是三个特例：

```
稳态（inkLevel）= max(
  world.inked.has(id) ? 1 : 0,          // 记忆：看过就永久
  lapInk(world.lap),                    // 圈数：第 2 圈起全 1
  hoverInk(id)                          // 悬停：瞬态，组件本地
)

过场（loadIntroInk，不进 inkLevel）：按地标 z 顺序依次 0→1，由加载动画自己驱动
```

> **加载显形为什么不在 `max` 里**（2026-09-08 实现时修正，ADR 20260908172231 索引已追加注记）：
> 加载进度在加载完成后**恒为 1**，并进 `max` 会让走廊里所有门永久上色 ——
> 「只有看过的才上色」直接失效，而那正是墨迹记忆的全部意义。加载显形是一段
> **过场表演**（纸撕开之前走廊被一笔笔画出来），演完退回稳态。

- 组件用一个 hook：`useInk(id)` 返回每帧的 `uProgress`（在 `useFrame` 里读 store、写材质，不经 React）。
- `inked` 何时置位：`visitTargets()` 的地标在相机进入 `visitRadius` 时 → `visited`；门被进入、壁画被 docked、猫被点 → `inked`。规则在 domain，触发在一个 `useVisitTracker`。
- 加载期显形有个前提：**走廊要在 loader 后面就渲染**。今天 `LabLoader` 是 `z-index 9999` 的纸盖着一切；改为纸只盖一半透明度、或撕开时机前移到 `progress > 0.3`，让"被画出来"看得见。这是产品决定（§8）。
- `RevealMaterial` 目前擦除方向固定从下往上；地板需要"沿 z 画线"。加一个 `uDirection` uniform（两种：`up` / `along-z`），不改 shader 的噪声边。

---

## 5. 导轨命令面扩展与走廊模式机

### 5.1 命令（`corridorRail.ts`）

今天只有 `jumpTo(z)`（传送）。加：

| 命令 | 语义 | 用途 |
|------|------|------|
| `scrollTo(z, { duration, ease })` | 目标 z 平滑过去，期间用户输入**仍然有效**（输入到达即取消） | 招聘官路线、"回到起点" |
| `hold(owner)` / `release(owner)` | 禁用滚轮 / 键盘 / 触摸对 `targetZ` 的写入，开发态断言同一时刻只一个 owner | 路线中的停留、活物登场那 0.8 s 不让玩家跑掉 |

导轨仍是唯一写相机的走廊持有者；命令只改它的 `targetZ`。**不新增相机写点**，棘轮不动。

### 5.2 模式机：接线 `corridor.machine`

`corridor.machine.ts` 定义了 `idle / teleporting(closing→placing→opening) / inRoom` 并且明确了 `teleporting.aborted` 边（审计 B1 的根治），但运行时零引用（ADR 20260903211338 登记为未接线债务）。招聘官路线是第四种模式 `touring`，且与传送、进房互斥（路线中点门 → 先退出路线再进房；传送中不能开始路线）。**互斥关系正是状态机的活**。方案：

- 给机器加 `touring` 状态：`idle --TOUR_START--> touring`，`touring --INPUT | TOUR_END | DOOR_CLICK--> idle`；进 `touring` 时 `rail.hold('tour')`，出时 `release`。
- `SceneContext` 的五个传送布尔替换为机器快照（这是 20260903140616 未兑现的那一半）。`data-lab-teleport-phase` 诊断属性改从机器读，E2E 不变。
- `world.mode` 由机器快照派生，store 订阅机器。

顺序上放第 4 期：在此之前的功能都不需要模式机；把它和路线一起接，接线有真实消费者，不会再出现"接了但没人用"。

---

## 6. 内容与时间线

时间线墙要"哪一年在哪儿做什么"。数据已经在 `lib/content/{en,zh}.ts` 的 `ExperienceItem` 与 `EducationEntry` 里，但 `period` 是字符串（`"2019 – 2021"`）、`location` 是自由文本。

- 加结构字段 `years: { start: number; end?: number }` 与 `cityId: CityId`（`CityId = 'london' | 'singapore' | 'beijing' | 'silicon-valley'`，与 tagline 同源）。`period` 字符串保留给 Classic 显示；门禁 `contentYears.test.ts` 断言二者一致（解析 `period` 得到的年份 == `years`），en/zh 同值。
- domain 的 `timeline.ts`：`yearAt(z)` 把走廊 z 映射到年份。映射是声明：`TIMELINE = { startYear: 2014, endYear: 2026, fromRelativeZ: -4, toRelativeZ: -90 }`，只在第 0 段。`year-mark` 地标由它派生生成（不手写 12 个）。
- 年份对应的经历 / 教育条目 → 墙面涂鸦（`sketch/` 流水线的 `SketchSpec`，文字按可用宽度反解字号）。内容在 `lib/content`，位置在 domain，画法在 sketch。三层各管一件事。

三扇窗（§1 的 `window` 地标）读 `worldClock.ts`：`localHourIn('Asia/Singapore', now)` 用 `Intl.DateTimeFormat`（纯函数，可注入 `now` 测试），`skyColorAt(hour)` 返回一组窗外天色（窗外允许有颜色，走廊内部仍是米色系——About 那次的教训是**房间**变蓝，窗外一小块不在此列，但这也是产品决定，§8）。`CorridorWindow.tsx` 零引用死代码正好复活为这个组件，或删掉重写，取其短。

---

## 7. 一行字（`speech.ts`）

发言者：头像、狗、猫（将来可加门牌）。规则是纯函数：同时只一个气泡；每个发言者冷却（头像 15 s、狗 10 s、猫 10 s）；优先级：用户触发（点猫）> 状态变化（狗到门口）> 闲聊（头像"往前滚滚看"）。文案键在 `labUi.speech.<speaker>.<key>`，en/zh 键一致（`labI18n` 自动覆盖）。渲染 `SpeechBubble`（troika `Text` + `fontForText`，与 `BugEaster` 的揭字同款），reduced 下照常出现（文字不是运动）。

---

## 8. 需要 ADR 的选择（各自成文，此处只列备选）

| # | 选择 | 备选 | 倾向 | 落地 |
|---|------|------|------|------|
| A | **走廊世界状态的持有形态** | zustand store（selector + transient）/ 扩 `SceneContext` / 模块级可变对象 + 事件 | zustand；理由 §2.3 | ADR 20260908172231 |
| B | **地标统一表** | 一张判别联合表 / 保持多张常量表 + 一个聚合视图 / 每种地标一个模块各自导出 | 一张表；理由 §3 | ADR 20260908172231 |
| C | **显形是策略还是特例** | `inkLevel` 统一策略 / 三处各写 | 统一策略；理由 §4 | ADR 20260908172231（公式修订见其索引注记） |
| D | **加载期让走廊可见** | 纸半透明 / 提前撕开 / 保持全遮（放弃"画出走廊"） | 提前撕开到 `progress > 0.3`，之后纸外沿继续显示进度 | 产品决定，规格 `docs/specs/lab-corridor-story.md` §1。**实现时修订**：走廊整个在一个 Suspense 边界里，30% 撕开后是空白；改为撕纸时 1.8 s 把门画出来（`uDraw`），撕开时机不变 |
| E | **模式互斥用状态机还是布尔** | 接线 `corridor.machine` 加 `touring` / 再加一个布尔 | 状态机；20260903211338 已决定"接线不删除"，这里只是加一个状态 | ADR 20260908204302 |
| F | **时间线映射** | 第 0 段 2014–2026 线性 / 每段一个时代 / 不做刻度只做涂鸦 | 第 0 段线性 | ADR 20260908204303（**年份改为 2017–2026**：简历最早条目是 2017；2014 是写本文时的误记） |
| G | **窗外有颜色** | 允许（窗外是"外面"）/ 全部米色系 | 允许，但饱和度压到与门贴纸同级；截图定 | 产品决定，规格 §3（伦敦 / 新加坡 / 北京，HSL S ≤ 0.35） |

活物（`20260908160918`）已单独成 ADR。A + B + C 合成了一份（`20260908172231`）；D/G 写进规格；E/F 各一份（`20260908204302` / `20260908204303`）。声音的「合成 vs 外部录音 vs 运行时合成」是写本文时没列出的第 H 项选择，见 `20260908204304`。

---

## 9. 门禁与测试（新增部分）

| 门禁 | 守什么 | 形态 |
|------|--------|------|
| `railWriter.test.ts` | 全仓只有 `useCorridorCamera` 调 `setRail` | AST，全禁 |
| `landmarks.test.ts` | schema；同侧不重叠；门距 ≥ 4；`inkable` ↔ 纹理存在（双向）；`segments` 合法；`keepOuts()` 与旧 `MURAL_KEEP_OUTS` 数值一致（迁移期） | vitest |
| `ink.test.ts` | `inkLevel` 单调：加载进度增 → 不降；`inked` 置位后恒 1；第 2 圈全 1 | 纯函数 |
| `tour.test.ts` | 每个 stop 引用真实门；任何输入事件 → 下一步是 `idle`；dwell 时间和 | 纯函数 |
| `speech.test.ts` | 冷却、互斥、优先级 | 纯函数 |
| `worldClock.test.ts` | 四个时区在给定 `now` 下的小时；跨日 | 纯函数，注入 now |
| `contentYears.test.ts` | `period` 解析 == `years`；en/zh 同值；`cityId` 合法 | vitest |
| `motionConsumers.test.ts` | `components/lab/**` 里每个含三角函数持续动画的 `useFrame` 都读 `motionScale`（棘轮：现有豁免名单只能减） | AST |
| `machineEventWiring`（已有） | `TOUR_START / TOUR_END / INPUT` 有发送方 | 自动覆盖 |
| E2E | 路线：点"带我走一遍"→ `data-lab-mode=touring` → 滚轮一下 → `free`；地图：未访问门有 `data-visited=false`；reduced：`data-lab-companion=sit` 恒定 | `lab.spec.ts` 模式 |
| 巡检 | `scripts/qa/lab-walkthrough.mjs` 每期扩步 | 人看 |

---

## 10. 分期（每期一个 PR 组，设计 PR 与实现 PR 分开）

| 期 | 内容 | 依赖 | 用户可见 | 状态 |
|----|------|------|----------|------|
| 0 基础 | `corridorStore` + 导轨发布 z/v；`motion.ts` 接入 Doodles / BugEaster；地标表重构（视觉零变化）；`lab-walkthrough.mjs` | ADR A+B+C | 无（reduced 用户除外） | ✅ PR #33 |
| 1 显形与记忆 | `ink.ts`；看过永久上色（`memory.ts`）；地图未访问问号 | 0 | 回访差异、地图 | ✅ PR #33；「加载期画出走廊」移到第 6 期 |
| 2 活物与说话 | 猫（PR #34）；狗、`speech.ts`、头像台词 | 0；活物 ADR | 走廊有人陪 | 🟡 猫已落地；狗素材改为仓库内 SVG 手写线稿（活物规格 §6） |
| 3 时间线与窗 | `years` 字段 + 门禁；年份刻度 + 便签；三扇窗 + 世界时钟；第二圈变体 | 1 | 走廊会讲履历 | ⬜ ADR 20260908204303，规格 story §2–§4 |
| 4 路线 | 接线 `corridor.machine` + `touring`；导轨 `scrollTo/hold`；"带我走一遍" | 0、1 | 60 秒看完 | ⬜ ADR 20260908204302，规格 story §5 |
| 5 声 | 脚步、爪音、叫声、气泡 | 2 | 听得见 | ⬜ ADR 20260908204304，规格 story §6 |
| 6 加载显形 | 决定 D（修订）：撕纸时门被画出来（`uDraw`）、`loadIntroInk` 接线、加载期独占导轨 | 1 | 加载体验 | ✅ 规格 story §1（含偏差说明） |

第 0 期是纯基础设施且视觉零变化，**它的验收是巡检截图与改前逐张一致**。之后每期都只是往声明里加东西、往 store 上挂消费者。

---

## 11. 不做的

- 不把 `room.machine` 与房间生命周期搬进 store——它已经对。
- 不引入物理、GLTF、后处理、instancing（活物 ADR）。
- 不做多人在线痕迹（Whispers 式留言）——等 console 后端（`platform-roadmap.md` 计划 B）。
- 不改 Classic。
