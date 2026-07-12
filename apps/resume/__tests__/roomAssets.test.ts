import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTexture } from '@react-three/drei'
import { ROOM_ASSETS, preloadRoomAssets } from '@/lib/lab/roomAssets'

vi.mock('@react-three/drei', () => ({
  useTexture: {
    preload: vi.fn(),
  },
}))

const ROOM_IDS = ['about', 'projects', 'publications', 'contact'] as const

describe('ROOM_ASSETS', () => {
  it('仅包含四个普通房间', () => {
    expect(Object.keys(ROOM_ASSETS).sort()).toEqual([...ROOM_IDS].sort())
    expect(ROOM_ASSETS).not.toHaveProperty('gallery')
  })

  it.each(ROOM_IDS)('%s 有非空且房间内无重复的纹理清单', (roomId) => {
    const assets = ROOM_ASSETS[roomId]

    expect(assets.length).toBeGreaterThan(0)
    expect(new Set(assets).size).toBe(assets.length)
  })

  it.each(ROOM_IDS)('%s 仅收录供 useTexture 预载的纹理 URL', (roomId) => {
    for (const asset of ROOM_ASSETS[roomId]) {
      expect(asset).toMatch(/^\/textures\//)
    }
  })

  it('允许独立房间共享实际依赖的纹理', () => {
    const aboutAssets = new Set(ROOM_ASSETS.about)
    const sharedAssets = ROOM_ASSETS.publications.filter(asset => aboutAssets.has(asset))

    expect(sharedAssets.length).toBeGreaterThan(0)
  })
})

describe('preloadRoomAssets', () => {
  beforeEach(() => {
    vi.mocked(useTexture.preload).mockClear()
  })

  it('逐个预载房间清单且同一房间只执行一次', () => {
    preloadRoomAssets('about')
    preloadRoomAssets('about')

    expect(useTexture.preload).toHaveBeenCalledTimes(ROOM_ASSETS.about.length)
    ROOM_ASSETS.about.forEach((asset, index) => {
      expect(useTexture.preload).toHaveBeenNthCalledWith(index + 1, asset)
    })
  })
})
