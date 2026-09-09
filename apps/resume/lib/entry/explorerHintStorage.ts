/**
 * 入口页底部提示「点一扇门进入」的一次性持久化。
 *
 * 形态照抄 `lib/lab/tutorialStorage.ts`，包括两个不显眼但必要的细节：
 *
 * 1. **SSR 返回 `true`（已看过）**。返回 false 会让预渲染带上这条提示、
 *    hydration 后再消失——那一闪比不显示更糟。
 * 2. **`try/catch` 包住 localStorage**。隐身模式与「阻止站点数据」下访问会抛，
 *    抛出来会把整个入口页炸掉，而它只是一条提示。
 *
 * E2E 可以用 `addInitScript` 预置这个键来跳过提示——`lab.spec.ts` 对
 * `lab_tutorial_seen` 就是这么做的，理由记在 `apps/resume/AGENTS.md` 的 E2E 一节：
 * 首访遮罩会拦下点击，不预置的话用例会以「点不到」的形态超时。
 */

const STORAGE_KEY = 'entry_explorer_hinted'

export function hasSeenExplorerHint(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function markExplorerHintSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // 隐身模式等 —— 下次访问再显示一次，无害
  }
}

/** 显示多久后自动淡出（毫秒）。够读完一句话，又不至于挡住主按钮太久 */
export const EXPLORER_HINT_MS = 6_000
