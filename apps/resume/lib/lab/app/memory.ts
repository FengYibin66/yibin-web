import { landmarkById } from '@/lib/lab/domain/corridor/landmarks'

/**
 * 走廊记忆的持久化（ADR 20260908172231）。
 *
 * 存两组地标 id：`visited`（经过过）与 `inked`（已显形，草稿变上色）。
 * 它们让回访者一眼看出"哪些看过、哪些没看过" —— 这是走廊里唯一跨会话的状态。
 *
 * ## 为什么不复用 `achievementStorage`
 *
 * 成就存的是"完成了哪些**事**"，这里存的是"去过哪些**地方**"。二者的键空间
 * 不同（成就 id 是固定 7 个的联合类型，地标 id 会随走廊扩建增长），过期策略
 * 也不同（成就一旦解锁永久有效；地标被删除后它的记忆应当被丢弃）。混在一个
 * key 里，下一次加地标就要给成就的类型开后门。
 *
 * ## 三条防线
 *
 * 1. **带版本号**。地标 id 的命名是记忆的键 —— 将来若不得不改名，靠版本号
 *    整批丢弃比留着一堆对不上的 id 好（对不上的 id 不会报错，只会让
 *    "看过的门"悄悄变回草稿，没人能发现）。
 * 2. **读时过滤未知 id**。已删除地标的记忆直接丢，否则 localStorage 会随着
 *    走廊改版无限增长。
 * 3. **任何异常都返回空**。记忆是装饰，隐私模式 / 配额满 / 脏数据都不该阻断
 *    进入 Lab —— 与 `achievementStorage` 同一取舍。
 */

const STORAGE_KEY = 'resume_corridor_memory_v1'

export interface CorridorMemory {
  readonly visited: readonly string[]
  readonly inked: readonly string[]
}

const EMPTY: CorridorMemory = { visited: [], inked: [] }

function knownIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (id): id is string => typeof id === 'string' && landmarkById(id) !== undefined,
  )
}

/** 读出记忆。storage 不可用或内容损坏时返回空，不抛 */
export function loadCorridorMemory(): CorridorMemory {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return EMPTY
    const record = parsed as Record<string, unknown>
    return { visited: knownIds(record.visited), inked: knownIds(record.inked) }
  } catch {
    return EMPTY
  }
}

/**
 * 与盘上已有内容**合并**后写入（只增不减）。
 *
 * 这是运行时唯一该用的写入方式。用 `saveCorridorMemory` 直接覆盖会丢数据：
 * 记忆的恢复是显式的（`hydrateCorridorMemory`，必须在客户端 effect 里），
 * 而在它跑之前内存里是空的 —— 此时若有人记下一个新地标并"用内存覆盖盘"，
 * 盘上原有的记忆就被擦成了空。实测过：回访者进 Lab、hydrate 之前经过一扇门，
 * 之前看过的所有门全部忘记。
 */
export function mergeCorridorMemory(patch: Partial<CorridorMemory>): void {
  if (typeof window === 'undefined') return
  const current = loadCorridorMemory()
  saveCorridorMemory({
    visited: [...new Set([...current.visited, ...(patch.visited ?? [])])],
    inked: [...new Set([...current.inked, ...(patch.inked ?? [])])],
  })
}

/**
 * 覆盖写入。调用方传完整集合。
 *
 * **运行时不要用它** —— 用 `mergeCorridorMemory`。这个导出留给测试与将来的
 * 迁移脚本（那两种场景确实需要"就是这些，别的都不要"的语义）。
 */
export function saveCorridorMemory(memory: CorridorMemory): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        visited: knownIds([...memory.visited]),
        inked: knownIds([...memory.inked]),
      }),
    )
  } catch {
    // 同 achievementStorage：静默失败
  }
}

/** 清空（供"重新探索"入口与测试使用） */
export function clearCorridorMemory(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 同上
  }
}
