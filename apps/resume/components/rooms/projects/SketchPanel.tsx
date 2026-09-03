'use client'

import { useMemo } from 'react'

import { sketchTexture } from '@/lib/lab/infra/sketch/textureCache'
import type { SketchSpec } from '@/lib/lab/domain/sketch/types'
import {
  wallPanelTransform,
  type WallPanel,
} from '@/lib/lab/domain/rooms/projects/scene'

/**
 * 把一个 `SketchSpec` 贴到一个平面上。
 *
 * 手写层的通用出口——白板、便签、机柜、刻度盘、电缆全走这一个组件，区别只在
 * 传进来的 spec。这也是「数据驱动」在视图侧的落点：组件不知道自己画的是白板
 * 还是机柜。
 *
 * `transparent` 默认开：草图的画布是透明底（只有 spec 自己声明的填充是实心），
 * 关掉的话会得到一个黑框。
 */
export function SketchPanel({
  spec,
  width,
  height,
  transparent = true,
  opacity = 1,
}: {
  spec: SketchSpec
  width: number
  height: number
  transparent?: boolean
  opacity?: number
}) {
  const texture = useMemo(() => sketchTexture(spec), [spec])
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent={transparent}
        opacity={opacity}
        // 手绘线稿是"贴"上去的纸，不该被房间灯光二次调色；
        // 用 basic 而不是 standard，与走廊的线稿贴纸一致
        toneMapped={false}
        depthWrite={!transparent}
      />
    </mesh>
  )
}

/**
 * 墙面板：位置与朝向由声明派生（`wallPanelTransform`），组件不自己算坐标。
 *
 * 这一层存在的意义就是「坐标只有一个来源」——审计 A4 的根因是布局与取景各写
 * 一组魔数，对不上。
 */
export function WallSketch({ panel }: { panel: WallPanel }) {
  const { position, rotation } = useMemo(() => wallPanelTransform(panel), [panel])
  return (
    <group position={position} rotation={rotation}>
      <SketchPanel spec={panel.sketch} width={panel.width} height={panel.height} />
    </group>
  )
}
