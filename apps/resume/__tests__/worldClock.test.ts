import { describe, expect, it } from 'vitest'

import {
  CITY_TIME_ZONE,
  SKY_COLORS,
  WINDOW_CITIES,
  localHourIn,
  localTimeLabel,
  skyColorAt,
  skyPhaseAt,
} from '@/lib/lab/domain/corridor/worldClock'

/** 2026-01-15 12:00 UTC：伦敦冬令时 = UTC、新加坡 +8、北京 +8 */
const WINTER_NOON_UTC = new Date('2026-01-15T12:00:00Z')
/** 2026-07-15 12:00 UTC：伦敦夏令时 +1 */
const SUMMER_NOON_UTC = new Date('2026-07-15T12:00:00Z')

describe('世界时钟（纯函数，注入 now）', () => {
  it('三座城市的时区', () => {
    expect(WINDOW_CITIES).toEqual(['london', 'singapore', 'beijing'])
    expect(CITY_TIME_ZONE.london).toBe('Europe/London')
    expect(CITY_TIME_ZONE.singapore).toBe('Asia/Singapore')
    expect(CITY_TIME_ZONE.beijing).toBe('Asia/Shanghai')
  })

  it('冬令时正午：伦敦 12、新加坡与北京 20', () => {
    expect(localHourIn('Europe/London', WINTER_NOON_UTC)).toBeCloseTo(12, 5)
    expect(localHourIn('Asia/Singapore', WINTER_NOON_UTC)).toBeCloseTo(20, 5)
    expect(localHourIn('Asia/Shanghai', WINTER_NOON_UTC)).toBeCloseTo(20, 5)
  })

  it('夏令时正午：伦敦 13（新加坡不实行夏令时，仍是 20）', () => {
    expect(localHourIn('Europe/London', SUMMER_NOON_UTC)).toBeCloseTo(13, 5)
    expect(localHourIn('Asia/Singapore', SUMMER_NOON_UTC)).toBeCloseTo(20, 5)
  })

  it('跨日：UTC 18:30 时新加坡已是次日 02:30，小时是 2.5 不是 26.5', () => {
    const h = localHourIn('Asia/Singapore', new Date('2026-01-15T18:30:00Z'))
    expect(h).toBeCloseTo(2.5, 5)
  })

  it('午夜前后不会出现 "24:xx"（en-GB 的 hour 在 0 点可能给 24）', () => {
    const label = localTimeLabel('Europe/London', new Date('2026-01-15T00:05:00Z'))
    expect(label).toBe('00:05')
  })

  it('HH:mm 两位补零', () => {
    expect(localTimeLabel('Asia/Shanghai', new Date('2026-01-15T01:07:00Z'))).toBe('09:07')
  })

  it('坏的 Date 不抛，回 0 点', () => {
    expect(localHourIn('Europe/London', new Date('nope'))).toBe(0)
  })

  describe('天色分段', () => {
    it('五段边界', () => {
      expect(skyPhaseAt(0)).toBe('night')
      expect(skyPhaseAt(4.99)).toBe('night')
      expect(skyPhaseAt(5)).toBe('dawn')
      expect(skyPhaseAt(6.99)).toBe('dawn')
      expect(skyPhaseAt(7)).toBe('day')
      expect(skyPhaseAt(16.99)).toBe('day')
      expect(skyPhaseAt(17)).toBe('dusk')
      expect(skyPhaseAt(18.99)).toBe('dusk')
      expect(skyPhaseAt(19)).toBe('night')
      expect(skyPhaseAt(23.9)).toBe('night')
    })

    it('小时越界按模 24；非有限当白天', () => {
      expect(skyPhaseAt(25)).toBe('night')
      expect(skyPhaseAt(-2)).toBe('night')
      expect(skyPhaseAt(Number.NaN)).toBe('day')
    })

    it('颜色饱和度 ≤ 0.35（窗外允许有色，但与门贴纸同级）', () => {
      for (const hex of Object.values(SKY_COLORS)) {
        const r = parseInt(hex.slice(1, 3), 16) / 255
        const g = parseInt(hex.slice(3, 5), 16) / 255
        const b = parseInt(hex.slice(5, 7), 16) / 255
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const l = (max + min) / 2
        const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
        expect(s, hex).toBeLessThanOrEqual(0.35)
      }
      expect(skyColorAt(12)).toBe(SKY_COLORS.day)
    })
  })
})
