'use client'

import * as THREE from 'three'

const SAFE_FRAME_DELTA = 0.05

export interface PublicationBirdState {
  x: number
  y: number
  velocityY: number
  jumpTimer: number
  rotationZ: number
}

export function advancePublicationBird(
  bird: PublicationBirdState,
  delta: number,
  random: () => number = Math.random,
): PublicationBirdState {
  const safeDelta = Math.min(Math.max(delta, 0), SAFE_FRAME_DELTA)
  let x = bird.x + 2.5 * safeDelta
  let y = bird.y
  let velocityY = bird.velocityY
  let jumpTimer = bird.jumpTimer
  let rotationZ = bird.rotationZ
  if (x > 25) {
    x = -25
    y = 4.5
    velocityY = 0
    jumpTimer = 0
    rotationZ = 0
  }

  velocityY -= 12 * safeDelta
  y += velocityY * safeDelta
  jumpTimer -= safeDelta
  if (jumpTimer <= 0 || y < 3.2) {
    velocityY = 5.5
    jumpTimer = 0.9 + random() * 0.3
  }
  if (y < 3) {
    y = 3
    velocityY = 5.5
  } else if (y > 6.5) {
    y = 6.5
    velocityY = 0
  }
  const targetRotation = THREE.MathUtils.clamp(
    velocityY * 0.05,
    -Math.PI / 6,
    Math.PI / 8,
  )
  return {
    x,
    y,
    velocityY,
    jumpTimer,
    rotationZ: THREE.MathUtils.lerp(
      rotationZ,
      targetRotation,
      safeDelta * 8,
    ),
  }
}

/**
 * 城市环境音。
 *
 * 原先这里自己 `new Audio()`、自己管音量与静音——是全站**第四套**音频实现
 * （另三套见 `AudioMixer` 顶部注释）。现在环境音统一由
 * `RoomAmbience` + `RoomDefinition.ambience` 负责，本 hook 只保留一个空壳
 * 以免调用点大改；`enabled` 参数已无用（房间的 active 状态由 RoomInterior
 * 传给 RoomAmbience）。
 *
 * @deprecated 房间组件改用 RoomDefinition 后删除
 */
export function usePublicationCityAmbience(_enabled: boolean): void {
  // 有意为空：见上方注释
}
