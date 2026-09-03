# 20260903211338. 已定义未接线的三条路径：接线，不删除；接线完成前文档一律标「未接线」

- 状态：已接受
- 索引：ADR 20260903140615 的房间注册表（渲染 / 教程 / 预载三条消费路径）与 20260903140616 的 `room`/`corridor` 状态图，实现后**从未接入运行时**——运行时仍是 `RoomInterior` 的 `switch`、手写预载表与旧的 `doorEntryFlow`/`roomLoadMachine` 三件套，而两份 ADR 与 `AGENTS.md` 把它们描述为「已落地 / 已用」；本 ADR 决定补完接线（而非删除新代码回退），并立一条规则：未接线的实现在文档里一律标「已定义、未接线」，测试覆盖它不算落地
- 日期：2026-09-03

## 背景

四份独立 review 里，架构视角的结论最重，逐条核实全部成立：

**房间注册表（ADR 615）定义了，但大半字段没有消费者。**

- `RoomDefinition.view`：全仓无 `.view(` 调用。`RoomInterior.tsx` 仍是硬编码 `switch (roomId)` 静态 import 四个房间组件。五个 `*RoomView.tsx` 适配层零渲染方。
- `RoomDefinition.tutorial`：无消费者，四个房间各自硬编码 `useRoomTutorial('contact_found')` 这类字面量。
- `RoomDefinition.entryPose` / `cameraFreedom`：只有 Projects 消费。**于是 ADR 615 声称「A1/A3（About/Contact 无房间级相机）由 entryPose 修复」在运行时不成立。**
- Gallery 特例并未消失：`roomId === 'gallery'` 在 7 处仍在。
- `RoomAmbience.refDistance/rolloffFactor` 无人读（生效的是 `audio/manifest.ts` 里的 `spatial`）。

**派生预载表（ADR 615）生成了，但没有引用者。**

- `lib/lab/app/assets/manifest.gen.ts` 的唯一 importer 是生成它的脚本自己。运行时仍 import 手写的 `roomAssets.ts` 与 `texturePreload.ts`。
- 两份清单已经漂移：注册表声明 Projects 有 18 张纹理，手写表 15 张；`texturePreload.ts` 首屏仍加载 3 段走廊壁画（16 张），生成物写的是 1 段——**审计 G1（首屏 7.6MB）在运行时并未修**。
- ADR 615 承诺把生成物加入 `.claude/hooks/pre-generated-edit.sh` 的保护名单，未兑现。
- CI 在跑 `gen-asset-manifest.mjs --check`，校验的是一个没人消费的文件。

**XState 状态图（ADR 616）三台里两台没接线。**

- `room.machine` / `corridor.machine` 在 `app components context hooks lib` 下零引用，只有 `__tests__/labMachines.test.ts` 引用它们。运行时是 `SceneContext` + `roomLoadMachine.ts` + `useDoorEntryOrchestrator.ts` 旧三件套。
- 于是 `labMachines.test.ts` 二十多个用例验证的是不在生产路径上的代码，其中包括为审计 A8（房间进入后运行时错误无出口）专门加的那条 `entered → failed` 边——**A8 在运行时仍未修**：`handleRoomError` 只在 `loading` 阶段派发，entered 后抛错的表现依然是房间消失、相位不变、无提示。
- `dockMachine` 自称「Projects 与 Publications 共用」，实际只有 Projects 用，Publications 仍用 `publicationMotionMachine`。

问题的性质不是「有几个 bug」，而是**文档与现实脱节，且被绿色的测试放大**。下一个人（或下一个 AI 会话）读 `AGENTS.md` 会相信 About/Contact 的取景由 `entryPose` 驱动、房间生命周期由状态图保护、预载表由生成物派生，然后基于错误前提继续设计。根 CLAUDE.md 用 `ARCHITECTURE.md` 长期写错持久层（libSQL 被写成共享 MySQL）举过这个例子，并明确写下「基于错误前提的连锁设计比文档不整洁的代价高得多」。这次是同一形态在同一个仓库里复现，而且是我自己造成的。

不决策会发生什么：三份 ADR 的主体永久停在「写了、测了、没用上」，新旧两套实现并存；每次改动都要判断「这个文件是活的还是死的」，而判断依据只有 grep。

