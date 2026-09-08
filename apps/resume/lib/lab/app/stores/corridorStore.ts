import { create } from 'zustand'

import { landmarkById } from '@/lib/lab/domain/corridor/landmarks'
import {
  EMPTY_WORLD,
  clampDelta,
  lapAt,
  smoothVelocity,
  visitedNow,
  type CorridorMode,
  type CorridorWorld,
} from '@/lib/lab/domain/corridor/world'
import { loadCorridorMemory, mergeCorridorMemory } from '@/lib/lab/app/memory'

/**
 * 走廊世界状态的运行时持有者（ADR 20260908172231）。
 *
 * ## 两种节奏，一个模块
 *
 * **每帧量（`rail`）住在模块级可变对象里，不进 zustand。** 导轨每帧写一次
 * （60fps），而 zustand 的 `set` 会遍历所有 listener 比较 selector 结果 ——
 * 即使没有组件订阅 `rail`，这也是每秒 60 次无用功；一旦有人不小心订阅了它，
 * 就是每帧全树重渲染。成就气泡的 `TICK`（100ms）让 15 个 `DoorSection` 每秒
 * 渲染 10 次那次事故（见 `apps/resume/AGENTS.md`「滚动卡顿」）就是这个形态。
 *
 * 消费者用 `getRail()` / `getWorld()` 在自己的 `useFrame` 里读，不订阅。
 *
 * **离散量（模式 / 圈数 / 进度 / 记忆 / 动效开关）进 zustand**，用 selector
 * 订阅：地图只在 `visited` 变化时重渲染，加载画面只在 `loadProgress` 变化时
 * 重渲染。且 `setRail` 派生出的 `lap` / `visited` **只在真的变化时**才 `set`
 * —— 稳态下滚动一整段也只有跨段与经过地标那几次通知。
 *
 * ## 谁能写
 *
 * `setRail` **只有 `hooks/useCorridorCamera.ts` 能调**（它已经是走廊相机的
 * 持有者，导轨状态本来就归它）。门禁 `__tests__/railWriter.test.ts` 全禁第二个
 * 写者、无棘轮 —— 两个写者会让"相机在哪"这个问题出现两个答案，而那种 bug
 * 的表现是"活物偶尔跑到墙里"这类无法复现的怪事。
 *
 * **本 store 不写相机。** 它是导轨状态的镜像；相机所有权（ADR 20260903211244）
 * 完全不变。
 */

// ─── 每帧量（模块级，不进 zustand） ──────────────────────────────────────────

interface RailState {
  z: number
  velocity: number
}

const rail: RailState = { z: 0, velocity: 0 }
/**
 * 首帧标记。
 *
 * 相机初始在 Z=28 而 `rail.z` 初值是 0 —— 第一次 `setRail(28)` 若按 `28 − 0`
 * 算位移，会得到 1680 单位/秒的速度，让所有速度消费者（活物步频、脚步声、
 * 纸张摆动）在第一帧全部炸到最大档。
 */
let railInitialized = false

/** 读导轨（每帧读，不订阅） */
export function getRail(): Readonly<RailState> {
  return rail
}

// ─── 离散量（zustand） ───────────────────────────────────────────────────────

