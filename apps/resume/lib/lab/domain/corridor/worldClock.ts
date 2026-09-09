/**
 * 三扇窗外的「此刻」（规格 lab-corridor-story.md §3，ADR 20260908204303）。
 *
 * 全是纯函数、注入 `now`：`Intl.DateTimeFormat` 按时区取当地小时，天色按小时分段。
 * 不在这里读系统时间——组件每 60 秒调一次，测试给固定的 Date。
 */

export type WindowCity = 'london' | 'singapore' | 'beijing'

export const WINDOW_CITIES: readonly WindowCity[] = ['london', 'singapore', 'beijing']

export const CITY_TIME_ZONE: Readonly<Record<WindowCity, string>> = {
  london: 'Europe/London',
  singapore: 'Asia/Singapore',
  beijing: 'Asia/Shanghai',
}

export type SkyPhase = 'night' | 'dawn' | 'day' | 'dusk'

/**
 * 天色。饱和度压到与门贴纸同级（HSL S ≤ 0.35）——窗外允许有颜色，
 * 走廊内部仍是米色系（About 那次「房间变蓝」的教训针对的是室内）。
 */
export const SKY_COLORS: Readonly<Record<SkyPhase, string>> = {
  // 夜色：第一版 #3b4a6b 是全场唯一的饱和深块，剪影在它上面对比只有 1.35:1（UX 评审）
  night: '#6b7385',
  dawn: '#d9c6b8',
  day: '#d6e0e8',
  dusk: '#d3bcac',
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    formatterCache.set(timeZone, f)
  }
  return f
}

/** 当地时刻（小时 + 分钟/60），0 ≤ h < 24 */
export function localHourIn(timeZone: string, now: Date): number {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return 0
  const parts = formatter(timeZone).formatToParts(now)
  let hour = 0
  let minute = 0
  for (const p of parts) {
    if (p.type === 'hour') hour = Number(p.value) % 24 // en-GB 在 0 点可能给 "24"
    if (p.type === 'minute') minute = Number(p.value)
  }
  return hour + minute / 60
}

/** 「HH:mm」 */
export function localTimeLabel(timeZone: string, now: Date): string {
  const h = localHourIn(timeZone, now)
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60) % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function skyPhaseAt(hour: number): SkyPhase {
  const h = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : 12
  if (h < 5) return 'night'
  if (h < 7) return 'dawn'
  if (h < 17) return 'day'
  if (h < 19) return 'dusk'
  return 'night'
}

export function skyColorAt(hour: number): string {
  return SKY_COLORS[skyPhaseAt(hour)]
}

/** 窗外剪影的墨色：夜里深一档，与夜色的对比才够（约 3:1）；白天用中灰 */
export function skylineInkAt(hour: number): string {
  return skyPhaseAt(hour) === 'night' ? '#39404e' : '#5a5f6b'
}
