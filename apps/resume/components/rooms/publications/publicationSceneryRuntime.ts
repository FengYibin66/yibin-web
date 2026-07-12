'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useAudio } from '@/context/AudioContext'
import { PUBLICATION_AUDIO_ASSETS } from '@/lib/lab/roomAssets'

const CITY_AMBIENCE_PATH = PUBLICATION_AUDIO_ASSETS[1]
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

export function usePublicationCityAmbience(enabled: boolean): void {
  const { isMuted, bgmVolume } = useAudio()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mutedRef = useRef(isMuted)
  const volumeRef = useRef(bgmVolume)
  mutedRef.current = isMuted
  volumeRef.current = bgmVolume

  useEffect(() => {
    if (!enabled) return
    const audio = new Audio(CITY_AMBIENCE_PATH)
    audio.loop = true
    audio.muted = mutedRef.current
    audio.volume = THREE.MathUtils.clamp(volumeRef.current, 0, 1)
    audioRef.current = audio
    try {
      void audio.play().catch(() => undefined)
    } catch {
      // Decorative ambience must not participate in room readiness.
    }
    return () => {
      audio.pause()
      audio.currentTime = 0
      if (audioRef.current === audio) audioRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !audioRef.current) return
    audioRef.current.muted = isMuted
    audioRef.current.volume = THREE.MathUtils.clamp(bgmVolume, 0, 1)
  }, [bgmVolume, enabled, isMuted])
}
