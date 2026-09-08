import { describe, expect, it } from 'vitest'

import { content } from '@/lib/content'
import { CITY_IDS, type CityId } from '@/lib/content/types'

/**
 * 简历条目的结构化年份与城市（ADR 20260908204303）。
 *
 * `period` 是展示文案（"Sep 2024 – Present"、"2026 年 4 月 – 至今"），`years` 是数据。
 * 两者不是派生关系，是同一事实的两种表达——这里守一致性：从文案里抠出来的
 * 年份必须等于 `years`，en/zh 同值，`cityId` 在名单里。
 */

/** 从任意格式的 period 里取起止年：所有四位年份；含 Present / 至今 则 end 缺省 */
export function parsePeriod(period: string): { start: number; end?: number } {
  const years = [...period.matchAll(/(19|20)\d{2}/g)].map(m => Number(m[0]))
  const open = /present|至今|now/i.test(period)
  const start = years[0]
  if (start === undefined) throw new Error(`period 里没有年份：${period}`)
  if (open) return { start }
  const end = years[1] ?? start
  return { start, end }
}

type Entry = { id: string; period: string; years: { start: number; end?: number }; cityId: CityId }

function entries(locale: 'en' | 'zh'): Entry[] {
  const c = content[locale]
  return [...c.experience.items, ...c.education.items]
}

describe('parsePeriod', () => {
  it('年 – 年', () => expect(parsePeriod('2019 – 2021')).toEqual({ start: 2019, end: 2021 }))
  it('月 年 – 月 年', () => expect(parsePeriod('Oct 2022 – Jun 2023')).toEqual({ start: 2022, end: 2023 }))
  it('Present 开区间', () => expect(parsePeriod('Sep 2024 – Present')).toEqual({ start: 2024 }))
  it('中文格式与「至今」', () => {
    expect(parsePeriod('2026 年 4 月 – 至今')).toEqual({ start: 2026 })
    expect(parsePeriod('2017 – 2021')).toEqual({ start: 2017, end: 2021 })
  })
  it('没有年份就抛，别静默给 NaN', () => expect(() => parsePeriod('Present')).toThrow())
})

describe('简历条目的 years / cityId', () => {
  for (const locale of ['en', 'zh'] as const) {
    describe(locale, () => {
      it('每条都有 years 与 cityId', () => {
        for (const e of entries(locale)) {
          expect(e.years, e.id).toBeDefined()
          expect(Number.isInteger(e.years.start), e.id).toBe(true)
          expect(e.cityId, e.id).toBeDefined()
        }
      })

      it('period 文案里的年份 == years', () => {
        for (const e of entries(locale)) {
          expect(parsePeriod(e.period), `${e.id}: "${e.period}"`).toEqual(e.years)
        }
      })

      it('cityId 在名单里', () => {
        for (const e of entries(locale)) expect(CITY_IDS, e.id).toContain(e.cityId)
      })

      it('end 不早于 start；年份在时间线范围内', () => {
        for (const e of entries(locale)) {
          if (e.years.end !== undefined) expect(e.years.end, e.id).toBeGreaterThanOrEqual(e.years.start)
          expect(e.years.start, e.id).toBeGreaterThanOrEqual(2017)
          expect(e.years.end ?? e.years.start, e.id).toBeLessThanOrEqual(2026)
        }
      })
    })
  }

  it('en 与 zh 的 years / cityId 逐条相同（文案可以不同，数据不能）', () => {
    const en = new Map(entries('en').map(e => [e.id, e]))
    for (const z of entries('zh')) {
      const e = en.get(z.id)
      expect(e, `zh 有 ${z.id} 而 en 没有`).toBeDefined()
      expect(z.years, z.id).toEqual(e!.years)
      expect(z.cityId, z.id).toBe(e!.cityId)
    }
    expect(entries('zh').length).toBe(entries('en').length)
  })
})
