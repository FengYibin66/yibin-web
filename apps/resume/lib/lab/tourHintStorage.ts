/**
 * 路线入口引导的一次性持久化（规格 `lab-corridor-story.md` §5.2）。
 *
 * SSR 与读取失败都返回「已看过」：宁可少提一次，也不能因为一条提示炸掉整页。
 */

const STORAGE_KEY = 'lab_tour_hinted'

export function hasSeenTourHint(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function markTourHintSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // 隐身模式等：下次访问再提一次，无害
  }
}

/** 自动淡出的延时（毫秒）。与入口页那条提示各自声明，两者可以分开调 */
export const TOUR_HINT_MS = 6_000

/**
 * `localStorage.lab_tour_hint_hold = '1'` → 不自动淡出。E2E 用，形态照 `lab_asserts`。
 *
 * 6 秒窗口在 headless 软渲染下抓不稳（主线程被加载打满，Playwright 轮询被饿死）。
 * 分工：淡出时机由单测用假定时器断言，渲染几何与命中判定由 E2E 断言。
 */
export function tourHintHeld(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('lab_tour_hint_hold') === '1'
  } catch {
    return false
  }
}
