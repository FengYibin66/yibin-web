# 20260903140616. Lab 生命周期改用 XState 状态图，共享状态改用 zustand，替换手写 reducer 与 Context

- 状态：提议
- 索引：resume 的 Lab 用 XState v5 表达走廊/房间/停靠三条生命周期（失败边与超时是状态图的一等公民，`@xstate/graph` 生成全路径测试），共享状态从 35 字段的 `SceneContext` 迁到 zustand（selector 订阅 + persist 中间件）；替换 `doorEntryFlow` / `roomLoadMachine` / `publicationMotionMachine` 三套手写 reducer
- 日期：2026-09-03

## 背景

Lab 现有三套手写状态机，写法一致、质量不差，但都只表达了成功路径：

- `lib/lab/roomLoadMachine.ts`：非法转移**抛异常**，调用方 `tryAdvanceDoorEntryFlow` 用 `try/catch` 把异常翻译成 `null`。于是「非法转移」与「守卫拒绝」在调用点无法区分。
- 传送流程（`SceneContext` 的 `teleportTarget/isTeleporting/teleportPhase/isFastTeleport/pendingDoorClick` 五个布尔与枚举互相约束）**没有失败出口**：`cancelTeleport` 全仓零调用方，房间加载超时后 `isTeleporting` 永远为 true，合上的纸（z-index 9998）永久遮住屏幕，错误卡（z-index 30）在纸下面看不见，导航全部禁用，用户只能刷新（审计 B1，实机复现）。
- 房间进入后发生运行时错误时，`RoomErrorBoundary` 渲染 null、房间消失，但状态仍是 `entered`，没有任何提示（审计 A8）——因为 `handleRoomError` 只在 `loading` 阶段派发。
- 8 秒加载超时是手写 `setTimeout` + 三个 ref（`loadTimeoutRef` / `openingAttemptRef` / `ownedEntryRef`）互相看护，`useDoorEntryOrchestrator` 有 5 个 effect 专门维护这套 ref 的一致性。

`SceneContext` 侧：一个 35 字段的 `useMemo`，任何字段变化（包括每帧可能变的 `roomLoadState`）触发全部消费者重渲染；且它是 React Context，`/gallery` 独立路由在 Provider 之外，导致 `gallery_inspect` 成就的唯一解锁路径落在一个**零渲染方**的组件里，成就永远解不开（审计 D1）。三处 localStorage 读写（成就、音频偏好、教程）各自手写 try/catch。

不决策会发生什么：这三套 reducer 每次扩展都要人工推演「还有哪条边没写」，而漏掉的边不会被任何测试发现——B1 与 A8 就是两条漏掉的边，各自导致一个「只能刷新」级别的故障。

## 选项

- **A. 保持手写 reducer，逐条补边。** 优点：零依赖、零学习成本、现有 4 个测试文件继续有效。缺点：补边靠人工推演，没有工具能告诉你还缺什么；层级状态（传送里嵌套房间加载）用扁平枚举表达会继续膨胀；超时与延时事件仍是手写 setTimeout + ref。
- **B. XState v5 + zustand。** 生命周期用 statechart（层级、并行、guard、`after` 延时、`onError`），`@xstate/graph` 从机器定义生成覆盖所有转移的测试路径；共享状态用 zustand（selector 订阅、模块级 store 可在 Provider 外访问、`persist` 中间件替代三处手写 localStorage）。优点：失败边缺失在生成的路径测试里表现为「这条边没有测试覆盖」而非静默；Stately 可视化让状态图成为可读文档；zustand 已是 R3F 的传递依赖，selector 订阅解决全树重渲；模块级 store 让 `/gallery` 能写成就。缺点：+约 17KB gzip；XState v5 的 `setup()` API 有学习成本；迁移期需要 parity 测试保证行为一致。
- **C. 只上 zustand，状态机继续手写。** 优点：改动小、无学习成本、解决重渲与跨路由问题。缺点：不解决本 ADR 的主要动机——失败边缺失。B1/A8 这类问题会继续以「某条边没人想到」的形式复发。
- **D. 只上 XState，状态留在 Context。** 优点：解决失败边。缺点：不解决全树重渲，也不解决 `/gallery` 在 Provider 外无法记成就（Art Critic 仍然解不开）。

## 决策

选 **B**。

**判定原则：当「遗漏一条状态转移」的后果是用户只能刷新页面，就该让工具而不是人来枚举转移。** 手写 reducer 的表达力足够，缺的是**穷举与验证**能力；这正是 statechart 形式化与 `@xstate/graph` 提供的东西。

三台机器：

- `corridorMachine`：顶层，含 `teleporting` 子状态。子状态里显式包含 `aborted` 出口——B1 的修法在状态图上是一条显然缺失的边，而不是某个从未被调用的函数。
- `roomMachine`：每次进房 spawn 的子 actor。`loading` 上挂 `after: { 8000: 'failed' }` 替代手写 setTimeout 与三个 ref；新增 `entered → failed`（`RUNTIME_ERROR`）边修 A8。**READY 只由纹理 Suspense 解析触发，音频不参与**（配合 ADR 20260903140618 解决审计 A5）。
- `dockMachine`：Projects 与 Publications 共用。Publications 现有的 `hanging/centering/detaching/flipping/open/returning` 是它带翻转动画的特例。

zustand：`useSceneStore`（持有 actor 引用）、`useAudioStore`、`useAchievementStore`、`usePerfStore`。成就 store 用 `persist` 中间件，storage key 沿用 `resume_achievements` 以兼容老数据。

迁移纪律：新机器先与旧 reducer 做 parity 测试（相同事件序列产生相同相位），parity 绿之后才切换调用方并删除旧实现。现有 `doorEntryFlow.test.ts` / `roomLoadMachine.test.ts` / `publicationMotion.test.ts` 改写为对新机器的测试。

## 影响

- 正面：审计 B1（传送失败卡死）、A8（进房报错静默）、D1（Art Critic 永远解不开）在结构上被消除；状态图成为可视化文档；全树重渲消失；三处手写 localStorage 归一。
- 负面：+约 17KB gzip；单人仓库引入一个新范式（缓解：三台机器都很小，Stately 可视化图贴进本 ADR 与 `AGENTS.md`）；迁移期新旧并存需要 parity 测试。
- 影响面：新增 `apps/resume/lib/lab/domain/machines/**`、`apps/resume/lib/lab/app/stores/**`；删除 `context/{SceneContext,AudioContext,AchievementsContext,PerformanceContext}.tsx`、`lib/lab/{doorEntryFlow,roomLoadMachine}.ts`、`components/rooms/publications/publicationMotionMachine.ts`、`components/lab/useDoorEntryOrchestrator.ts`；改动所有消费这些 Context 的组件；`package.json` 增 `xstate`、`@xstate/react`、`@xstate/graph`（dev）、`zustand`。
