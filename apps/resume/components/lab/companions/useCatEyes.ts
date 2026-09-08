'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 猫的瞳孔跟着指针转（ADR 20260908160918）。
 *
 * 从 `components/lab/Cat.tsx` 抽出来的，因为现在有**两只**猫：入口页那只
 * （门的预览，一直在那儿）和走廊柜子上那只（守着相框）。同一个行为写两遍，
 * 下次调灵敏度就会只调一处。
 *
 * ## 为什么不接动效开关
 *
 * 瞳孔跟随是**对指针的响应**，不是自发运动 —— `prefers-reduced-motion` 停的是
 * 后者。眼睛不跟人看的猫看起来是死的，而这不是无障碍要的效果。
 */

/** 瞳孔相对眼窝中心的最大偏移（世界单位，按猫身 1.5 见方标定） */
export const MAX_EYE_MOVEMENT = 0.015

export interface CatEyeRefs {
  left: React.RefObject<THREE.Mesh | null>
  right: React.RefObject<THREE.Mesh | null>
}

export interface CatEyeAnchors {
  /** 左瞳孔的静止位置 */
  left: readonly [number, number]
  /** 右瞳孔的静止位置 */
  right: readonly [number, number]
  /** 跟随幅度倍率。缩放过的猫要按同一比例传，否则瞳孔会跑出眼窝 */
  gain?: number
}

/**
 * 每帧把两个瞳孔 lerp 到「静止位置 + 指针偏移」。
 *
 * @param enabled `false` 时把瞳孔拉回静止位置（睡着的猫）
 */
export function useCatEyes(
  refs: CatEyeRefs,
  anchors: CatEyeAnchors,
  enabled = true,
): void {
  const gain = anchors.gain ?? 1

  useFrame(state => {
    const left = refs.left.current
    const right = refs.right.current
    if (!left || !right) return

    const offsetX = enabled ? state.pointer.x * MAX_EYE_MOVEMENT * 2 * gain : 0
    const offsetY = enabled ? state.pointer.y * MAX_EYE_MOVEMENT * 2 * gain : 0

    left.position.x = THREE.MathUtils.lerp(left.position.x, anchors.left[0] + offsetX, 0.1)
    left.position.y = THREE.MathUtils.lerp(left.position.y, anchors.left[1] + offsetY, 0.1)
    right.position.x = THREE.MathUtils.lerp(right.position.x, anchors.right[0] + offsetX, 0.1)
    right.position.y = THREE.MathUtils.lerp(right.position.y, anchors.right[1] + offsetY, 0.1)
  })
}
