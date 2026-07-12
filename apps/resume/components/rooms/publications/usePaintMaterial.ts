'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import * as THREE from 'three'
import type { PublicationsPaintApi } from './PublicationsScenery'

const DEFAULT_REVEAL_DURATION = 2.5
const DEFAULT_REVEAL_DIRECTION = [-1, 0, 0.1] as const

type NoiseAxes = 'xy' | 'xz' | 'yz'

interface PaintMaterialOptions {
  direction?: readonly [number, number, number]
  startDistance?: number
  endDistance?: number
  noiseAxes?: NoiseAxes
}

interface ActiveReveal {
  tween: gsap.core.Tween | null
  resolve: () => void
  settled: boolean
}

export interface PaintMaterialApi {
  paint: PublicationsPaintApi
  isRevealing: boolean
  reveal: (duration?: number) => Promise<void>
  complete: () => void
  reset: () => void
  cancel: () => void
  setRoomOrigin: (room: THREE.Group | null) => void
}

function getNoiseExpression(noiseAxes: NoiseAxes): string {
  return `localPos.${noiseAxes}`
}

export function usePaintMaterial(
  options: PaintMaterialOptions = {},
): PaintMaterialApi {
  const {
    direction = DEFAULT_REVEAL_DIRECTION,
    startDistance = -5,
    endDistance = 55,
    noiseAxes = 'yz',
  } = options
  const uniforms = useMemo(() => ({
    uPaintProgress: { value: 0 },
    uRoomOrigin: { value: new THREE.Vector3() },
  }), [])
  const activeRevealRef = useRef<ActiveReveal | null>(null)
  const mountedRef = useRef(false)
  const [isRevealing, setIsRevealing] = useState(false)

  const settleReveal = useCallback((activeReveal: ActiveReveal): void => {
    if (activeReveal.settled) return
    activeReveal.settled = true
    if (activeRevealRef.current === activeReveal) {
      activeRevealRef.current = null
    }
    activeReveal.resolve()
  }, [])

  const cancel = useCallback((): void => {
    const activeReveal = activeRevealRef.current
    if (activeReveal) {
      activeRevealRef.current = null
      activeReveal.tween?.kill()
      settleReveal(activeReveal)
    }
    if (mountedRef.current) setIsRevealing(false)
  }, [settleReveal])

  const complete = useCallback((): void => {
    cancel()
    uniforms.uPaintProgress.value = 1
  }, [cancel, uniforms])

  const reset = useCallback((): void => {
    cancel()
    uniforms.uPaintProgress.value = 0
  }, [cancel, uniforms])

  const setRoomOrigin = useCallback((room: THREE.Group | null): void => {
    if (!room) return
    room.updateWorldMatrix(true, false)
    room.getWorldPosition(uniforms.uRoomOrigin.value)
  }, [uniforms])

  const reveal = useCallback((duration = DEFAULT_REVEAL_DURATION): Promise<void> => {
    cancel()
    uniforms.uPaintProgress.value = 0
    if (mountedRef.current) setIsRevealing(true)

    return new Promise(resolve => {
      const activeReveal: ActiveReveal = {
        tween: null,
        resolve,
        settled: false,
      }
      activeRevealRef.current = activeReveal
      activeReveal.tween = gsap.to(uniforms.uPaintProgress, {
        value: 1,
        duration,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onComplete: () => {
          settleReveal(activeReveal)
          if (mountedRef.current) setIsRevealing(false)
        },
        onInterrupt: () => settleReveal(activeReveal),
      })
    })
  }, [cancel, settleReveal, uniforms])

  const onBeforeCompile = useMemo<THREE.Material['onBeforeCompile']>(() => {
    const noiseExpression = getNoiseExpression(noiseAxes)
    const [directionX, directionY, directionZ] = direction
    return shader => {
      shader.uniforms.uPaintProgress = uniforms.uPaintProgress
      shader.uniforms.uRoomOrigin = uniforms.uRoomOrigin
      shader.vertexShader = `
        varying vec3 vWorldPositionColor;
        ${shader.vertexShader}
      `.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWorldPositionColor = (modelMatrix * vec4(position, 1.0)).xyz;`,
      )
      shader.fragmentShader = `
        uniform float uPaintProgress;
        uniform vec3 uRoomOrigin;
        varying vec3 vWorldPositionColor;
        ${shader.fragmentShader}
      `.replace(
        '#include <common>',
        `#include <common>
        float paintHash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        float paintNoise(vec2 x) {
          vec2 i = floor(x);
          vec2 f = fract(x);
          float a = paintHash(i);
          float b = paintHash(i + vec2(1.0, 0.0));
          float c = paintHash(i + vec2(0.0, 1.0));
          float d = paintHash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x)
            + (d - b) * u.x * u.y;
        }`,
      ).replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        vec3 localPos = vWorldPositionColor - uRoomOrigin;
        vec3 revealDir = normalize(vec3(
          ${directionX.toFixed(1)},
          ${directionY.toFixed(1)},
          ${directionZ.toFixed(1)}
        ));
        float targetDist = mix(
          ${startDistance.toFixed(1)},
          ${endDistance.toFixed(1)},
          uPaintProgress
        );
        float distFromPlane = targetDist - dot(localPos, revealDir);
        float combinedNoise = paintNoise(${noiseExpression} * 2.0) * 2.0
          + paintNoise(${noiseExpression} * 8.0) * 0.5;
        float boundary = distFromPlane + combinedNoise;
        if (boundary < 0.0) discard;
        float glow = smoothstep(2.0, 0.0, boundary);
        if (uPaintProgress < 0.999 && boundary < 2.0) {
          gl_FragColor.rgb += vec3(glow * 0.4, glow * 0.5, glow * 0.7);
        }`,
      )
    }
  }, [
    direction,
    endDistance,
    noiseAxes,
    startDistance,
    uniforms,
  ])

  const paint = useMemo<PublicationsPaintApi>(
    () => ({ opacity: 1, onBeforeCompile }),
    [onBeforeCompile],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cancel()
    }
  }, [cancel])

  return useMemo(() => ({
    paint,
    isRevealing,
    reveal,
    complete,
    reset,
    cancel,
    setRoomOrigin,
  }), [
    cancel,
    complete,
    isRevealing,
    paint,
    reset,
    reveal,
    setRoomOrigin,
  ])
}
