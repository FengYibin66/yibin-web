'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

import { useAudio } from '@/context/AudioContext'
import { useScene } from '@/context/SceneContext'
import { getRail } from '@/lib/lab/app/stores/corridorStore'
import { EMPTY_STRIDE, playerFootstep, type StrideState } from '@/lib/lab/domain/corridor/footsteps'
import { isCorridorIdle } from '@/lib/lab/domain/machines/room.machine'

/**
 * 玩家的脚步声（ADR 20260908204304）。
 *
 * 不渲染任何东西；只是在渲染循环里读导轨（每帧读、不订阅）、按位移计步。
 * 房间内 / 进出房过程中导轨不驱动相机、速度衰减到 0，脚步自然停——但这里
 * 仍显式把 `inCorridor` 传给 domain，让"传送 40 单位回来不补步"有明确判据，
 * 而不是依赖速度衰减的时序。
 */
export function Footsteps() {
  const { play } = useAudio()
  const { roomLoadState } = useScene()
  const phaseRef = useRef(roomLoadState.phase)
  phaseRef.current = roomLoadState.phase

  const strideRef = useRef<StrideState>(EMPTY_STRIDE)

  useFrame(() => {
    const rail = getRail()
    const r = playerFootstep(strideRef.current, rail.z, rail.velocity, isCorridorIdle(phaseRef.current))
    strideRef.current = r.state
    if (r.step) play(r.step.variant === 'a' ? 'footstep_a' : 'footstep_b', { volume: r.step.volume })
  })

  return null
}
