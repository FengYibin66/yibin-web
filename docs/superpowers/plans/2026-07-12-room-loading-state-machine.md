# Room Loading State Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 普通房间门只在资源与首帧真实就绪后打开，并在等待期间提供门内手绘加载、失败重试和返回走廊。

**Architecture:** 用纯 reducer 管理房间进入阶段；`SceneContext` 作为全局单一状态源；`RoomInterior` 的 Suspense fallback 上报 loading，ready sentinel 在子树退出 Suspense 且完成两帧后上报 ready；`DoorSection` 只编排相机、门和状态机，不再用固定帧数或 8 秒强制开门。

**Tech Stack:** React 19、TypeScript、React Three Fiber、Drei Suspense、GSAP、Vitest、Testing Library。

## Global Constraints

- 状态只允许：`idle | aligning | loading | ready | opening | entered | failed | exiting`。
- 8 秒超时进入 `failed`，不得强行开门。
- Retry 重新挂载当前房间加载尝试；Back 恢复相机控制与门状态。
- Gallery 路由门本计划不改；继续走 `/gallery?from=lab`。
- 新纯逻辑必须先写失败测试；禁止固定帧数充当资源 ready。
- 不新增依赖；不提交 `.claude/`。
- 未获得用户明确授权时不执行 git commit/push。

---

## File Map

- Create `apps/resume/lib/lab/roomLoadMachine.ts`：阶段、事件、reducer。
- Create `apps/resume/lib/lab/roomAssets.ts`：房间资源清单与幂等预加载入口。
- Create `apps/resume/components/lab/RoomLoadingIndicator.tsx`：门内加载与失败操作 UI。
- Create `apps/resume/components/lab/RoomReadyBoundary.tsx`：Suspense fallback 与真实首帧 ready bridge。
- Modify `apps/resume/context/SceneContext.tsx`：持有 room loading state/actions。
- Modify `apps/resume/components/lab/RoomInterior.tsx`：按 attempt key 挂载，使用 ready boundary。
- Modify `apps/resume/components/lab/DoorSection.tsx`：状态机驱动进入、retry/back/cleanup。
- Modify `apps/resume/components/lab/LabScene.tsx`：挂载全局 loading indicator。
- Modify `apps/resume/components/rooms/{AboutRoom,ProjectsRoom,PublicationsRoom,ContactRoom}.tsx`：删除固定帧 onReady。
- Test `apps/resume/__tests__/roomLoadMachine.test.ts`。
- Test `apps/resume/__tests__/roomReadyBoundary.test.tsx`。

---

### Task 1: 房间加载纯状态机

**Files:**
- Create: `apps/resume/lib/lab/roomLoadMachine.ts`
- Test: `apps/resume/__tests__/roomLoadMachine.test.ts`

**Interfaces:**
- Produces:
  - `type RoomLoadPhase`
  - `interface RoomLoadState`
  - `type RoomLoadEvent`
  - `const INITIAL_ROOM_LOAD_STATE`
  - `function roomLoadReducer(state, event): RoomLoadState`

- [ ] **Step 1: 写失败测试**

测试至少覆盖：

```ts
expect(roomLoadReducer(INITIAL_ROOM_LOAD_STATE, {
  type: 'BEGIN', roomId: 'publications',
})).toMatchObject({
  phase: 'aligning',
  roomId: 'publications',
  attempt: 1,
})

expect(() => roomLoadReducer(
  { phase: 'loading', roomId: 'publications', attempt: 1, error: null },
  { type: 'OPENED' },
)).toThrow(/invalid room load transition/i)

expect(roomLoadReducer(
  { phase: 'loading', roomId: 'publications', attempt: 1, error: null },
  { type: 'TIMEOUT', message: 'Loading timed out' },
)).toMatchObject({ phase: 'failed', error: 'Loading timed out' })
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
pnpm --filter @yibin/resume test -- roomLoadMachine.test.ts
```

Expected: FAIL，因为模块不存在。

- [ ] **Step 3: 实现最小 reducer**

状态结构：

```ts
export interface RoomLoadState {
  phase: RoomLoadPhase
  roomId: RoomId | null
  attempt: number
  error: string | null
}
```

事件：

```ts
type RoomLoadEvent =
  | { type: 'BEGIN'; roomId: RoomId }
  | { type: 'ALIGNED' }
  | { type: 'READY' }
  | { type: 'OPENING' }
  | { type: 'OPENED' }
  | { type: 'EXIT' }
  | { type: 'RESET' }
  | { type: 'RETRY' }
  | { type: 'TIMEOUT'; message: string }
  | { type: 'FAIL'; message: string }
```

