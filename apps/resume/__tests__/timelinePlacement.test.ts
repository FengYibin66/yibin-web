import { describe, expect, it } from 'vitest'

import {
  CORRIDOR_DOORS,
  CORRIDOR_FURNITURE,
  CORRIDOR_WINDOWS,
  SEGMENT_DOOR_RELATIVE_Z,
} from '@/lib/lab/domain/corridor/layout'
import {
  NOTE_DOOR_CLEARANCE,
  NOTE_MIN_GAP,
  NOTE_WINDOW_CLEARANCE,
  TIMELINE,
  YEAR_MARK_CLEARANCE,
  noteYear,
  placeTimelineNotes,
  placeYearMarks,
  relativeZOfYear,
  timelineYears,
  yearAt,
  type TimelineEntry,
} from '@/lib/lab/domain/corridor/timeline'
import { content } from '@/lib/content'

const near = (list: readonly { side: string; relativeZ: number }[], side: string, z: number) =>
  Math.min(...list.filter(o => o.side === side).map(o => Math.abs(o.relativeZ - z)), Number.POSITIVE_INFINITY)

/** 简历里的全部经历 + 教育 → 时间线条目 */
function entriesFromContent(): TimelineEntry[] {
  const en = content.en
  return [
    ...en.experience.items.map(i => ({ id: i.id, years: i.years })),
    ...en.education.items.map(i => ({ id: i.id, years: i.years })),
  ]
}

describe('时间线映射', () => {
  it('2017 → −6，2026 → −90，线性', () => {
    expect(relativeZOfYear(2017)).toBeCloseTo(-6, 6)
    expect(relativeZOfYear(2026)).toBeCloseTo(-90, 6)
    expect(relativeZOfYear(2021.5)).toBeCloseTo(-48, 6)
  })

  it('往返映射精确', () => {
    for (const y of timelineYears()) expect(yearAt(relativeZOfYear(y))).toBeCloseTo(y, 9)
  })

  it('十个年份', () => {
    expect(timelineYears()).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026])
    expect(TIMELINE.startYear).toBe(2017)
  })
})

describe('年份刻度落点', () => {
  const marks = placeYearMarks()

  it('每年恰一个', () => {
    expect(marks.map(m => m.year)).toEqual(timelineYears())
  })

  it('同侧 3.5 单位内没有门或家具', () => {
    const blockers = [...CORRIDOR_DOORS, ...CORRIDOR_FURNITURE]
    for (const m of marks) {
      // 两侧都被挡的年份允许（取更远的一侧），但那种情况在当前布局下不该出现
      expect(near(blockers, m.side, m.relativeZ), `${m.year} ${m.side} ${m.relativeZ}`)
        .toBeGreaterThanOrEqual(YEAR_MARK_CLEARANCE)
    }
  })

  it('不落进段末门避让区', () => {
    for (const m of marks) expect(m.relativeZ).toBeGreaterThan(SEGMENT_DOOR_RELATIVE_Z + 5.5)
  })

  it('规格 §2.2 列出的结果（改了规则要同步改规格）', () => {
    expect(marks.map(m => `${m.year}${m.side[0]}${m.relativeZ}`)).toEqual([
      '2017r-6', '2018l-15.3', '2019r-24.7', '2020r-34', '2021l-43.3',
      '2022r-52.7', '2023r-62', '2024l-71.3', '2025l-80.7', '2026l-89',
    ])
  })
})

describe('履历便签落点', () => {
  const entries = entriesFromContent()
  const notes = placeTimelineNotes(entries)

  it('每条经历 / 教育一张', () => {
    expect(notes.map(n => n.id).sort()).toEqual(entries.map(e => e.id).sort())
    expect(notes.length).toBeGreaterThanOrEqual(9)
  })

  it('便签挂在起点往后最多半年', () => {
    expect(noteYear({ id: 'a', years: { start: 2017, end: 2021 } })).toBe(2017.5)
    expect(noteYear({ id: 'b', years: { start: 2022, end: 2022 } })).toBe(2022)
    expect(noteYear({ id: 'c', years: { start: 2026 } })).toBe(2026)
  })

  it('同侧 6.5 内没有门（两侧都有门时允许，取更远那面）', () => {
    for (const n of notes) {
      const l = near(CORRIDOR_DOORS, 'left', n.relativeZ)
      const r = near(CORRIDOR_DOORS, 'right', n.relativeZ)
      const mine = n.side === 'left' ? l : r
      const other = n.side === 'left' ? r : l
      if (mine < NOTE_DOOR_CLEARANCE) expect(mine, n.id).toBeGreaterThanOrEqual(other)
    }
  })

  it('同侧与窗拉开距离', () => {
    for (const n of notes) {
      expect(near(CORRIDOR_WINDOWS, n.side, n.relativeZ), n.id).toBeGreaterThanOrEqual(NOTE_WINDOW_CLEARANCE - 1e-9)
    }
  })

  it('同侧两张之间 ≥ 2.4', () => {
    for (const a of notes) for (const b of notes) {
      if (a === b || a.side !== b.side) continue
      expect(Math.abs(a.relativeZ - b.relativeZ), `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(NOTE_MIN_GAP - 1e-9)
    }
  })

  it('都在第 0 段里、段末门避让区外', () => {
    for (const n of notes) {
      expect(n.relativeZ).toBeLessThan(0)
      expect(n.relativeZ).toBeGreaterThan(SEGMENT_DOOR_RELATIVE_Z + 5.5)
    }
  })

  it('输入顺序不影响结果', () => {
    const shuffled = [...entries].reverse()
    expect(placeTimelineNotes(shuffled)).toEqual(notes)
  })
})
