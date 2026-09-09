'use client'

import { useMemo } from 'react'

import { sketchTexture } from '@/lib/lab/infra/sketch/textureCache'
import { WALL_X } from '@/lib/lab/domain/corridor/layout'
import type { YearMarkSpec } from '@/lib/lab/domain/sketch/types'

/**
 * 墙脚的年份刻度（ADR 20260908204303，规格 lab-corridor-story.md §2.2）。
 *
 * 位置从地标表来（`year-mark` 由 `timeline.ts` 派生），这里只画：一张 0.5 × 0.18 的
 * 手写小纸片贴在墙脚 y = −1.45，用 sketch 流水线运行时栅格化（按 specKey 缓存，
 * 十个年份十张小画布）。
 */

/**
 * 世界尺寸；纹理 160 × 58 与之同比（sketch/AGENTS.md：宽高比不一致线条会被拉扁）。
 * 第一版 0.5 × 0.18 贴在墙脚 y −1.45：实机 6 单位外约 28 × 10 px 的浅灰字，没人看见
 * （产品评审："实际上是不可见的噪声"）。放大到 0.8 × 0.29、提到踢脚线上方 −1.15。
 */
const WIDTH = 0.8
const HEIGHT = 0.29
const TEX_W = 160
const TEX_H = 58
const Y = -1.15

interface YearMarkProps {
  year: number
  z: number
  side: 'left' | 'right'
}

export function YearMark({ year, z, side }: YearMarkProps) {
  const spec = useMemo<YearMarkSpec>(
    () => ({ kind: 'yearMark', id: String(year), size: { width: TEX_W, height: TEX_H }, year }),
    [year],
  )
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
