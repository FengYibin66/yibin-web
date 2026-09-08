# 20260908204302. 招聘官路线作为走廊状态机的第四种模式接线；导轨新增 `scrollTo` / `hold` 两条命令，不新增相机写点

- 状态：已接受
- 索引：resume 的 Lab 走廊新增「带我走一遍」自动路线（60 秒内依次停在头像、五扇门、猫与段末门前）。三条决定：① 路线是 `corridor.machine` 的第四种模式 `touring`，与传送、进房**由状态机互斥**，`SceneContext` 里五个传送布尔替换为机器快照（兑现 ADR 20260903140616 未完成的那一半，`corridor.machine` 从「已定义未接线」变为有真实消费者）；② 导轨命令面从 `jumpTo` 扩为 `jumpTo` / `scrollTo(z, {duration, ease})` / `hold(owner, onInput)` / `release(owner)`，命令只改导轨的 `targetZ`，**相机写点棘轮不动**（ADR 20260903211244）；③ 路线本身是 domain 的纯数据 + 纯步进函数（`tour.ts`：停靠点引用地标表 id、停留时长、字幕键），任何用户输入（滚轮 / 键盘 / 触摸 / 点门 / ESC）第一帧就退出路线。判定原则：**互斥关系归状态机，连续运动归导轨，路线内容归 domain；三者谁都不碰相机**
- 日期：2026-09-08

## 背景

Lab 走廊的访客里有一类是**招聘官**：时间不到一分钟，不想学「滚轮走、点门进」这套操作，想直接看到有什么。调研（`docs/research/2026-09-08-lab-liveliness.md` §3.5）里 Bruno Simon 与 Coastal World 都给了「自动带你看一遍」的入口。走廊是一维导轨，「带一遍」在几何上就是让导轨的目标 z 按一份停靠表走。

现状有三个约束交织：

- **相机所有权是硬约束**（ADR 20260903211244）：只有 `CameraDirector` 与走廊导轨能写相机，写点棘轮 8 文件 / 34 点只能往下。路线不能自己动相机。
- **`corridor.machine` 已定义、零运行时引用**（ADR 20260903211338 登记为债务）：它有 `loading / corridor / entering / inRoom / exiting / teleporting(closing→placing→opening)`，而运行时的模式互斥靠 `SceneContext` 的五个布尔（`isTeleporting` / `teleportPhase` / `isFastTeleport` / `teleportTarget` / …）加 `useRef` 镜像手工维护。已经出过一次「传送中点门」的竞态（审计 B1）。
- **导轨只有一条命令 `jumpTo`**（`lib/lab/app/camera/corridorRail.ts`）：传送用。路线需要「平滑到某处、到了停一会、期间不让玩家的滚轮把目标拉走、但玩家一动就立刻还给他」——这四件事今天都没有对应的命令。

不决策会发生什么：最短路径是在 `NavigationUI` 里写一个 `setInterval` 改 `targetZ`、再加一个 `isTouring` 布尔到 `SceneContext`——第六个布尔，和传送布尔之间的互斥继续靠人记，`corridor.machine` 继续是一份好看但没人用的定义。

## 选项

### 模式互斥怎么表达

- **A1. 再加一个布尔 `isTouring`**：改动最小；与传送 / 进房的互斥要在每个写入点手工判断（今天传送已经有 5 个写入点），第六个布尔让组合状态到 2⁶。
- **A2. 接线 `corridor.machine`，加 `touring` 状态**：互斥由状态图表达（`touring` 里没有 `TELEPORT` 边，传送中没有 `TOUR_START` 边），`data-lab-teleport-phase` 等诊断属性改从快照派生；代价是要把 `SceneContext` 的五个布尔替换为机器快照——这正是 ADR 20260903140616 说要做而没做完的那一半，`machineEventWiring` 门禁会立刻要求每个新事件有发送方。
- **A3. 独立的 `tour.machine`**：不碰传送那套；但两台机器之间的互斥又回到布尔（「另一台机器不在 idle 时不能启动」），等于 A1 换了个写法。

### 导轨怎么被驾驭

- **B1. 路线直接写 `camera.position`**：违反相机所有权，棘轮变红，否决。
- **B2. 路线写导轨的 `targetZ`（新增命令 `scrollTo` / `hold`）**：导轨仍是唯一写相机者；`scrollTo` 是对 `targetZ` 的 gsap tween，`currentZ` 照常按导轨的 `smoothing` 跟随——路线的运动手感与玩家自己滚动**完全一致**（同一条插值），不会出现「自动走比手动走顺 / 涩」的割裂；`hold` 期间输入处理函数不写 `targetZ`，改为回调通知持有者。
- **B3. 用 `CameraDirector.moveToWorld` 走导演**：导演在走廊态不持有相机，`moveToWorld` 是空操作（`corridorRail.ts` 头部记录的正是这个坑）。否决。

### 路线内容住哪

