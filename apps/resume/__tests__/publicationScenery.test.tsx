import { render, waitFor } from '@testing-library/react'
import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  advancePublicationBird,
  getPublicationCloudCount,
  getRightHouseCrop,
  PUBLICATION_ROPE_POINTS,
  PublicationsScenery,
} from '@/components/rooms/publications/PublicationsScenery'

const mocks = vi.hoisted(() => ({
  frameCallback: undefined as
    | ((state: unknown, delta: number) => void)
    | undefined,
  tier: 'HIGH' as 'HIGH' | 'MEDIUM' | 'LOW',
}))

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    mocks.frameCallback = callback
  },
}))

vi.mock('@react-three/drei', () => ({
  useTexture: () => new THREE.Texture(),
}))

vi.mock('@/context/PerformanceContext', () => ({
  usePerformance: () => ({
    tier: mocks.tier,
    downgradeTier: vi.fn(),
    settings: { antialias: true, dpr: 1, shadows: false },
  }),
}))

vi.mock('@/components/rooms/gallery/GalleryClouds', () => ({
  GalleryClouds: ({ count }: { count: number }) => (
    <group name="publication-clouds" data-count={count} />
  ),
}))

beforeEach(() => {
  vi.unstubAllGlobals()
  mocks.frameCallback = undefined
  mocks.tier = 'HIGH'
})

describe('PublicationsScenery geometry', () => {
  it('uses the full-width reference rope arc', () => {
    expect(PUBLICATION_ROPE_POINTS.map(point => point.x)).toEqual([
      -16, -8, 0, 8, 16,
    ])
  })

  it('keeps 65 clouds except on LOW tier', () => {
    expect(getPublicationCloudCount('HIGH')).toBe(65)
    expect(getPublicationCloudCount('MEDIUM')).toBe(65)
    expect(getPublicationCloudCount('LOW')).toBe(32)
  })

  it('crops the mirrored right houses while preserving their inner edge', () => {
    expect(getRightHouseCrop(15, 0.2)).toEqual({
      offsetX: 0.2,
      repeatX: 0.8,
      width: 12,
      centerX: 13.5,
    })
  })

  it('renders the balcony, threshold, three scenery layers and sky', () => {
    const { container } = render(<PublicationsScenery ambienceEnabled={false} />)

    expect(container.querySelector('[name="publication-floor"]')).not.toBeNull()
    expect(container.querySelector('[name="publication-floor-outline"]')).not.toBeNull()
    expect(container.querySelector('[name="publication-railing"]')).not.toBeNull()
    expect(container.querySelector('[name="publication-threshold"]')).not.toBeNull()
    expect(container.querySelectorAll('[name^="publication-houses-"]')).toHaveLength(3)
    expect(container.querySelectorAll('[name^="publication-city-"]')).toHaveLength(3)
    expect(container.querySelector('[name="publication-sky"]')).not.toBeNull()
    expect(container.querySelector('[name="publication-clouds"]')).toHaveAttribute(
      'data-count',
      '65',
    )
  })

  it('reduces cloud density on LOW tier', () => {
    mocks.tier = 'LOW'
    const { container } = render(<PublicationsScenery ambienceEnabled={false} />)

    expect(container.querySelector('[name="publication-clouds"]')).toHaveAttribute(
      'data-count',
      '32',
    )
  })

  it('keeps scenery mounted when city ambience playback fails', async () => {
    const play = vi.fn().mockRejectedValue(new Error('autoplay blocked'))
    const pause = vi.fn()
    class RejectingAudio {
      currentTime = 0
      loop = false
      volume = 1
      pause = pause
      play = play
    }
    vi.stubGlobal('Audio', RejectingAudio)

    const { container, unmount } = render(<PublicationsScenery />)

    await waitFor(() => expect(play).toHaveBeenCalledOnce())
    expect(container.querySelector('[name="publications-scenery"]')).not.toBeNull()
    unmount()
    expect(pause).toHaveBeenCalledOnce()
  })
})

describe('publication bird physics', () => {
  it('caps a stalled frame delta before integrating motion', () => {
    const next = advancePublicationBird({
      x: 0,
      y: 4.5,
      velocityY: 0,
      jumpTimer: 1,
      rotationZ: 0,
    }, 1, () => 0.5)

    expect(next.x).toBeCloseTo(0.125)
    expect(next.y).toBeCloseTo(4.47)
    expect(next.velocityY).toBeCloseTo(-0.6)
    expect(next.jumpTimer).toBeCloseTo(0.95)
  })

  it('resets safely after crossing the flight boundary', () => {
    const next = advancePublicationBird({
      x: 25,
      y: 6,
      velocityY: -2,
      jumpTimer: 0.4,
      rotationZ: 0.2,
    }, 0.05, () => 0)

    expect(next).toMatchObject({
      x: -25,
      y: 4.5,
      velocityY: 0,
      jumpTimer: 0,
      rotationZ: 0,
    })
  })
})