非法转移抛出带 `from → event` 的错误，开发阶段立即暴露竞态。

- [ ] **Step 4: 运行测试确认 GREEN**

Expected: `roomLoadMachine.test.ts` 全部通过。

- [ ] **Step 5: 检查点**

运行 type-check；仅在用户明确要求时提交。

---

### Task 2: SceneContext 接入单一加载状态源

**Files:**
- Modify: `apps/resume/context/SceneContext.tsx`
- Test: `apps/resume/__tests__/roomLoadMachine.test.ts`

**Interfaces:**
- Consumes: `roomLoadReducer`。
- Produces：
  - `roomLoadState`
  - `beginRoomLoad(roomId)`
  - `markRoomAligned()`
  - `markRoomReady()`
  - `markRoomOpening()`
  - `markRoomEntered()`
  - `failRoomLoad(message)`
  - `retryRoomLoad()`
  - `resetRoomLoad()`

- [ ] **Step 1: 增加失败测试**

为 reducer 加入 RETRY 断言：保留 `roomId`、递增 `attempt`、返回 `loading`、清空 error。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 使用 `useReducer` 接入 Context**

Context actions 只 dispatch，不额外复制 `loading` 布尔值。`isRoomLoading` 必须由 phase 派生：

```ts
const isRoomLoading =
  roomLoadState.phase === 'aligning' ||
  roomLoadState.phase === 'loading'
```

- [ ] **Step 4: 运行测试与 type-check**

- [ ] **Step 5: 检查点**

---

### Task 3: RoomReadyBoundary 真实 ready 契约

**Files:**
- Create: `apps/resume/components/lab/RoomReadyBoundary.tsx`
- Modify: `apps/resume/components/lab/RoomInterior.tsx`
- Test: `apps/resume/__tests__/roomReadyBoundary.test.tsx`

**Interfaces:**
- Produces:

```ts
interface RoomReadyBoundaryProps {
  attempt: number
  onLoading: () => void
  onReady: () => void
  onError: (message: string) => void
  children: React.ReactNode
}
```

- [ ] **Step 1: 写失败测试**

使用 deferred promise 制造 Suspense：

```tsx
expect(screen.getByTestId('room-suspense-fallback')).toBeInTheDocument()
expect(onReady).not.toHaveBeenCalled()

resolveAsset()
await act(async () => {})
expect(onReady).not.toHaveBeenCalled()

act(() => {
  vi.advanceTimersToNextFrame()
  vi.advanceTimersToNextFrame()
})
expect(onReady).toHaveBeenCalledTimes(1)
```

另测 attempt 改变后可再次 ready；卸载后 RAF 不调用回调。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 实现 boundary**

结构：

```tsx
<RoomErrorBoundary onError={onError} resetKey={attempt}>
  <Suspense fallback={<RoomSuspenseFallback onMount={onLoading} />}>
    {children}
    <RoomReadySentinel attempt={attempt} onReady={onReady} />
  </Suspense>
</RoomErrorBoundary>
```

`RoomReadySentinel` 在 effect 中串联两个 RAF，cleanup 全部 cancel。

- [ ] **Step 4: 修改 RoomInterior**

用 `key={`${roomId}:${attempt}`}` 强制 Retry 重新创建子树。用 `switch(roomId)` 生成 room，不在 JSX 里堆多个条件表达式。

- [ ] **Step 5: 测试确认 GREEN**

- [ ] **Step 6: 检查点**

---

### Task 4: 房间资源清单与接近预载

**Files:**
- Create: `apps/resume/lib/lab/roomAssets.ts`
- Modify: `apps/resume/components/lab/DoorSection.tsx`
- Test: `apps/resume/__tests__/roomAssets.test.ts`

**Interfaces:**
- Produces:

```ts
export const ROOM_ASSETS: Readonly<Record<Exclude<RoomId, 'gallery'>, readonly string[]>>
export function preloadRoomAssets(roomId: Exclude<RoomId, 'gallery'>): void
```

- [ ] **Step 1: 写失败测试**

断言四个普通房间均有非空资源清单，URL 无重复、全部以 `/textures/` 或 `/fonts/` 开头，gallery 不属于该表。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 从实际 Room 收集静态资源**

使用 `useTexture.preload(url)`；数组资源逐个 preload。函数幂等，模块级 `Set<RoomId>` 防止重复日志和调用。

- [ ] **Step 4: DoorSection 接近时预载**

当 `dist < 15` 首次触发；`handlePointerEnter` 再次调用无副作用。Gallery 仍 router prefetch。

- [ ] **Step 5: 测试确认 GREEN**

- [ ] **Step 6: 检查点**

---

### Task 5: 门内加载 UI 与失败恢复