- **C1. 硬编码在 UI 组件里**：字幕、停靠、时长散在 JSX。
- **C2. domain 纯数据 `TOUR_STOPS` + 纯步进函数 `tourStep`**：停靠点用地标表 id 引用（`landmarkById`），坐标由地标派生，不重复；`tourStep(state, {now, railZ}) → {state, commands}` 可以在 vitest 里跑完整 60 秒而不起 R3F；门禁能断言「每个停靠点引用真实地标」「总时长 ≤ 60 s」「任何输入事件之后下一状态是 idle」。

## 决策

**A2 + B2 + C2。**

- `corridor.machine` 增加 `touring` 状态：`corridor --TOUR_START--> touring`；`touring --TOUR_END | INPUT--> corridor`；`touring --DOOR_CLICK--> entering`（路线中点门 = 退出路线并进房，一条边完成，不让用户点两次）。`teleporting` 与 `inRoom` 里**没有** `TOUR_START` 边，互斥不需要任何 if。
- `SceneContext` 的传送布尔替换为 `useSelector(corridorActor, …)` 的派生值；`teleportPhase` 由 `teleporting.closing / placing / opening` 子状态派生；`data-lab-teleport-phase` 的取值不变，现有 E2E 不改。新增 `html[data-lab-mode] ∈ free | touring | teleporting | inRoom`，世界状态 `world.mode` 由同一快照派生（ADR 20260908172231 预留的字段有了唯一来源）。
- 导轨命令面（`corridorRail.ts`）：`jumpTo(z)`、`scrollTo(z, { duration, ease })`（返回 Promise，输入到达即 reject）、`hold(owner, onInput)` / `release(owner)`（开发态断言同一时刻只一个 owner）。实现全部在 `useCorridorCamera` 内部——它已经是导轨状态与相机的持有者，**不产生第二个写者**（`railWriter` 门禁不变），也不产生新的相机写点（`cameraOwnership` 棘轮不变）。
- `lib/lab/domain/corridor/tour.ts`：`TOUR_STOPS`（8 站：欢迎头像、五扇门、猫、段末门；每站 `landmarkId` / `standOff`（停在地标前方几单位，门取 7——正好落在门自动侧目 `GLANCE_PEAK_DIST = 8` 的峭峰上，侧目效果白得）/ `dwellMs` / `captionKey`）、`TOUR_SPEED = 3` 单位/秒、`tourStep`、`tourTotalMs()`。字幕文案在 `labUi.tour.<stopId>`，en/zh 键一致。
- 入口：`NavigationUI` 一个按钮「带我走一遍 / Show me around」+ 加载完成后教程气泡提一句；结束时段末门前字幕「再走一圈，或者点一扇门进去」。`Escape` 走已有的 `useEscapeRouter` 栈。
- `prefers-reduced-motion` 下路线**照常可用**：它是用户主动发起的导航，不是装饰性运动；但 `TOUR_SPEED` 降到 2，停留不变。

**判定原则**：*互斥关系归状态机，连续运动归导轨，路线内容归 domain；三者谁都不碰相机。* 以后再有「让相机自己走一段」的需求（回到起点、跳到某年），先按这三句归位。

## 影响

- 正面：`corridor.machine` 从债务变成有消费者的资产，传送的 5 个布尔与 `useRef` 镜像删掉；招聘官 60 秒看完；导轨命令面一次补齐，后续「回到起点」「跳到 2021 年」都是一行 `scrollTo`。
- 负面：`SceneContext` 重构触及传送全流程（`TeleportRoom` / `PaperTransition` / `NavigationUI` 的传送入口），必须靠现有的 `teleportFailureRecovery` / `roomMachineFlow` 测试与 E2E 的传送用例证明行为不变；`machineEventWiring` 会要求 `TOUR_START / TOUR_END / INPUT` 都有运行时发送方——这是想要的压力。
- 影响面：新增 `domain/corridor/tour.ts` + `__tests__/tour.test.ts`；改 `domain/machines/corridor.machine.ts`、`app/camera/corridorRail.ts`、`hooks/useCorridorCamera.ts`、`context/SceneContext.tsx`、`components/ui/NavigationUI.tsx`、`lib/content/{en,zh}.ts`（`labUi.tour`）；E2E 加「点按钮 → `data-lab-mode=touring` → 滚一下 → `free`」；巡检脚本加路线一步。规格见 `docs/specs/lab-corridor-story.md` §5。

## 与既有 ADR 的关系

- [20260903140616](./20260903140616-lab-xstate-and-zustand-replace-context.md)（XState + zustand 取代 Context）：**兑现其未完成的一半**——走廊模式从 Context 布尔迁到 `corridor.machine`。
- [20260903211338](./20260903211338-finish-wiring-lab-registry-and-machines.md)（已定义未接线是债务）：**清偿一项**。`corridor.machine` 接线。
- [20260903211244](./20260903211244-lab-camera-owner-is-explicit-not-suspended-flag.md)（相机所有权显式）：**不变**。命令只改 `targetZ`，写点棘轮不动。
- [20260908172231](./20260908172231-corridor-world-state-single-writer.md)（走廊世界状态单写者）：`world.mode` 由机器快照派生，仍是一个来源；`setRail` 仍只有 `useCorridorCamera` 一个调用者。
