'use client'

import { useMemo } from 'react'

import { useLabLabels } from '@/hooks/useLabLabels'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import type { CityId, YearSpan } from '@/lib/content/types'
import { WALL_X } from '@/lib/lab/domain/corridor/layout'
import { placeTimelineNotes, type TimelineEntry } from '@/lib/lab/domain/corridor/timeline'
import type { TimelineNoteSpec } from '@/lib/lab/domain/sketch/types'
import { sketchTexture } from '@/lib/lab/infra/sketch/textureCache'

/**
 * 墙上的履历便签（ADR 20260908204303，规格 lab-corridor-story.md §2.3）。
 *
 * 内容在 `lib/content`（简历数据），位置在 domain（`placeTimelineNotes`），画法在 sketch
 * （`timelineNote` spec）。三层各管一件事；这里只把三者接起来。
 *
 * 只在第 0 段渲染：履历讲一遍就够。
 */

/** 世界尺寸 1.4 × 0.9；纹理 448 × 288 同比 */
const WIDTH = 1.4
const HEIGHT = 0.9
const TEX_W = 448
const TEX_H = 288
/** 壁画在 0.1–0.2 一带、高约 1.2（到 0.8）；便签在其上方，顶到 1.7，离天花 1.75 一点 */
const Y = 1.25

interface NoteData extends TimelineEntry {
  title: string
  subtitle: string
  cityId: CityId
}

function spanLabel(years: YearSpan, present: string): string {
  return years.end === undefined ? `${years.start} – ${present}` : years.start === years.end ? `${years.start}` : `${years.start} – ${years.end}`
}

interface TimelineNotesProps {
  zStart: number
}

export function TimelineNotes({ zStart }: TimelineNotesProps) {
  const labels = useLabLabels()
  const { locale } = useLocale()

  const notes = useMemo(() => {
    const c = content[locale]
    const entries: NoteData[] = [
      ...c.experience.items.map(i => ({ id: i.id, years: i.years, title: i.company, subtitle: i.role, cityId: i.cityId })),
      ...c.education.items.map(i => ({ id: i.id, years: i.years, title: i.school, subtitle: `${i.degree} · ${i.field}`, cityId: i.cityId })),
    ]
    const byId = new Map(entries.map(e => [e.id, e]))
    return placeTimelineNotes(entries).map(p => {
      const e = byId.get(p.id)!
      const city = labels.cities[e.cityId]
      const spec: TimelineNoteSpec = {
        kind: 'timelineNote',
        // 文案随语言变，id 里带上 locale，缓存键才不会串
        id: `${p.id}-${locale}`,
        size: { width: TEX_W, height: TEX_H },
        title: e.title,
        subtitle: e.subtitle,
        footer: `${city} · ${spanLabel(e.years, labels.timeline.present)}`,
      }
      return { ...p, spec }
    })
  }, [locale, labels])

  return (
    <group>
      {notes.map(n => (
        <Note key={n.id} spec={n.spec} z={zStart + n.relativeZ} side={n.side} />
      ))}
    </group>
  )
}

function Note({ spec, z, side }: { spec: TimelineNoteSpec; z: number; side: 'left' | 'right' }) {
  const texture = useMemo(() => sketchTexture(spec), [spec])
  const x = side === 'left' ? -WALL_X + 0.02 : WALL_X - 0.02
  const rotationY = side === 'left' ? Math.PI / 2 : -Math.PI / 2
  return (
    <mesh position={[x, Y, z]} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[WIDTH, HEIGHT]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.02} depthWrite={false} />
    </mesh>
  )
}
