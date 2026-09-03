/**
 * 成就持久化 —— 模块级，不依赖 React Context。
 *
 * 加它的原因（审计 D1）：成就 `gallery_inspect`（"Art Critic"）**永远解不开**。
 * 它的唯一解锁调用在 `components/rooms/GalleryRoom.tsx`，而那个文件零渲染方
 * ——`RoomInterior` 对 gallery 返回 null，走廊的 Gallery 门是
 * `router.push('/gallery')` 跳独立路由，而 `/gallery` **在
 * `AchievementsProvider` 之外**，拿不到 `unlockAchievement`。
 *
 * 把读写下沉到模块级函数后，`/gallery` 也能记成就；`AchievementsProvider`
 * 变成它的 React 视图。这是 ADR 20260903140616（zustand + persist）的方向，
 * 本文件是不引入新依赖的过渡形态。
 */

const STORAGE_KEY = 'resume_achievements'

/**
 * `corridor_enter` 刻意不持久化：它是"点门进房"的入门提示，每次访问都该出现。
 * 读与写两侧都要过滤——只过滤一侧会让它在本次会话内被当成已完成。
 */
const NEVER_PERSISTED = new Set(['corridor_enter'])

/** 读出已完成的成就 id。storage 不可用或内容损坏时返回空数组，不抛。 */
export function loadAchievements(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (id): id is string => typeof id === 'string' && !NEVER_PERSISTED.has(id),
    )
  } catch {
    return [] // 隐私模式 / 配额满 / 脏数据：成就是装饰，不该阻断任何流程
  }
}

/** 覆盖写入。调用方负责传完整列表。 */
export function saveAchievements(ids: readonly string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(ids.filter((id) => !NEVER_PERSISTED.has(id))),
    )
  } catch {
    // 同上，静默失败
  }
}

/**
 * 记一个成就。**可在 Provider 之外调用**——这正是它存在的理由。
 * 返回是否是新解锁（已有则 false），调用方可据此决定是否播提示。
 */
export function recordAchievement(id: string): boolean {
  if (NEVER_PERSISTED.has(id)) return false
  const current = loadAchievements()
  if (current.includes(id)) return false
  saveAchievements([...current, id])
  return true
}