**Files:**
- Create: `apps/resume/components/lab/RoomLoadingIndicator.tsx`
- Modify: `apps/resume/components/lab/LabScene.tsx`
- Test: `apps/resume/__tests__/roomLoadingIndicator.test.tsx`

**Interfaces:**
- Consumes `roomLoadState`、`retryRoomLoad`、`resetRoomLoad`。
- Emits:
  - `onRetry`
  - `onBack`

- [ ] **Step 1: 写失败测试**

断言：

```tsx
render(<RoomLoadingIndicator state={loadingState} ... />)
expect(screen.getByText('Preparing Publications…')).toBeVisible()

render(<RoomLoadingIndicator state={failedState} ... />)
expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
expect(screen.getByRole('button', { name: 'Back to corridor' })).toBeEnabled()
```

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 实现展示组件**

文案来自常量映射：

```ts
const ROOM_LOADING_LABELS: Record<RoomId, string> = {
  about: 'Preparing About…',
  projects: 'Preparing Projects…',
  publications: 'Preparing Publications…',
  gallery: 'Opening Gallery…',
  contact: 'Preparing Contact…',
}
```

loading 显示墨迹 SVG/CSS 循环动画；failed 显示错误与两个语义化 button。尊重 `prefers-reduced-motion`。

- [ ] **Step 4: 在 LabScene 全局挂载**

置于 Canvas 之上、NavigationUI 之下；只在 aligning/loading/failed 显示。定位在当前门视线中心，不遮挡 Exit Lab。

- [ ] **Step 5: 测试确认 GREEN**

- [ ] **Step 6: 检查点**

---

### Task 6: DoorSection 改为状态机编排

**Files:**
- Modify: `apps/resume/components/lab/DoorSection.tsx`
- Test: `apps/resume/__tests__/doorEntryFlow.test.ts`

**Interfaces:**
- Consumes Task 2 Context actions、Task 3 `RoomInterior` 契约。

- [ ] **Step 1: 写失败的流程测试**

将进入决策提取为纯 controller/reducer 测试，证明：

- 点击后 `idle → aligning`。
- 相机对齐后 `aligning → loading`，门仍关闭。
- ready 后才 `ready → opening`。
- timeout 后 `loading → failed`，`openDoorPanels` 未调用。
- retry 增加 attempt。
- back 清理 camera override、timer、door state。

- [ ] **Step 2: 运行确认 RED**

- [ ] **Step 3: 删除旧时序**

删除：

- `roomReadyRef`
- “8 秒后强制 openDoorPanels”回调
- Room 传入的固定帧 onReady 假契约

保留 8 秒 timer，但只 dispatch `TIMEOUT`。

- [ ] **Step 4: 接入新流程**

`handleClick` dispatch BEGIN；相机对齐 dispatch ALIGNED；`RoomReadyBoundary` dispatch READY；effect 监听 ready 后只触发一次开门。Retry 使用 attempt 重挂载；Back 还原保存的相机位置并 reset。

- [ ] **Step 5: 运行流程测试与 type-check**

- [ ] **Step 6: 检查点**

---

### Task 7: 删除各房间固定帧 ready

**Files:**
- Modify: `apps/resume/components/rooms/AboutRoom.tsx`
- Modify: `apps/resume/components/rooms/ProjectsRoom.tsx`
- Modify: `apps/resume/components/rooms/PublicationsRoom.tsx`
- Modify: `apps/resume/components/rooms/ContactRoom.tsx`
- Modify: `apps/resume/__tests__/rooms.test.ts`

- [ ] **Step 1: 将旧测试改为新契约并确认 RED**

移除“10/20 帧调用 onReady”的测试，改为 Room 仅渲染内容、ready 由 boundary 负责。

- [ ] **Step 2: 删除各 Room 的 `hasSignaled/frameCount/onReady`**

Room props 变为：

```ts
interface RoomProps {
  showRoom: boolean
  isExiting: boolean
}
```

Tutorial 在 SceneContext phase `entered` 后触发，不再绑在假 ready 上。

- [ ] **Step 3: 运行全量测试**

Expected: 全量通过，无 act warning。

- [ ] **Step 4: 生产验证**

```bash
pnpm --filter @yibin/resume type-check
pnpm --filter @yibin/resume test
pnpm --filter @yibin/resume build
```

- [ ] **Step 5: 手工验收**

DevTools Slow 3G：点击 Publications 门，门保持关闭并显示加载；ready 后只开门一次；Offline 进入 failed；Retry 和 Back 都恢复可操作状态。

- [ ] **Step 6: 检查点**

记录验证输出；仅在用户明确要求时提交。
