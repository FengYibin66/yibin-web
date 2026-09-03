'use client'

import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { audioMixer } from '@/lib/lab/app/audio/AudioMixer'
import type { RoomAmbience as RoomAmbienceDef } from '@/lib/lab/domain/rooms/types'
import type { SoundName } from '@/lib/lab/domain/audio/manifest'

const _worldPos = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _up = new THREE.Vector3()

interface RoomAmbienceProps {
  /** 房间声明里的 ambience；null 表示这个房间没有环境音 */
  ambience: RoomAmbienceDef | null
  /** 房间是否处于「该出声」的状态（退场/传送时为 false） */
  active: boolean
}

/**
 * 房间环境音 —— 取代三个房间里的 drei `<PositionalAudio autoplay>`
 * （ADR 20260903140618）。
 *
 * 换掉它修三个缺陷：
 *
 * 1. **不再阻塞房间 READY（审计 A5）。** drei 的 `<PositionalAudio>` 走
 *    `useLoader`，会 **Suspend**——Projects 的 2.35MB 与 Contact 的 1.66MB
 *    音频挂在房间的 Suspense 边界里，8 秒加载超时很容易被它撑爆。本组件不
 *    加载任何东西，只是告诉 Mixer「放这个」，Mixer 内部走 howler 的回调式
 *    加载。
 * 2. **静音生效（A6）。** drei 每个实例各建一个 `THREE.AudioListener`，与
 *    `AudioProvider.isMuted` 没有任何连接，于是用户静音后环境音照放。现在
 *    只有一个 listener（Howler 的），`Howler.mute()` 覆盖全部。
 * 3. **声源位置来自声明。** 原先三个房间各自写 `url` 与衰减参数，
 *    Publications 又用了另一套（`new Audio()` in `publicationSceneryRuntime`）。
 *
 * 3D 距离衰减保留：`refDistance` / `rolloffFactor` / `distanceModel` 逐项
 * 传给 `PannerNode`，与 `THREE.PositionalAudio` 一一对应。
 */
export function RoomAmbience({ ambience, active }: RoomAmbienceProps) {
  const { camera, scene } = useThree()

  useEffect(() => {
    if (!ambience || !active) {
      audioMixer.ambience_(null)
      return
    }

    // 声明里的坐标是房间局部；换算到世界，否则相机走动时衰减方向是错的
    _worldPos.set(...(ambience.position as [number, number, number]))
    scene.updateMatrixWorld()
    audioMixer.ambience_(ambience.soundId as SoundName, [
      _worldPos.x,
      _worldPos.y,
      _worldPos.z,
    ])

    return () => { audioMixer.ambience_(null) }
  }, [ambience, active, scene])

  // 每帧把相机位姿交给 Howler 的 listener —— 这是距离衰减能工作的前提
  useFrame(() => {
    if (!active) return
    camera.getWorldPosition(_worldPos)
    camera.getWorldDirection(_forward)
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion)
    audioMixer.syncListener(
      [_worldPos.x, _worldPos.y, _worldPos.z],
      [_forward.x, _forward.y, _forward.z],
      [_up.x, _up.y, _up.z],
    )
  })

  return null
}