## 选项

- **A. 删掉未接线的新代码，ADR 615/616 状态改「已弃用」。** 优点：立刻消除双轨，代码量下降，文档与现实一致。缺点：把已核实的三个真实缺陷（A8 无出口、G1 首屏 7.6MB、About/Contact 无房间级相机）连同修法一起丢掉；这三条正是当初写 ADR 的动因。等于承认「重构失败」而问题原样留下。
- **B. 补完接线，删掉旧实现。** 优点：兑现三份 ADR 的收益；A8/G1/A1/A3 随接线一并修掉；双轨消除的方向是前进而不是后退。缺点：`SceneContext` 切状态图是这批改动里风险最高的一项（它牵动进房、退房、传送、失败恢复四条路径），而当前 E2E 对 `/lab` 只断言返回 200，没有任何行为覆盖——**先补 E2E 安全网是接线的前置条件，不是可选项**。
- **C. 保留双轨，把新代码标注为「实验性」，等真的需要时再接。** 优点：不承担接线风险。缺点：这正是当前状态，而当前状态已经产生了「测试守护死代码 + 文档说谎」的复合后果。「等真的需要」在单人仓库里等价于永不。

## 决策

选 **B**，并把接线拆成有依赖顺序的三步，E2E 安全网排在最前：

1. **先补 Lab 的 E2E**（chromium + mobile-safari 各覆盖进房 / ESC / 退房、传送、关面板不退房、教程随退房消失）。当前 E2E 完全不进 Lab，没有它，后两步的回归无法被发现。
2. **接线注册表**：`RoomInterior` 改用 `ROOMS[id].view` + `React.lazy`；教程从注册表读；`LabScene`/`DoorSection` 改 import `manifest.gen.ts`，删掉 `roomAssets.ts` 与 `texturePreload.ts` 的手写表（首屏壁画随之 3 段 → 1 段，修 G1）；`view` 字段从 domain 移到 `components/rooms/registry.ts`（domain 不该 import react 的 `ComponentType`，这是当前的分层违规）；生成物加入 hook 保护名单。
3. **接线状态图**：`SceneContext` 改用 `room.machine` / `corridor.machine`（`@xstate/react`），删 `doorEntryFlow.ts` / `roomLoadMachine.ts` / `useDoorEntryOrchestrator.ts`；`entered → FAIL → failed` 边真正生效（修 A8）；补 `@xstate/graph` 的全路径测试（ADR 616 承诺过但未兑现，装了 `@xstate/graph` 却没用）。

**判定原则（本 ADR 最重要的产出）：一份实现只有在生产路径上有消费者时才算落地；「代码已写 + 测试已绿」不是落地，而且是比未实现更危险的状态——因为测试的绿色会被当成落地的证据。** 因此：

- 任何「已定义未接线」的实现，在 ADR 的 `索引：` 与 `AGENTS.md` 里一律标注**「已定义、未接线」**，不得写「已落地 / 已用」。
- 为未接线代码写的测试，必须在文件顶部注明它守护的代码尚未接入运行时。
- 判断落地的操作性标准：`grep -rl <模块> app components context hooks lib` 有非测试命中。

## 影响

- 正面：三份 ADR 的收益兑现；A8、G1、A1/A3 四条审计项随接线真正修掉；新旧双轨消除；Lab 第一次有行为级 E2E；文档回到可信状态。
- 负面：接线本身是四个 PR 的工作量，其中状态图那步风险最高；`RoomInterior` 用 `React.lazy` 后房间切换多一次 Suspense 边界，需要确认与现有加载指示器不冲突；`@xstate/graph` 的全路径测试会显著增加测试时间。
- 影响面：`apps/resume/e2e/`、`components/lab/{RoomInterior,LabScene,DoorSection}.tsx`、新增 `components/rooms/registry.ts`、`lib/lab/domain/rooms/*.ts`（移除 `view`）、删除 `lib/lab/{roomAssets,texturePreload,doorEntryFlow,roomLoadMachine}.ts` 与 `components/lab/useDoorEntryOrchestrator.ts`、`context/SceneContext.tsx`、`.claude/hooks/pre-generated-edit.sh`、`docs/adr/20260903140615` 与 `20260903140616` 的头部字段、`apps/resume/AGENTS.md`。