export interface CorridorStoreState {
  mode: CorridorMode
  loadProgress: number
  lap: number
  visited: ReadonlySet<string>
  inked: ReadonlySet<string>
  motionScale: 0 | 1
  setMode: (mode: CorridorMode) => void
  setLoadProgress: (progress: number) => void
  setMotionScale: (scale: 0 | 1) => void
  /** 标记为已显形（进过的房间、看过的画）。未知 id 忽略 */
  markInked: (id: string) => void
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

/**
 * 初值**不读 localStorage** —— 必须等到客户端 hydration 之后（`hydrateCorridorMemory`）。
 *
 * 这个模块会被 SSR（`LabScene` 是 `ssr: false`，但 store 可能被其他链路 import），
 * 而"服务端渲染出的 HTML 与客户端首帧必须一致"是 React hydration 的硬要求。
 * 若初值来自 localStorage，回访者的首帧就与服务端不同 —— `LocaleProvider`
 * 正是因为这个才把"读 storage"推迟到 `useEffect`（见 `apps/resume/AGENTS.md`
 * 「语言：一份偏好，三处按钮」）。
 */
export const useCorridorStore = create<CorridorStoreState>()((set, get) => ({
  mode: EMPTY_WORLD.mode,
  loadProgress: EMPTY_WORLD.loadProgress,
  lap: EMPTY_WORLD.lap,
  // 新建 Set，不复用模块级常量的实例（理由见 resetCorridorWorld 里的注释）
  visited: new Set<string>(),
  inked: new Set<string>(),
  motionScale: EMPTY_WORLD.motionScale,

  setMode: mode => {
    if (get().mode === mode) return
    set({ mode })
  },

  setLoadProgress: progress => {
    const next = clamp01(progress)
    if (get().loadProgress === next) return
    set({ loadProgress: next })
  },

  setMotionScale: scale => {
    if (get().motionScale === scale) return
    set({ motionScale: scale })
  },

  markInked: id => {
    if (landmarkById(id) === undefined) return
    const current = get().inked
    if (current.has(id)) return
    const next = new Set(current)
    next.add(id)
    set({ inked: next })
    mergeCorridorMemory({ inked: [id] })
  },
}))

// ─── 导轨写入（唯一写者：useCorridorCamera） ─────────────────────────────────

/**
 * 发布这一帧的导轨状态。
 *
 * @param z 相机在走廊上的 Z（导轨的 `currentZ`，不是 `targetZ`）
 * @param dt 这一帧的时长（秒），内部夹在 `MAX_FRAME_DELTA`
 *
 * 顺带派生两件事，**只在变化时**通知订阅者：
 * - `lap`（第几圈）
 * - `visited`（经过的地标）：新 id 出现时才写，并落盘
 */
export function setRail(z: number, dt: number): void {
  const safeZ = Number.isFinite(z) ? z : rail.z

  if (!railInitialized) {
    railInitialized = true
    rail.z = safeZ
    rail.velocity = 0
  } else {
    const step = clampDelta(dt)
    rail.velocity = smoothVelocity(rail.velocity, safeZ - rail.z, step)
    rail.z = safeZ
  }

  const state = useCorridorStore.getState()

  const nextLap = lapAt(safeZ)
  if (nextLap !== state.lap) useCorridorStore.setState({ lap: nextLap })

  const hits = visitedNow(safeZ)
  if (hits.length > 0) {
    const current = useCorridorStore.getState().visited
    const fresh = hits.filter(id => !current.has(id))
    if (fresh.length > 0) {
      const next = new Set(current)
      for (const id of fresh) next.add(id)
      useCorridorStore.setState({ visited: next })
      mergeCorridorMemory({ visited: fresh })
    }
  }
}

/** 完整快照，供每帧读多个量的消费者（如 `useInk`）使用 */
export function getWorld(): CorridorWorld {
  const state = useCorridorStore.getState()
  return {
    rail: { z: rail.z, velocity: rail.velocity },
    mode: state.mode,
    loadProgress: state.loadProgress,
    lap: state.lap,
    visited: state.visited,
    inked: state.inked,
    motionScale: state.motionScale,
  }
}

/**
 * 从 localStorage 恢复记忆。**必须在客户端 effect 里调**（见 store 初值处的注释）。
 *
 * 幂等：重复调用只是再读一次盘。已在内存里的记忆不会被盘上的旧值覆盖——
 * 两者取并集，因为内存里可能有本次会话刚记下、还没落盘的项。
 */
export function hydrateCorridorMemory(): void {
  const memory = loadCorridorMemory()
  if (memory.visited.length === 0 && memory.inked.length === 0) return
  const state = useCorridorStore.getState()
  useCorridorStore.setState({
    visited: new Set([...state.visited, ...memory.visited]),
    inked: new Set([...state.inked, ...memory.inked]),
  })
}

/**
 * 清空**内存里**的世界状态（Lab 卸载、测试之间）。
 *
 * 盘上的记忆不动 —— 下次进 Lab 由 `hydrateCorridorMemory()` 恢复。要真正忘掉
 * 走过的路得用 `clearCorridorMemory()`，那是用户动作（"重新探索"）而不是
 * 生命周期动作。
 *
 * 重置 `railInitialized` 是必须的：下次进 Lab 相机又从 Z=28 开始，若沿用上次的
 * `rail.z` 会在第一帧算出一个巨大的速度。
 */
export function resetCorridorWorld(): void {
  rail.z = 0
  rail.velocity = 0
  railInitialized = false
  useCorridorStore.setState({
    mode: EMPTY_WORLD.mode,
    loadProgress: EMPTY_WORLD.loadProgress,
    lap: EMPTY_WORLD.lap,
    /*
      新建 Set 而不是复用 `EMPTY_WORLD.visited` —— 那是模块级常量，共用同一个
      实例意味着任何一次误 mutate 都会污染它，而 `ReadonlySet` 只在类型层挡住
      `add`，运行时挡不住。
    */
    visited: new Set<string>(),
    inked: new Set<string>(),
    motionScale: EMPTY_WORLD.motionScale,
  })
}
