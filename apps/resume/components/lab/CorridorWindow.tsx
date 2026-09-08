'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Text, useTexture } from '@react-three/drei'
import * as THREE from 'three'

import { useLabLabels } from '@/hooks/useLabLabels'
import { useLocale } from '@/hooks/useLocale'
import { content } from '@/lib/content'
import { cityYearSpan } from '@/lib/lab/domain/corridor/timeline'
import { WALL_X } from '@/lib/lab/domain/corridor/layout'
import {
  CITY_TIME_ZONE,
  localHourIn,
  localTimeLabel,
  skyColorAt,
  skyPhaseAt,
  skylineInkAt,
  type WindowCity,
} from '@/lib/lab/domain/corridor/worldClock'
import { LAB_FONT_LATIN_REGULAR, fontForText } from '@/lib/lab/domain/labFonts'
import type { SkylineSpec } from '@/lib/lab/domain/sketch/types'
import { sketchTexture } from '@/lib/lab/infra/sketch/textureCache'

/**
 * 走廊的窗（ADR 20260908204303，规格 lab-corridor-story.md §3）。
 *
 * 窗外是三座城市**此刻**的天色：伦敦的夜、新加坡的午后、北京的清晨同时出现在
 * 一条走廊里。天色按当地小时分段（`worldClock.ts`，纯函数），每 60 秒重算一次
 * ——用 `setInterval` 不用 `useFrame`：一分钟变一次的东西不该每帧算。
 *
 * 这个文件原先是零引用的死代码（头像从窗外探头，纹理路径也不存在）；ADR 定的是
 * "重写复活或删掉，取其短"——重写。
 */

const FRAME_SIZE = 1.5
const SKY_W = 1.3
const SKY_H = 1.1
const Y = 0.3
const TEX_W = 320
const TEX_H = 130
const CLOCK_MS = 60_000

interface CorridorWindowProps {
  city: WindowCity
  z: number
  side: 'left' | 'right'
}

export function CorridorWindow({ city, z, side }: CorridorWindowProps) {
  const labels = useLabLabels()
  const { locale } = useLocale()
  const frameTex = useTexture('/textures/entrance/window_sketch.webp')

  /* 第二行：这座城在履历里的年份——让窗与便签讲同一件事，而不是一个世界时钟挂件 */
  const yearsLine = useMemo(() => {
    const c = content[locale]
    const span = cityYearSpan([...c.experience.items, ...c.education.items], city)
    if (!span) return ''
    return span.end === undefined ? `${span.start} – ${labels.timeline.present}` : `${span.start} – ${span.end}`
  }, [locale, city, labels])

  const tz = CITY_TIME_ZONE[city]
  const [clock, setClock] = useState(() => ({ hour: localHourIn(tz, new Date()), label: localTimeLabel(tz, new Date()) }))

  // 剪影墨色随天色；缓存键带上时段，夜里那张与白天那张是两张纹理
  const phase = skyPhaseAt(clock.hour)
  const skylineSpec = useMemo<SkylineSpec>(
    () => ({ kind: 'skyline', id: `${city}-${phase}`, size: { width: TEX_W, height: TEX_H }, city, ink: skylineInkAt(clock.hour) }),
    [city, phase, clock.hour],
  )
  const skylineTex = useMemo(() => sketchTexture(skylineSpec), [skylineSpec])
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock({ hour: localHourIn(tz, now), label: localTimeLabel(tz, now) })
    }
    tick()
    const id = window.setInterval(tick, CLOCK_MS)
    return () => window.clearInterval(id)
  }, [tz])

  const skyMat = useRef<THREE.MeshBasicMaterial>(null)
  useEffect(() => {
    skyMat.current?.color.set(skyColorAt(clock.hour))
  }, [clock.hour])

  const x = side === 'left' ? -WALL_X + 0.01 : WALL_X - 0.01
  const rotationY = side === 'left' ? Math.PI / 2 : -Math.PI / 2
  const caption = `${labels.cities[city]} · ${clock.label}`

  return (
    <group position={[x, Y, z]} rotation={[0, rotationY, 0]}>
      {/*
        层次（沿墙面法线，离墙由近到远）：天色 → 剪影 → 窗框。
        天色不能放到墙**后面**去——墙是实心平面，后面的东西会被深度测试吃掉
        （第一版就是这样：窗框里一片空白，实机截图抓到）。窗框线稿的窗格是透明的，
        所以把天色贴在墙前一点、窗框再前一点，从窗格里看出去正好是天。
      */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[SKY_W, SKY_H]} />
        <meshBasicMaterial ref={skyMat} color={skyColorAt(clock.hour)} />
      </mesh>
      {/* 城市剪影：贴在天色前、窗框后 */}
      <mesh position={[0, -SKY_H / 2 + (SKY_W * TEX_H) / TEX_W / 2, 0.005]}>
        <planeGeometry args={[SKY_W, (SKY_W * TEX_H) / TEX_W]} />
        <meshBasicMaterial map={skylineTex} transparent alphaTest={0.02} depthWrite={false} />
      </mesh>
      {/* 窗框（入口页那张线稿，复用），最靠观者 */}
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[FRAME_SIZE, FRAME_SIZE]} />
        <meshBasicMaterial map={frameTex} transparent alphaTest={0.05} depthWrite={false} />
      </mesh>
      {/* 窗下两行小字：城市 · 当地时间 / 在这座城的年份 */}
      <Text
        position={[0, -FRAME_SIZE / 2 - 0.1, 0.012]}
        fontSize={0.12}
        color="#3a3a3a"
        anchorX="center"
        anchorY="top"
        font={fontForText(caption, LAB_FONT_LATIN_REGULAR)}
      >
        {caption}
      </Text>
      {yearsLine && (
        <Text
          position={[0, -FRAME_SIZE / 2 - 0.27, 0.012]}
          fontSize={0.1}
          color="#8a7a62"
          anchorX="center"
          anchorY="top"
          font={fontForText(yearsLine, LAB_FONT_LATIN_REGULAR)}
        >
          {yearsLine}
        </Text>
      )}
    </group>
  )
}
