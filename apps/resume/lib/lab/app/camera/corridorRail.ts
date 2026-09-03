/**
 * 走廊导轨 —— 相机的**另一个**持有者（ADR 20260903211244）。
 *
 * ## 走廊为什么不用 CameraDirector
 *
 * 走廊里相机是一条沿 z 的一维轨道：x / y 固定，z 随滚动插值，朝向始终看向前方。
 * 这与 `camera-controls` 的 orbit 模型（围绕一个 target 转）是两种东西，硬套过去
 * 要先给导演加一个 rail 模式——而那不会让任何事变简单。
 *
 * 所以 Lab 有**两个**相机持有者，`useCorridorCamera` 是走廊那个。这不是妥协，
 * 是走廊与房间的相机语义本来不同；关键在于**同一时刻只有一个在写**，由
 * `CameraDirector.owner` 与 `CameraRig` 的开发态断言保证。
 *
 * ## 这个模块存在的具体原因：传送不再瞬移
 *
 * `TeleportRoom` 原先调 `cameraDirector.moveToWorld({ duration: 0 })` 来把相机放到
 * 目标门前。那条路径**在导演不持有相机时是空操作**：
 *
 *   `moveToWorld(duration ≤ 0)` → `push()` → `controls.setLookAt(…, false)`
 *
 * 而 camera-controls 的 `setLookAt(enableTransition = false)` 只改它内部的
 * `_target` / `_spherical`，**相机位姿要等 `update()` 才应用**——而走廊里导演
 * 不持有相机，`update()` 第一行就 return。
 *
 * 后果：相机一动不动，随后 `DoorSection` 的对齐 tween 从**旧位置**飞过去。
 * 非 fast 模式下用户看到的是穿过整条走廊的 1 秒飞行，而不是瞬移；
 * `pendingDoorClick` 用 `camera.position.z` 算段号时也拿的是旧值。
 *
 * 而它的单测断言的是导演内部的 `snapshot()`（导演**想要**的位姿），不是
 * `camera.position`（相机**实际**的位姿）——所以测试一直是绿的。
 * 这条教训写进了 `apps/resume/AGENTS.md`：不要用 `snapshot()` 断言相机行为。
 *
 * ## 形态：注册表而不是全局状态
 *
 * 导轨的状态（目标 z、当前 z）住在 `useCorridorCamera` 的 ref 里，那是对的
 * ——它每帧插值，属于渲染循环。这里只做一件事：让**不在同一棵组件树上**的
 * `TeleportRoom` 能给它下一个命令。
 *
 * 命令而不是共享状态：`jumpTo` 是"立刻把导轨挪到这里"，语义完整、无中间态。
 */

/** 导轨对外的命令面 */
export interface CorridorRailHandle {
  /**
   * 立刻把导轨（目标与当前值一起）挪到 `z`。
   *
   * 目标与当前值**必须一起设**：只设目标的话相机会平滑滑过去，那正是传送要
   * 避免的（传送的语义是"纸合上、换个地方、纸打开"）。
   */
  jumpTo(z: number): void
}

let handle: CorridorRailHandle | null = null

/**
 * 由 `useCorridorCamera` 在挂载时登记。返回注销函数。
 *
 * 同一时刻只该有一个走廊导轨。重复登记会覆盖前一个——那说明有两处在驱动走廊
 * 相机，是个应该被发现的错误，所以开发态直接抛。
 */
export function registerCorridorRail(next: CorridorRailHandle): () => void {
  if (handle !== null && process.env.NODE_ENV !== 'production') {
    throw new Error(
      '走廊导轨被登记了两次——同一时刻只该有一个 useCorridorCamera 在驱动走廊相机',
    )
  }
  handle = next
  return () => {
    if (handle === next) handle = null
  }
}

/**
 * 命令导轨跳到某个 z。
 *
 * @returns 是否送达。`false` 表示导轨没挂载（走廊组件还没渲染或已卸载）
 *   ——调用方应当把它当成错误而不是静默忽略：传送落空不报错，只表现为
 *   "传送之后相机在错误的位置"。
 */
export function corridorRailJumpTo(z: number): boolean {
  if (!handle) return false
  handle.jumpTo(z)
  return true
}

/** 当前有没有导轨在挂载（测试与调试用） */
export function isCorridorRailMounted(): boolean {
  return handle !== null
}

/** 清空登记。**只给测试用** */
export function resetCorridorRail(): void {
  handle = null
}
