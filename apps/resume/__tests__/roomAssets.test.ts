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

  it.each(ROOM_IDS)('%s 有非空且无重复的静态资源清单', (roomId) => {
    const assets = ROOM_ASSETS[roomId]

    expect(assets.length).toBeGreaterThan(0)
    expect(new Set(assets).size).toBe(assets.length)
  })

  it.each(ROOM_IDS)('%s 仅收录纹理或字体 URL', (roomId) => {
    for (const asset of ROOM_ASSETS[roomId]) {
      expect(asset).toMatch(/^\/(?:textures|fonts)\//)
    }
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
