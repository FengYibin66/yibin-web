/**
 * 走廊导轨——相机的**另一个**持有者（ADR 20260903211244）。
 *
 * 走廊里相机是一条沿 z 的一维轨道（x/y 固定、朝向恒定），与 `camera-controls`
 * 的 orbit 模型是两种东西。所以 Lab 有两个相机持有者；关键是**同一时刻只有一个
 * 在写**，由 `CameraDirector.owner` 与 `CameraRig` 的开发态断言保证。
 *
 * 走廊的传送**不能**走 `cameraDirector.moveToWorld({ duration: 0 })`：那条路径在
 * 导演不持有相机时是空操作（`setLookAt(false)` 只改内部球面坐标，位姿要等
 * `update()` 才应用，而 `update()` 在不持有时第一行就 return）。
 *
 * 形态是**命令**而不是共享状态：导轨的每帧插值状态住在 `useCorridorCamera` 的
 * ref 里，这里只让不在同一棵组件树上的 `TeleportRoom` 能下一个命令。
 */

/** 导轨对外的命令面 */
export interface ScrollToOptions {
  /** 秒 */
  readonly duration: number
  /** gsap ease 名 */
  readonly ease?: string
}

export interface CorridorRailHandle {
  /**
   * 立刻把导轨（目标与当前值一起）挪到 `z`。
   * 传送用：纸合着的时候瞬移，不需要中间态。
   */
  jumpTo(z: number): void
  /**
   * 目标 z 平滑过去（ADR 20260908204302）。改的是导轨的 `targetZ`，`currentZ` 照常按
   * 导轨的 smoothing 跟随——手感与玩家自己滚动完全一致。
   * 到达 resolve；被 `release` / 新的 scrollTo / 卸载打断则 reject。
   */
  scrollTo(z: number, options: ScrollToOptions): Promise<void>
  /**
   * 独占导轨：滚轮 / 键盘 / 触摸不再写 `targetZ`，改为回调 `onInput`（持有者决定怎么办
   * ——路线是"当帧退出"）。已被别人持有时返回 false、**不夺权**：夺权会让原持有者的
   * `release` 变成空操作，导轨被永久锁死（评审抓到；第一版在生产静默覆盖、开发态抛错）。
   */
  hold(owner: string, onInput: () => void): boolean
  release(owner: string): void
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

/** 平滑滚到 z；导轨没挂载时 reject（调用方按"被打断"处理） */
export function corridorRailScrollTo(z: number, options: ScrollToOptions): Promise<void> {
  if (!handle) return Promise.reject(new Error('走廊导轨没挂载'))
  return handle.scrollTo(z, options)
}

export function corridorRailHold(owner: string, onInput: () => void): boolean {
  if (!handle) return false
  return handle.hold(owner, onInput)
}

export function corridorRailRelease(owner: string): boolean {
  if (!handle) return false
  handle.release(owner)
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
