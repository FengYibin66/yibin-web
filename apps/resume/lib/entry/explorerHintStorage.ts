/**
 * 入口页底部提示「点一扇门进入」的一次性持久化。
 *
 * SSR 与读取失败都返回「已看过」：返回 false 会让预渲染带上这条提示、
 * hydration 后再消失，那一闪比不显示更糟；而读 localStorage 在隐身模式下会抛。
 *
 * E2E 可以用 `addInitScript` 预置这个键来跳过提示。
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
    // 隐身模式等：下次访问再显示一次，无害
  }
}

/** 自动淡出的延时（毫秒） */
export const EXPLORER_HINT_MS = 6_000
